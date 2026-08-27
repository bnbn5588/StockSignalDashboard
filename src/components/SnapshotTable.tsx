'use client';

import React, { useState } from 'react';
import {
  latestSnapshot,
  highConfidenceAlerts,
  SIG_COLORS,
  type AllData,
  type SnapshotRow,
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

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = 'ticker' | 'signal' | 'price' | 'dayChangePct' | 'periodChangePct' | 'streak';
type SortDir = 'asc' | 'desc';

function sortValue(row: SnapshotRow, key: SortKey): string | number {
  switch (key) {
    case 'ticker':        return row.ticker;
    case 'signal':        return row.signal;
    case 'price':         return row.price;
    case 'dayChangePct':  return row.dayChangePct;
    case 'periodChangePct': return row.periodChangePct;
    case 'streak':        return row.streak.days;
  }
}

function sortRows(rows: SnapshotRow[], key: SortKey, dir: SortDir): SnapshotRow[] {
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    const cmp = typeof va === 'string'
      ? va.localeCompare(vb as string)
      : (va as number) - (vb as number);
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ── Column header ─────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey: col, active, dir, align, onSort, info, children,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  align: 'left' | 'right';
  onSort: (k: SortKey) => void;
  info?: string;
  children?: React.ReactNode;
}) {
  const isActive = active === col;
  const arrow = isActive ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '6px 10px',
        textAlign: align,
        fontWeight: 500,
        fontSize: 11,
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
        {children ?? label}
        {info && !children && <InfoTooltip text={info} />}
        <span style={{ fontSize: 9, marginLeft: 2, opacity: isActive ? 1 : 0.35 }}>
          {isActive ? arrow : ' ⇅'}
        </span>
      </span>
    </th>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SnapshotTable({
  allData,
  onTickerSelect,
}: {
  allData: AllData;
  onTickerSelect?: (ticker: string) => void;
}) {
  const snapshot = latestSnapshot(allData);
  const alerts   = highConfidenceAlerts(allData, 5);

  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  if (!snapshot.length) return null;

  const sorted = sortRows(snapshot, sortKey, sortDir);

  const thProps = { active: sortKey, dir: sortDir, onSort: handleSort } as const;

  return (
    <div style={{ marginBottom: '2rem' }}>

      {/* ── High-confidence alerts ─────────────────────────────────────────── */}
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
            <button
              key={a.ticker}
              onClick={() => onTickerSelect?.(a.ticker)}
              title={onTickerSelect ? `Jump to ${a.ticker} in Ticker deep-dive` : undefined}
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
                cursor: onTickerSelect ? 'pointer' : 'default',
              }}
            >
              {a.ticker} {a.signal} ×{a.days}d
            </button>
          ))}
        </div>
      )}

      {/* ── Snapshot table ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Today's snapshot — all tickers
        <InfoTooltip text="Latest available data row for each ticker. Click any column header to sort. 'Day Δ' is the price change from the previous record. 'Period Δ' is the total return from the ticker's first date. 'Streak' counts consecutive same-signal days." />
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <SortTh label="Ticker" sortKey="ticker" align="left" {...thProps} />
              <SortTh label="Signal" sortKey="signal" align="right" {...thProps} />
              <SortTh label="Price" sortKey="price" align="right" {...thProps} />
              <SortTh label="Day Δ" sortKey="dayChangePct" align="right" {...thProps} />
              <SortTh label="Period Δ" sortKey="periodChangePct" align="right" {...thProps}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                  Period Δ
                  <InfoTooltip text="Total return from the ticker's first record in the history sheet to its latest. Each ticker may start on a different date — the sub-line inside each cell shows the start month and number of trading days." />
                </span>
              </SortTh>
              <SortTh label="Streak" sortKey="streak" align="right" {...thProps} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.ticker}
                onClick={() => onTickerSelect?.(row.ticker)}
                title={onTickerSelect ? `Jump to ${row.ticker} in Ticker deep-dive` : undefined}
                style={{
                  background: i % 2 === 0 ? SIG_BG[row.signal] : 'transparent',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: onTickerSelect ? 'pointer' : 'default',
                }}
              >
                <td style={{ padding: '7px 10px', fontWeight: 600 }}>{row.ticker}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: SIG_COLORS[row.signal] }}>
                  {row.signal}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                  ${row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: row.dayChangePct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                  {fmt(row.dayChangePct)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: row.periodChangePct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                  <div>{fmt(row.periodChangePct, 1)}</div>
                  <div style={{ fontSize: 10, opacity: 0.65, color: 'var(--text-secondary)' }}>
                    {shortDate(row.firstDate)} · {row.tradingDays}d
                  </div>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: SIG_COLORS[row.streak.signal], fontWeight: 500 }}>
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
