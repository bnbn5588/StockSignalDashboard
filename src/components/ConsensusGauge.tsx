'use client';

import { useMemo } from 'react';
import {
  marketConsensus,
  aggregateForwardReturns,
  SIG_COLORS,
  type AllData,
} from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

const sgn = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

export default function ConsensusGauge({ allData }: { allData: AllData }) {
  const consensus = useMemo(() => marketConsensus(allData), [allData]);
  const fwd       = useMemo(() => aggregateForwardReturns(allData), [allData]);

  const total = Object.values(consensus).reduce((s, v) => s + v, 0);
  if (!total) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: 10,
        marginBottom: '1.5rem',
      }}
    >
      {/* ── Left: current signal split ───────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Signal split — {total} tickers
          <InfoTooltip text="How many tickers are currently on each signal (latest row per ticker). A dominant BUY means the algorithm is bullish across most of your watchlist right now." />
        </div>
        {(['BUY', 'SELL', 'HOLD'] as const).map(sig => {
          const n = consensus[sig] ?? 0;
          const pct = total ? (n / total) * 100 : 0;
          return (
            <div key={sig} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 32, fontSize: 11, fontWeight: 700, color: SIG_COLORS[sig] }}>{sig}</span>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--border-color)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: SIG_COLORS[sig],
                    borderRadius: 5,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 52, textAlign: 'right' }}>
                {n}/{total} · {Math.round(pct)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Right: avg next-day return per signal ───────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Avg next-day Δ after signal
          <InfoTooltip text="Across all tickers and all history, what was the average price change the day after each signal type? A positive BUY average means that historically, the day after a BUY signal the price went up on average. Larger n = more reliable estimate." />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {['Signal', 'Avg Δ', 'n signals'].map(h => (
                <th key={h} style={{ padding: '3px 6px', fontWeight: 500, fontSize: 11, color: 'var(--text-secondary)', textAlign: h === 'Signal' ? 'left' : 'right' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['BUY', 'SELL', 'HOLD'] as const).map(sig => {
              const { avg, count } = fwd[sig] ?? { avg: 0, count: 0 };
              return (
                <tr key={sig} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '5px 6px', fontWeight: 700, color: SIG_COLORS[sig] }}>{sig}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: avg >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                    {sgn(avg)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {count.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
