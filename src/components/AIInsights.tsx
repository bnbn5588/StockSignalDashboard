'use client';

import { useCallback, useEffect, useState } from 'react';
import { SIG_COLORS } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if the analysis was fetched today at or after 08:30 AM — already up to date. */
function isAnalysisFresh(fetchedAt?: string): boolean {
  if (!fetchedAt) return false;
  const fetched = new Date(fetchedAt);
  const cutoff  = new Date();
  cutoff.setHours(8, 30, 0, 0);
  return fetched.toDateString() === new Date().toDateString() && fetched >= cutoff;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TickerPoint { ticker: string; reason: string; }

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
}

interface NewsAnalysis {
  generatedAt: string;
  newsHighlights: NewsHighlight[];
  model: string;
  fetchedAt?: string;
  prompt?: string;
  tokenUsage?: TokenUsage;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TickerCard({ item, signal }: { item: TickerPoint; signal: 'BUY' | 'SELL' }) {
  const color = SIG_COLORS[signal];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0.55rem 0.75rem', borderRadius: 8, background: signal === 'BUY' ? 'rgba(29,158,117,0.07)' : 'rgba(216,90,48,0.07)', border: `1px solid ${color}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, padding: '1px 7px', borderRadius: 5, background: signal === 'BUY' ? 'rgba(29,158,117,0.14)' : 'rgba(216,90,48,0.14)', letterSpacing: '0.03em' }}>
          {item.ticker}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color, opacity: 0.75 }}>{signal}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {item.reason}
      </p>
    </div>
  );
}

function NewsCard({ item, signal }: { item: NewsHighlight; signal?: 'BUY' | 'SELL' }) {
  const color = signal ? SIG_COLORS[signal] : SIG_COLORS.HOLD;
  const badgeBg = signal === 'BUY' ? 'rgba(29,158,117,0.14)' : signal === 'SELL' ? 'rgba(216,90,48,0.14)' : 'rgba(136,135,128,0.14)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0.65rem 0.8rem', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, padding: '1px 7px', borderRadius: 5, background: badgeBg, letterSpacing: '0.03em' }}>
          {item.ticker}
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

