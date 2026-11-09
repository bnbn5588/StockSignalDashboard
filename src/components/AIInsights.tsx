'use client';

import { useCallback, useEffect, useState } from 'react';
import { SIG_COLORS, bangkokToday } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if the analysis is today's (Bangkok date) — the worker writes it once a weekday
 * at 08:15 Bangkok under that same date, so there's nothing newer to fetch. */
function isAnalysisFresh(generatedAt?: string): boolean {
  return !!generatedAt && generatedAt === bangkokToday();
}

/** Next weekday 08:15 Bangkok (01:15 UTC — Bangkok has no DST), when worker.main runs. */
function nextAnalysisRun(): number {
  const d = new Date();
  d.setUTCHours(1, 15, 0, 0);
  while (d.getTime() <= Date.now() || d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.getTime();
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// ── Types ─────────────────────────────────────────────────────────────────────

interface TickerPoint { ticker: string; reason: string; }

/** worker/selection.py's rule hits per selected ticker, e.g. ["weak uptrend (ADX 14 < 20)"]. */
interface SelectionHit { ticker: string; why: string[]; }

interface Headline { title: string; publisher: string; published: string; url: string; }

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  thinkingTokens: number;
  totalCostUsd: number;
}

interface AIAnalysis {
  generatedAt: string;
  marketSummary: string;
  topPicks: TickerPoint[];
  riskWatch: TickerPoint[];
  portfolioNote: string;
  selection?: { topPicks: SelectionHit[]; riskWatch: SelectionHit[] };
  model: string;
  fetchedAt?: string;
  prompt?: string;
  tokenUsage?: TokenUsage;
}

interface NewsHighlight {
  ticker: string;
  summary: string;
  source: string;
  publishedDate: string;
  recommendation: string;
  effect?: 'reinforces' | 'tempers' | 'contradicts';
  materiality?: 'high' | 'low';
  headlines?: Headline[];
}

interface NewsAnalysis {
  generatedAt: string;
  newsHighlights: NewsHighlight[];
  model: string;
  fetchedAt?: string;
  prompt?: string;
  tokenUsage?: TokenUsage;
}

interface FinalRecommendation {
  ticker: string;
  stance: 'favor' | 'caution';
  reason: string;
}

interface FinalAnalysis {
  generatedAt: string;
  summary: string;
  recommendations: FinalRecommendation[];
  model: string;
  fetchedAt?: string;
  prompt?: string;
  tokenUsage?: TokenUsage;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

/** Colored ticker badge — a button when onSelect is given, so clicking it can jump the
 * Ticker deep-dive section to that ticker; otherwise a plain span. */
function TickerBadge({ ticker, color, background, onSelect }: { ticker: string; color: string; background: string; onSelect?: (ticker: string) => void }) {
  if (!onSelect) {
    return (
      <span style={{ fontSize: 12, fontWeight: 700, color, padding: '1px 7px', borderRadius: 5, background, letterSpacing: '0.03em' }}>
        {ticker}
      </span>
    );
  }
  return (
    <button
      onClick={() => onSelect(ticker)}
      title={`Jump to ${ticker} in Ticker deep-dive`}
      style={{ fontSize: 12, fontWeight: 700, color, padding: '1px 7px', borderRadius: 5, background, letterSpacing: '0.03em', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
    >
      {ticker}
    </button>
  );
}

const TONE = {
  pick: { color: SIG_COLORS.BUY, bg: 'rgba(29,158,117,0.07)', badge: 'rgba(29,158,117,0.14)' },
  risk: { color: '#BA7517', bg: 'rgba(186,117,23,0.07)', badge: 'rgba(186,117,23,0.14)' },
};

/** A topPick or riskWatch entry. The card is colored by which list it is in; the label
 * shows the ticker's actual signal (a riskWatch ticker can be HOLD or even BUY). */
function TickerCard({ item, tone, signal, why, onSelect }: { item: TickerPoint; tone: 'pick' | 'risk'; signal?: string; why?: string[]; onSelect?: (ticker: string) => void }) {
  const t = TONE[tone];
  const tier = tone === 'pick' && why?.[0]
    ? (why[0].startsWith('clean') ? 'clean' : why[0].startsWith('weak') ? 'weak' : null)
    : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0.55rem 0.75rem', borderRadius: 8, background: t.bg, border: `1px solid ${t.color}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <TickerBadge ticker={item.ticker} color={t.color} background={t.badge} onSelect={onSelect} />
        {signal && (
          <span style={{ fontSize: 10, fontWeight: 600, color: SIG_COLORS[signal] ?? 'var(--text-secondary)' }}>{signal}</span>
        )}
        {tier && (
          <span
            title={why?.join('; ')}
            style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, border: '1px solid var(--border-color)', color: tier === 'clean' ? SIG_COLORS.BUY : 'var(--text-secondary)' }}
          >
            {tier === 'clean' ? 'clean trend' : 'weak trend'}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {item.reason}
      </p>
    </div>
  );
}

const EFFECT_STYLE: Record<string, { label: string; color: string }> = {
  reinforces:  { label: 'supports the signal', color: SIG_COLORS.BUY },
  tempers:     { label: 'mixed / neutral',     color: SIG_COLORS.HOLD },
  contradicts: { label: 'against the signal',  color: SIG_COLORS.SELL },
};

function NewsCard({ item, tone, onSelect }: { item: NewsHighlight; tone?: 'pick' | 'risk'; onSelect?: (ticker: string) => void }) {
  const color = tone ? TONE[tone].color : SIG_COLORS.HOLD;
  const badgeBg = tone ? TONE[tone].badge : 'rgba(136,135,128,0.14)';
  const effect = item.effect ? EFFECT_STYLE[item.effect] : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0.65rem 0.8rem', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <TickerBadge ticker={item.ticker} color={color} background={badgeBg} onSelect={onSelect} />
          {effect && (
            <span style={{ fontSize: 10, fontWeight: 600, color: effect.color }}>
              {effect.label}{item.materiality === 'high' ? ' · major news' : ''}
            </span>
          )}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.65, wordBreak: 'break-word' }}>
          {item.source}{item.publishedDate ? ` · ${item.publishedDate}` : ''}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
        {item.summary}
      </p>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '2px solid var(--border-color)', paddingLeft: 8, wordBreak: 'break-word' }}>
        {item.recommendation}
      </p>
      {item.headlines && item.headlines.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {item.headlines.map(h => (
            <li key={h.url || h.title} style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
              <a href={h.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border-color)', wordBreak: 'break-word' }}>
                {h.title}
              </a>
              <span style={{ opacity: 0.6 }}> · {h.publisher ? `${h.publisher}, ` : ''}{h.published.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FinalCard({ item, onSelect }: { item: FinalRecommendation; onSelect?: (ticker: string) => void }) {
  const favor = item.stance === 'favor';
  const color = favor ? SIG_COLORS.BUY : SIG_COLORS.SELL;
  const badgeBg = favor ? 'rgba(29,158,117,0.14)' : 'rgba(216,90,48,0.14)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0.55rem 0.75rem', borderRadius: 8, background: favor ? 'rgba(29,158,117,0.07)' : 'rgba(216,90,48,0.07)', border: `1px solid ${color}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TickerBadge ticker={item.ticker} color={color} background={badgeBg} onSelect={onSelect} />
        <span style={{ fontSize: 10, fontWeight: 600, color, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {item.stance}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {item.reason}
      </p>
    </div>
  );
}

function PromptViewer({ label, prompt, show, onToggle }: { label: string; prompt: string; show: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={onToggle} style={{ background: 'none', border: 'none', padding: '4px 0', margin: '-4px 0', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, width: '100%', textAlign: 'left' }}>
        <span style={{ fontSize: 9 }}>{show ? '▼' : '▶'}</span>
        {show ? 'Hide' : 'View'} {label}
      </button>
      {show && (
        <pre style={{ marginTop: 8, padding: '0.75rem', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {prompt}
        </pre>
      )}
    </div>
  );
}

function UsageViewer({ label, usage, show, onToggle, note }: { label: string; usage: TokenUsage; show: boolean; onToggle: () => void; note: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={onToggle} style={{ background: 'none', border: 'none', padding: '4px 0', margin: '-4px 0', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, width: '100%', textAlign: 'left' }}>
        <span style={{ fontSize: 9 }}>{show ? '▼' : '▶'}</span>
        {show ? 'Hide' : 'View'} {label}
      </button>
      {show && (
        <div style={{ marginTop: 8, padding: '0.75rem', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem 1rem', fontSize: 11, color: 'var(--text-secondary)' }}>
            <UsageStat label="Input" value={usage.inputTokens} />
            <UsageStat label="Output" value={usage.outputTokens} />
            <UsageStat label="Thinking" value={usage.thinkingTokens} />
            <UsageStat label="Cache write" value={usage.cacheCreationInputTokens} />
            <UsageStat label="Cache read" value={usage.cacheReadInputTokens} />
            <UsageStat label="Equiv. cost" value={`$${usage.totalCostUsd.toFixed(3)}`} />
          </div>
          <p style={{ margin: '0.6rem 0 0', fontSize: 10.5, lineHeight: 1.5, color: 'var(--text-secondary)', opacity: 0.7 }}>
            {note}
          </p>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
      {info && <InfoTooltip text={info} />}
    </div>
  );
}

/** Section header that toggles its own body — a div (not a button) since InfoTooltip
 * renders its own button and buttons can't nest inside buttons. */
function CollapsibleHeader({ title, info, expanded, onToggle }: { title: string; info?: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '4px 0', margin: '-4px 0 4px', cursor: 'pointer', userSelect: 'none' }}
    >
      <span style={{ fontSize: 9, color: 'var(--text-secondary)', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {title}
      </span>
      {info && <InfoTooltip text={info} />}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: '1.25rem', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <ClaudeIcon size={16} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI Analysis</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>Loading AI analysis…</span>
      </div>
      {[80, 60, 90, 50].map((w, i) => (
        <div key={i} style={{ height: 11, borderRadius: 5, background: 'var(--border-color)', width: `${w}%`, marginBottom: i === 1 ? 18 : 8, opacity: 0.6 }} />
      ))}
    </div>
  );
}

function ClaudeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.8 }}>
      <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 7l9 5 9-5M12 12v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIInsights({ onTickerSelect, signals }: { onTickerSelect?: (ticker: string) => void; signals?: Record<string, string> }) {
  const [data, setData]                     = useState<AIAnalysis | null>(null);
  const [status, setStatus]                 = useState<'loading' | 'error' | 'ok' | 'no-data'>('loading');
  const [errMsg, setErrMsg]                 = useState('');
  const [newsData, setNewsData]             = useState<NewsAnalysis | null>(null);
  const [finalData, setFinalData]           = useState<FinalAnalysis | null>(null);
  const [showPrompt, setShowPrompt]         = useState(false);
  const [showUsage, setShowUsage]           = useState(false);
  const [showNewsPrompt, setShowNewsPrompt] = useState(false);
  const [showNewsUsage, setShowNewsUsage]   = useState(false);
  const [showFinalPrompt, setShowFinalPrompt] = useState(false);
  const [showFinalUsage, setShowFinalUsage] = useState(false);
  const [newsExpanded, setNewsExpanded]     = useState(true);
  const [finalExpanded, setFinalExpanded]   = useState(true);
  const [cacheLabel, setCacheLabel]         = useState('');
  const [confirmRefresh, setConfirmRefresh] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAnalysis = useCallback(async () => {
    setStatus('loading');
    setConfirmRefresh(false);
    try {
      const res  = await fetch('/api/ai-analysis', { cache: 'no-store' });
      const json: AIAnalysis & { error?: string } = await res.json();
      if (json.error) { setErrMsg(json.error); setStatus(res.status === 404 ? 'no-data' : 'error'); }
      else { setData(json); setStatus('ok'); }
    } catch (e) {
      setErrMsg(String((e as Error).message ?? e));
      setStatus('error');
    }
  }, []);

  // News is an experimental, separately-scheduled step — a missing key is normal, not
  // an error, so failures here are swallowed rather than surfaced as UI error state.
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-analysis-news', { cache: 'no-store' });
      if (!res.ok) { setNewsData(null); return; }
      const json: NewsAnalysis & { error?: string } = await res.json();
      setNewsData(json.error ? null : json);
    } catch {
      setNewsData(null);
    }
  }, []);

  // Final synthesis is chained after every news run — same graceful-absence handling.
  const fetchFinal = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-analysis-final', { cache: 'no-store' });
      if (!res.ok) { setFinalData(null); return; }
      const json: FinalAnalysis & { error?: string } = await res.json();
      setFinalData(json.error ? null : json);
    } catch {
      setFinalData(null);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchAnalysis();
    fetchNews();
    fetchFinal();
  }, [fetchAnalysis, fetchNews, fetchFinal]);

  // Auto-fetch on mount — the worker regenerates news/final on the order of hours (not
  // seconds), so a page load or the Refresh button is enough; no need to poll.
  useEffect(() => {
    fetchAnalysis();
    fetchNews();
    fetchFinal();
  }, [fetchAnalysis, fetchNews, fetchFinal]);

  // ── Countdown to the next analysis run ──────────────────────────────────────

  useEffect(() => {
    if (!data) return;

    function update() {
      const rem = nextAnalysisRun() - Date.now();
      const h = Math.floor(rem / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      setCacheLabel(h > 0 ? `next update in ${h}h ${m}m` : `next update in ${m}m`);
    }

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [data]);

  // Ties each news item's badge color back to why it was flagged in the AI analysis —
  // works whether or not that analysis has loaded (falls back to a neutral badge when
  // there's nothing to match against, e.g. when the news card renders on its own).
  const tickerTone = (ticker: string): 'pick' | 'risk' | undefined => {
    if (!data) return undefined;
    if (data.topPicks?.some(p => p.ticker === ticker)) return 'pick';
    if (data.riskWatch?.some(p => p.ticker === ticker)) return 'risk';
    return undefined;
  };
  const whyFor = (field: 'topPicks' | 'riskWatch', ticker: string) =>
    data?.selection?.[field]?.find(h => h.ticker === ticker)?.why;

  // ── Shared button style ─────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border-color)',
    cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
    padding: '2px 8px', borderRadius: 5, lineHeight: 1.5,
  };

  // ── Main analysis card ───────────────────────────────────────────────────────
  // Its own card, independent of the news card below — one can be missing/loading/
  // errored while the other renders fine.

  let mainCard: React.ReactNode;

  if (status === 'loading') {
    mainCard = <Skeleton />;
  } else if (status === 'no-data') {
    mainCard = (
      <div style={{ padding: '0.9rem 1rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClaudeIcon size={14} />
        <span>{errMsg || 'No AI analysis found for today yet — check back shortly.'}</span>
      </div>
    );
  } else if (status === 'error') {
    mainCard = (
      <div style={{ padding: '0.9rem 1rem', borderRadius: 8, background: 'rgba(216,90,48,0.06)', border: '1px solid rgba(216,90,48,0.25)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <ClaudeIcon size={14} />
        <span><strong style={{ color: '#D85A30' }}>AI analysis unavailable</strong>{' — '}{errMsg}</span>
      </div>
    );
  } else if (data) {
    mainCard = (
      <div style={{ padding: '1.25rem', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <ClaudeIcon size={16} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>AI Analysis</span>
          <InfoTooltip text="Generated by a separate scheduled worker (Claude) from the latest signal snapshot, once each weekday at 08:15 Bangkok time. The top picks and risk watch tickers are chosen by fixed rules; Claude explains them. This dashboard only reads the result, it never calls Claude itself." />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>

            {/* Refresh / inline confirmation */}
            {!confirmRefresh ? (
              isAnalysisFresh(data.generatedAt) ? (
                <span style={{ ...btnBase, cursor: 'default', opacity: 0.4, border: '1px solid var(--border-color)', display: 'inline-block' }} title="Analysis is already up to date for today">
                  ✓ Up to date
                </span>
              ) : (
                <button onClick={() => setConfirmRefresh(true)} style={btnBase} title="Re-fetch today's analysis from Redis. This app never calls Claude — it just re-reads whatever the worker has already written.">
                  ↻ Refresh
                </button>
              )
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, flexWrap: 'wrap', maxWidth: '100%' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Confirm refresh?
                </span>
                <button onClick={handleRefresh} style={{ ...btnBase, color: '#1D9E75', borderColor: 'rgba(29,158,117,0.4)', fontWeight: 600 }}>
                  Yes
                </button>
                <button onClick={() => setConfirmRefresh(false)} style={btnBase}>Cancel</button>
              </div>
            )}

            {/* Fetch time + countdown */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {data.fetchedAt ? `Generated ${fmtTime(data.fetchedAt)}` : `Generated ${data.generatedAt}`}
              </span>
              {cacheLabel && (
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6, whiteSpace: 'nowrap' }}>
                  {cacheLabel}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Market summary */}
        <div style={{ marginBottom: '1.1rem' }}>
          <SectionLabel info="Overview of the signal environment, signal changes since yesterday, and whether the strategy is beating buy-and-hold.">
            Market overview
          </SectionLabel>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {data.marketSummary}
          </p>
        </div>

        {/* Top picks + Risk watch */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.1rem' }}>
          {data.topPicks?.length > 0 && (
            <div>
              <SectionLabel info="BUY tickers in an uptrend (above the 200-day average, buyers leading), at most 3, picked by fixed rules. 'Clean trend' = also ADX of at least 20, agree of at least 60 and buyers clearly ahead; 'weak trend' falls short on one of those (hover the tag to see which). These are trends to follow, not forecasts.">Top picks</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.topPicks.map(p => <TickerCard key={p.ticker} item={p} tone="pick" signal={signals?.[p.ticker]} why={whyFor('topPicks', p.ticker)} onSelect={onTickerSelect} />)}
              </div>
            </div>
          )}
          {data.riskWatch?.length > 0 && (
            <div>
              <SectionLabel info="Up to 3 tickers to keep an eye on, picked by fixed rules: a signal change today, a fresh SELL, earnings within 7 days, an established downtrend, an unclear trend, or frequent signal flips. The label shows each ticker's actual signal — it isn't always SELL.">Risk watch</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.riskWatch.map(p => <TickerCard key={p.ticker} item={p} tone="risk" signal={signals?.[p.ticker]} why={whyFor('riskWatch', p.ticker)} onSelect={onTickerSelect} />)}
              </div>
            </div>
          )}
        </div>

        {/* Portfolio note */}
        {data.portfolioNote && (
          <div style={{ marginBottom: '1rem' }}>
            <SectionLabel info="Portfolio health, strategy vs buy-and-hold performance, or actionable guidance.">Portfolio note</SectionLabel>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)' }}>
              {data.portfolioNote}
            </p>
          </div>
        )}

        {/* Prompt viewer */}
        {data.prompt && (
          <PromptViewer
            label="prompt sent to Claude"
            prompt={data.prompt}
            show={showPrompt}
            onToggle={() => setShowPrompt(v => !v)}
          />
        )}

        {/* Token usage viewer */}
        {data.tokenUsage && (
          <UsageViewer
            label="token usage"
            usage={data.tokenUsage}
            show={showUsage}
            onToggle={() => setShowUsage(v => !v)}
            note="Cost is the equivalent pay-per-token API price for reference only — this analysis was generated via a Claude subscription (Claude Code CLI), not billed per call."
          />
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-secondary)', opacity: 0.55, marginTop: 4, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
          <ClaudeIcon size={11} />
          <span>Powered by {data.model} · Shared cache · Not financial advice</span>
        </div>

      </div>
    );
  } else {
    mainCard = null;
  }

  // ── News card ────────────────────────────────────────────────────────────────
  // Its own card, entirely independent of mainCard's status above — it reads a
  // separate Redis key written by a separately-scheduled (and experimental, not
  // guaranteed to run) worker step, so it can appear even when the main analysis
  // is still loading, missing, or errored. Badge colors fall back to neutral in
  // that case since there's no topPicks/riskWatch to match against.

  const newsCard = newsData && newsData.newsHighlights?.length > 0 && (
    <div style={{ padding: '1.25rem', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <ClaudeIcon size={16} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Recent News</span>
        <InfoTooltip text="Recent Yahoo Finance headlines for the top picks, risk watch and today's signal changes, read by Claude once each weekday at 20:00 Bangkok time. Each entry says whether the news supports, is neutral to, or goes against the ticker's signal, and links the articles it is based on. 'Major news' = earnings, guidance, a big rating change, deal, ruling or a 5%+ move with a stated cause." />
        {newsData.fetchedAt && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Updated {fmtTime(newsData.fetchedAt)}
          </span>
        )}
      </div>

      <CollapsibleHeader
        title={`${newsData.newsHighlights.length} ticker${newsData.newsHighlights.length === 1 ? '' : 's'} flagged`}
        expanded={newsExpanded}
        onToggle={() => setNewsExpanded(v => !v)}
      />

      {newsExpanded && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {newsData.newsHighlights.map(n => (
              <NewsCard key={n.ticker} item={n} tone={tickerTone(n.ticker)} onSelect={onTickerSelect} />
            ))}
          </div>

          {newsData.prompt && (
            <PromptViewer
              label="prompt sent for news search"
              prompt={newsData.prompt}
              show={showNewsPrompt}
              onToggle={() => setShowNewsPrompt(v => !v)}
            />
          )}

          {newsData.tokenUsage && (
            <UsageViewer
              label="news token usage"
              usage={newsData.tokenUsage}
              show={showNewsUsage}
              onToggle={() => setShowNewsUsage(v => !v)}
              note="Cost is the equivalent pay-per-token API price for reference only — this step also runs via a Claude subscription (Claude Code CLI), not billed per call. It reads more text (the headlines), so usage is typically higher than the signal-only analysis."
            />
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-secondary)', opacity: 0.55, marginTop: 4, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
        <ClaudeIcon size={11} />
        <span>Powered by {newsData.model} · Not financial advice</span>
      </div>

    </div>
  );

  // ── Final recommendation card ───────────────────────────────────────────────
  // Its own card, entirely independent of mainCard/newsCard's status — one stance per
  // ticker from the final step, chained after the news step once a weekday. Shown
  // first: it is the day's bottom line and what the LINE OA broadcasts.

  const finalCard = finalData && finalData.recommendations?.length > 0 && (
    <div style={{ padding: '1.25rem', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <ClaudeIcon size={16} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Final Recommendation</span>
        <InfoTooltip text="The day's bottom line: one stance per ticker, the same one sent to the LINE OA, updated once each weekday at 20:00 Bangkok time. Favor = trend to follow, reasonable to hold or buy; caution = avoid, reduce or wait. The stance is set by rule — favor for a top pick, caution for a risk-watch ticker, switched only by major news that goes against the signal; Claude writes the reasons. Not financial advice." />
        {finalData.fetchedAt && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Updated {fmtTime(finalData.fetchedAt)}
          </span>
        )}
      </div>

      {/* Summary — always visible, it's the headline takeaway */}
      <p style={{ margin: '0 0 1rem', fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)' }}>
        {finalData.summary}
      </p>

      <CollapsibleHeader
        title={`${finalData.recommendations.length} ticker${finalData.recommendations.length === 1 ? '' : 's'}`}
        expanded={finalExpanded}
        onToggle={() => setFinalExpanded(v => !v)}
      />

      {finalExpanded && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {finalData.recommendations.map(r => (
              <FinalCard key={r.ticker} item={r} onSelect={onTickerSelect} />
            ))}
          </div>

          {finalData.prompt && (
            <PromptViewer
              label="prompt sent for final synthesis"
              prompt={finalData.prompt}
              show={showFinalPrompt}
              onToggle={() => setShowFinalPrompt(v => !v)}
            />
          )}

          {finalData.tokenUsage && (
            <UsageViewer
              label="final synthesis token usage"
              usage={finalData.tokenUsage}
              show={showFinalUsage}
              onToggle={() => setShowFinalUsage(v => !v)}
              note="Cost is the equivalent pay-per-token API price for reference only — this step also runs via a Claude subscription (Claude Code CLI), not billed per call. No search or tool access, so usage is typically closer to the signal-only analysis than to the news step."
            />
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-secondary)', opacity: 0.55, marginTop: 4, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
        <ClaudeIcon size={11} />
        <span>Powered by {finalData.model} · Not financial advice</span>
      </div>

    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {finalCard}
      {mainCard}
      {newsCard}
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
