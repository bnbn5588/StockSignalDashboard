'use client';

import { useEffect, useState } from 'react';
import { SIG_COLORS } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TickerPoint {
  ticker: string;
  reason: string;
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
  revalidate?: number;
  weekend?: boolean;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TickerCard({ item, signal }: { item: TickerPoint; signal: 'BUY' | 'SELL' }) {
  const color = SIG_COLORS[signal];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '0.55rem 0.75rem',
        borderRadius: 8,
        background: signal === 'BUY' ? 'rgba(29,158,117,0.07)' : 'rgba(216,90,48,0.07)',
        border: `1px solid ${color}33`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color,
            padding: '1px 7px',
            borderRadius: 5,
            background: signal === 'BUY' ? 'rgba(29,158,117,0.14)' : 'rgba(216,90,48,0.14)',
            letterSpacing: '0.03em',
          }}
        >
          {item.ticker}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color,
            opacity: 0.75,
          }}
        >
          {signal}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {item.reason}
      </p>
    </div>
  );
}

function SectionLabel({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
      {info && <InfoTooltip text={info} />}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div
      style={{
        padding: '1.25rem',
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <ClaudeIcon size={16} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          AI Analysis
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>
          Analyzing portfolio with Claude…
        </span>
      </div>
      {[80, 60, 90, 50].map((w, i) => (
        <div
          key={i}
          style={{
            height: 11,
            borderRadius: 5,
            background: 'var(--border-color)',
            width: `${w}%`,
            marginBottom: i === 1 ? 18 : 8,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ── Claude icon ───────────────────────────────────────────────────────────────

function ClaudeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0, opacity: 0.8 }}
    >
      <path
        d="M12 2L3 7v10l9 5 9-5V7L12 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M3 7l9 5 9-5M12 12v10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIInsights() {
  const [data, setData]             = useState<AIAnalysis | null>(null);
  const [status, setStatus]         = useState<'loading' | 'error' | 'ok'>('loading');
  const [errMsg, setErrMsg]         = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [cacheLabel, setCacheLabel] = useState('');

  useEffect(() => {
    fetch('/api/ai-analysis')
      .then(r => r.json())
      .then((json: AIAnalysis & { error?: string }) => {
        if (json.error) {
          setErrMsg(json.error);
          setStatus('error');
        } else {
          setData(json);
          setStatus('ok');
        }
      })
      .catch(e => {
        setErrMsg(String(e.message ?? e));
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    if (!data?.fetchedAt || !data?.revalidate) return;
    const expiresAt = new Date(data.fetchedAt).getTime() + data.revalidate * 1000;

    function update() {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) { setCacheLabel('expired'); return; }
      const h = Math.floor(remaining / 3_600_000);
      const m = Math.floor((remaining % 3_600_000) / 60_000);
      setCacheLabel(h > 0 ? `cache expires in ${h}h ${m}m` : `cache expires in ${m}m`);
    }

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [data]);

  if (status === 'loading') return <Skeleton />;

  if (status === 'error') {
    return (
      <div
        style={{
          padding: '0.9rem 1rem',
          borderRadius: 8,
          background: 'rgba(216,90,48,0.06)',
          border: '1px solid rgba(216,90,48,0.25)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <ClaudeIcon size={14} />
        <span>
          <strong style={{ color: '#D85A30' }}>Claude AI unavailable</strong>
          {' — '}{errMsg}
        </span>
      </div>
    );
  }

  if (!data) return null;

  if (data.weekend) {
    return (
      <div
        style={{
          padding: '0.9rem 1rem',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ClaudeIcon size={14} />
        <span>Markets are closed on weekends — AI analysis resumes Monday after the 08:00 AM sheet update.</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1.25rem',
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: '1rem',
        }}
      >
        <ClaudeIcon size={16} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          AI Analysis
        </span>
        <InfoTooltip text="Insights generated by Claude (claude-opus-4-8) from the latest signal snapshot. The model receives ticker signals, streaks, confidence scores, ADX values, and trade performance metrics — and provides a data-driven interpretation. Cached for 24 hours, matching the sheet's daily update schedule." />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            marginLeft: 'auto',
            gap: 2,
          }}
        >
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

      {/* Market summary */}
      <div style={{ marginBottom: '1.1rem' }}>
        <SectionLabel info="An overview of the current signal distribution and any notable regime patterns across the portfolio.">
          Market overview
        </SectionLabel>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)' }}>
          {data.marketSummary}
        </p>
      </div>

      {/* Top picks + Risk watch — side by side on desktop */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.1rem',
        }}
      >
        {/* Top picks */}
        {data.topPicks?.length > 0 && (
          <div>
            <SectionLabel info="Tickers with the strongest current BUY conviction — based on streak length, confidence score, ADX momentum, and historical trade expectancy.">
              Top picks
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.topPicks.map(p => (
                <TickerCard key={p.ticker} item={p} signal="BUY" />
              ))}
            </div>
          </div>
        )}

        {/* Risk watch */}
        {data.riskWatch?.length > 0 && (
          <div>
            <SectionLabel info="Tickers on SELL signals or showing patterns worth monitoring — weak confidence, negative expectancy, or signal instability.">
              Risk watch
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.riskWatch.map(p => (
                <TickerCard key={p.ticker} item={p} signal="SELL" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Portfolio note */}
      {data.portfolioNote && (
        <div style={{ marginBottom: '1rem' }}>
          <SectionLabel info="A high-level take on the portfolio's overall signal health, strategy consistency, or key action items.">
            Portfolio note
          </SectionLabel>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {data.portfolioNote}
          </p>
        </div>
      )}

      {/* Prompt viewer */}
      {data.prompt && (
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => setShowPrompt(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 9 }}>{showPrompt ? '▼' : '▶'}</span>
            {showPrompt ? 'Hide' : 'View'} prompt sent to Claude
          </button>
          {showPrompt && (
            <pre
              style={{
                marginTop: 8,
                padding: '0.75rem',
                borderRadius: 7,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                fontSize: 11,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {data.prompt}
            </pre>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          color: 'var(--text-secondary)',
          opacity: 0.55,
          marginTop: 4,
          borderTop: '1px solid var(--border-color)',
          paddingTop: 10,
        }}
      >
        <ClaudeIcon size={11} />
        <span>Powered by {data.model} · Not financial advice</span>
      </div>
    </div>
  );
}
