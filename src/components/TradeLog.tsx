'use client';

import { useMemo } from 'react';
import { tradeStats, computeTrades, SIG_COLORS, type Row } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtPrice = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatChip({ label, value, color, info }: { label: string; value: string; color?: string; info?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: '0.5rem 0.75rem',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, whiteSpace: 'nowrap' }}>
        {label}
        {info && <InfoTooltip text={info} />}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

export default function TradeLog({ rows }: { rows: Row[] }) {
  const stats  = useMemo(() => tradeStats(rows), [rows]);
  const trades = useMemo(() => computeTrades(rows), [rows]);

  if (!rows.length) return null;

  const reversed = [...trades].reverse(); // newest first

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
        Trade performance
        <InfoTooltip text="Statistics computed from the simulated BUY→SELL round trips. Each trade starts on the first BUY after the previous SELL and ends on the next SELL. An open trade means the algorithm is currently in a position with no exit signal yet." />
      </div>

      {/* ── Stat chips ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
        <StatChip label="Trades" value={String(stats.totalTrades)} />
        <StatChip
          label="Win rate"
          value={stats.totalTrades ? Math.round(stats.winRate) + '%' : '—'}
          color={stats.winRate >= 50 ? SIG_COLORS.BUY : SIG_COLORS.SELL}
          info="Percentage of completed trades that closed at a profit."
        />
        <StatChip
          label="Avg win"
          value={stats.avgWin ? fmtPct(stats.avgWin) : '—'}
          color={SIG_COLORS.BUY}
          info="Average return % across all profitable trades."
        />
        <StatChip
          label="Avg loss"
          value={stats.avgLoss ? fmtPct(stats.avgLoss) : '—'}
          color={stats.avgLoss < 0 ? SIG_COLORS.SELL : undefined}
          info="Average return % across all losing trades (negative number)."
        />
        <StatChip
          label="Expectancy"
          value={stats.totalTrades ? fmtPct(stats.expectancy) : '—'}
          color={stats.expectancy >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL}
          info="(Win rate × Avg win) + (Loss rate × Avg loss). Positive means the strategy earns money on average per trade. This is the single most important summary number."
        />
        <StatChip
          label="Max DD"
          value={stats.maxDrawdown ? '−' + stats.maxDrawdown.toFixed(1) + '%' : '—'}
          color={stats.maxDrawdown > 0 ? SIG_COLORS.SELL : undefined}
          info="Max drawdown: the largest peak-to-trough drop in the strategy's equity curve. Measures worst-case pain you'd have experienced holding through a losing stretch."
        />
        <StatChip
          label="Avg hold"
          value={stats.avgDuration ? Math.round(stats.avgDuration) + 'd' : '—'}
          info="Average number of trading days between entering (BUY) and exiting (SELL) a position."
        />
      </div>

      {/* ── Open position banner ────────────────────────────────────────── */}
      {stats.openEntry && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            borderRadius: 7,
            background: 'rgba(29,158,117,0.08)',
            border: '1px solid rgba(29,158,117,0.3)',
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 700, color: SIG_COLORS.BUY }}>OPEN</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Entered {stats.openEntry.entryDate} · {fmtPrice(stats.openEntry.entryPrice)}
          </span>
          <span style={{ fontWeight: 600, color: stats.openEntry.unrealizedPct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
            Unrealized: {fmtPct(stats.openEntry.unrealizedPct)}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {stats.openEntry.durationDays}d held
          </span>
        </div>
      )}

      {/* ── Trade table ─────────────────────────────────────────────────── */}
      {trades.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['#', 'Entry', 'Exit', 'Entry $', 'Exit $', 'Return', 'Days'].map((h, idx) => (
                  <th
                    key={h}
                    style={{
                      padding: '4px 8px',
                      fontWeight: 500,
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      textAlign: idx <= 2 ? 'left' : 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reversed.map((t, idx) => {
                const win = t.returnPct > 0;
                const rowN = trades.length - idx;
                return (
                  <tr
                    key={t.entryDate + t.exitDate}
                    style={{
                      background: win ? 'rgba(29,158,117,0.05)' : 'rgba(216,90,48,0.05)',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{rowN}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{t.entryDate}</td>
                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{t.exitDate}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtPrice(t.entryPrice)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmtPrice(t.exitPrice)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: win ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                      {fmtPct(t.returnPct)}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {t.durationDays}d
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {trades.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          No completed trades yet — the strategy hasn&apos;t completed a full BUY→SELL cycle for this ticker.
        </p>
      )}
    </div>
  );
}
