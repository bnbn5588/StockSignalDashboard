'use client';

import React from 'react';
import { monthlySignalMap, formatMonth, SIG_COLORS, type AllData } from '@/lib/analytics';

const SIG_FILL: Record<string, string> = {
  BUY: 'rgba(29,158,117,0.28)',
  SELL: 'rgba(216,90,48,0.28)',
  HOLD: 'rgba(136,135,128,0.20)',
};

const SIG_LABEL: Record<string, string> = { BUY: 'B', SELL: 'S', HOLD: 'H' };

export default function HeatmapGrid({ allData }: { allData: AllData }) {
  const { tickers, months, cells } = monthlySignalMap(allData);
  if (!tickers.length) return null;

  const cellW = 46;
  const labelW = 64;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${labelW}px repeat(${months.length}, ${cellW}px)`,
          gap: 3,
          width: labelW + months.length * (cellW + 3),
        }}
      >
        {/* Header row */}
        <div /> {/* corner */}
        {months.map(m => (
          <div
            key={m}
            style={{
              fontSize: 10,
              textAlign: 'center',
              color: 'var(--text-secondary)',
              paddingBottom: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {formatMonth(m)}
          </div>
        ))}

        {/* Data rows */}
        {tickers.map(ticker => (
          <React.Fragment key={ticker}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                paddingRight: 6,
                color: 'var(--text-primary)',
              }}
            >
              {ticker}
            </div>
            {months.map(m => {
              const sig = cells[ticker]?.[m] ?? '';
              return (
                <div
                  key={m}
                  title={sig ? `${ticker} ${m}: ${sig}` : 'No data'}
                  style={{
                    height: 30,
                    borderRadius: 4,
                    background: sig ? SIG_FILL[sig] : 'var(--bg-secondary)',
                    border: sig
                      ? `1px solid ${SIG_COLORS[sig] ?? '#ccc'}55`
                      : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: sig ? SIG_COLORS[sig] : 'transparent',
                  }}
                >
                  {sig ? SIG_LABEL[sig] : ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