export default function AIInsights() {
  const [data, setData]                     = useState<AIAnalysis | null>(null);
  const [status, setStatus]                 = useState<'loading' | 'error' | 'ok' | 'no-data'>('loading');
  const [errMsg, setErrMsg]                 = useState('');
  const [newsData, setNewsData]             = useState<NewsAnalysis | null>(null);
  const [showPrompt, setShowPrompt]         = useState(false);
  const [showUsage, setShowUsage]           = useState(false);
  const [showNewsPrompt, setShowNewsPrompt] = useState(false);
  const [showNewsUsage, setShowNewsUsage]   = useState(false);
  const [newsExpanded, setNewsExpanded]     = useState(true);
  const [cacheLabel, setCacheLabel]         = useState('');
  const [confirmRefresh, setConfirmRefresh] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAnalysis = useCallback(async () => {
    setStatus('loading');
    setConfirmRefresh(false);
    try {
      const res  = await fetch('/api/ai-analysis');
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
      const res = await fetch('/api/ai-analysis-news');
      if (!res.ok) { setNewsData(null); return; }
      const json: NewsAnalysis & { error?: string } = await res.json();
      setNewsData(json.error ? null : json);
    } catch {
      setNewsData(null);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchAnalysis();
    fetchNews();
  }, [fetchAnalysis, fetchNews]);

  // Auto-fetch on mount — the key either exists in Redis or it doesn't.
  useEffect(() => {
    fetchAnalysis();
    fetchNews();
  }, [fetchAnalysis, fetchNews]);

  // ── Countdown to next 08:30 AM ──────────────────────────────────────────────

  useEffect(() => {
    if (!data?.fetchedAt) return;

    function next8h30(): number {
      const d = new Date();
      d.setHours(8, 30, 0, 0);
      if (d <= new Date()) d.setDate(d.getDate() + 1);
      return d.getTime();
    }

    function update() {
      const rem = next8h30() - Date.now();
      const h = Math.floor(rem / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      setCacheLabel(h > 0 ? `refreshes in ${h}h ${m}m` : `refreshes in ${m}m`);
    }

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [data]);

  // ── Non-ok states ───────────────────────────────────────────────────────────

  if (status === 'loading') return <Skeleton />;

  if (status === 'no-data') {
    return (
      <div style={{ padding: '0.9rem 1rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClaudeIcon size={14} />
        <span>{errMsg || 'No AI analysis found for today yet — check back shortly.'}</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '0.9rem 1rem', borderRadius: 8, background: 'rgba(216,90,48,0.06)', border: '1px solid rgba(216,90,48,0.25)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <ClaudeIcon size={14} />
        <span><strong style={{ color: '#D85A30' }}>AI analysis unavailable</strong>{' — '}{errMsg}</span>
      </div>
    );
  }

  if (!data) return null;

  // Ties each news item's badge color back to why it was flagged in the first place.
  const tickerSignal = (ticker: string): 'BUY' | 'SELL' | undefined => {
    if (data.topPicks?.some(p => p.ticker === ticker)) return 'BUY';
    if (data.riskWatch?.some(p => p.ticker === ticker)) return 'SELL';
    return undefined;
  };

  // ── Shared button style ─────────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border-color)',
    cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
    padding: '2px 8px', borderRadius: 5, lineHeight: 1.5,
  };

  // ── Full render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '1.25rem', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <ClaudeIcon size={16} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>AI Analysis</span>
        <InfoTooltip text="Insights generated by a separate scheduled worker (Claude Code, subscription-billed) from the latest signal snapshot. Generated once per day after 08:30 AM — this dashboard only reads the result from Redis, it never calls Claude itself." />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>

          {/* Refresh / inline confirmation */}
          {!confirmRefresh ? (
            isAnalysisFresh(data.fetchedAt) ? (
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
              {data.fetchedAt
                ? `Fetched ${new Date(data.fetchedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                : `Generated ${data.generatedAt}`}
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
            <SectionLabel info="Tickers with the strongest BUY conviction — long streak, high confidence, positive expectancy, strong ADX.">Top picks</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.topPicks.map(p => <TickerCard key={p.ticker} item={p} signal="BUY" />)}
            </div>
          </div>
        )}
        {data.riskWatch?.length > 0 && (
          <div>
            <SectionLabel info="Tickers on SELL signals, weak confidence, negative expectancy, or signal/performance contradictions.">Risk watch</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.riskWatch.map(p => <TickerCard key={p.ticker} item={p} signal="SELL" />)}
            </div>
          </div>
        )}
      </div>

      {/* Recent news — experimental follow-on step, only shown when available */}
      {newsData && newsData.newsHighlights?.length > 0 && (
        <div style={{ marginBottom: '1.1rem' }}>
          <CollapsibleHeader
            title={`Recent news (${newsData.newsHighlights.length})`}
            info="Follow-on web search for recent news on the tickers already flagged above (top picks / risk watch) — checks whether the news reinforces, tempers, or contradicts the quant signal. Generated as a separate, experimental step and not guaranteed to run every day."
            expanded={newsExpanded}
            onToggle={() => setNewsExpanded(v => !v)}
          />
          {newsExpanded && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {newsData.newsHighlights.map(n => (
                  <NewsCard key={n.ticker} item={n} signal={tickerSignal(n.ticker)} />
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
                  note="Cost is the equivalent pay-per-token API price for reference only — this step also runs via a Claude subscription (Claude Code CLI with web search), not billed per call. It runs several tool-use turns, so usage is typically higher than the signal-only analysis above."
                />
              )}
            </>
          )}
        </div>
      )}

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
