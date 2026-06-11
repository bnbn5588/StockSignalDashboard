'use client';

import React from 'react';
import {
  latestSnapshot,
  highConfidenceAlerts,
  SIG_COLORS,
  type AllData,
} from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

const SIG_BG: Record<string, string> = {
  BUY: 'rgba(29,158,117,0.08)',
  SELL: 'rgba(216,90,48,0.08)',
  HOLD: 'rgba(136,135,128,0.06)',
};

const fmt = (n: number, digits = 2) =>
  (n >= 0 ? '+' : '') + n.toFixed(digits) + '%';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function shortDate(d: string): string {
  if (!d) return '';
  const [yr, mo] = d.split('-');
  return `${MONTH_ABBR[parseInt(mo, 10) - 1]} '${yr.slice(2)}`;
}

export default function SnapshotTable({ allData }: { allData: AllData }) {
  const snapshot = latestSnapshot(allData);
  const alerts = highConfidenceAlerts(allData, 5);

  if (!snapshot.length) return null;

  return (
    <div style={{ marginBottom: '2rem' }}>

      {/* ── Priority 6: High-confidence alerts ─────────────────────────────── */}
      {alerts.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: '1rem',
            padding: '0.6rem 0.75rem',
            background: 'var(--bg-secondary)',
            borderRadius: 8,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 11, color: 'var(--text-secondary)', marginRight: 4 }}>
            High-confidence streaks:
            <InfoTooltip text="Tickers currently on 5 or more consecutive trading days with the same signal. A longer streak means the algorithm hasn't changed its mind in a while — treat it as a conviction indicator, not a guarantee." />
          </span>
          {alerts.map(a => (
            <span
              key={a.ticker}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: SIG_BG[a.signal],
                color: SIG_COLORS[a.signal],
                border: `1px solid ${SIG_COLORS[a.signal]}44`,
              }}
            >
              {a.ticker} {a.signal} ×{a.days}d
            </span>
          ))}
        </div>
      )}

      {/* ── Priority 1: Today's snapshot table ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Today's snapshot — all tickers
        <InfoTooltip text="Latest available data row for each ticker. 'Day Δ' is the price change from the previous record in the sheet. 'Period Δ' is the total return from the very first date in the dataset. 'Streak' counts consecutive trading days with the same signal." />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {[
                { label: 'Ticker', align: 'left' },
                { label: 'Signal', align: 'right' },
                { label: 'Price', align: 'right' },
                { label: 'Day Δ', align: 'right' },
                { label: 'Period Δ', align: 'right' },
                { label: 'Streak', align: 'right' },
              ].map(h => (
                <th
                  key={h.label}
                  style={{
                    padding: '6px 10px',
                    textAlign: h.align as 'left' | 'right',
                    fontWeight: 500,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.label === 'Period Δ' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                      Period Δ
                      <InfoTooltip text="Total return from the ticker's first record in the history sheet to its latest. Each ticker may start on a different date — the sub-line inside each cell shows the start month and number of trading days." />
                    </span>
                  ) : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshot.map((row, i) => (
              <tr
                key={row.ticker}
                style={{
                  background: i % 2 === 0 ? SIG_BG[row.signal] : 'transparent',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{row.ticker}</td>
                <td
                  style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: SIG_COLORS[row.signal],
                  }}
                >
                  {row.signal}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                  ${row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td
                  style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    color: row.dayChangePct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL,
                  }}
                >
                  {fmt(row.dayChangePct)}
                </td>
                <td
                  style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    color: row.periodChangePct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL,
                  }}
                >
                  <div>{fmt(row.periodChangePct, 1)}</div>
                  <div style={{ fontSize: 10, opacity: 0.65, color: 'var(--text-secondary)' }}>
                    {shortDate(row.firstDate)} · {row.tradingDays}d
                  </div>
                </td>
                <td
                  style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    color: SIG_COLORS[row.streak.signal],
                    fontWeight: 500,
                  }}
                >
                  {row.streak.signal}×{row.streak.days}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
