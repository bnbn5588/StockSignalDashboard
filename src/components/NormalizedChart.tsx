'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeAll, allUniqueDates, SIG_COLORS, type AllData } from '@/lib/analytics';

// Tableau-10-inspired palette, distinct on both light and dark
const PALETTE = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
];

export default function NormalizedChart({ allData }: { allData: AllData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  const allTickers = Object.keys(allData).sort();
  const [selected, setSelected] = useState<Set<string>>(new Set(allTickers));

  // Keep selected in sync if allData arrives after mount
  useEffect(() => {
    setSelected(new Set(Object.keys(allData).sort()));
  }, [allData]);

  useEffect(() => {
    if (!canvasRef.current || !allTickers.length) return;
    let active = true;

    const dates = allUniqueDates(allData);
    const normalized = normalizeAll(allData);
    const visible = allTickers.filter(t => selected.has(t));

    import('chart.js/auto').then(({ default: Chart }) => {
      if (!active || !canvasRef.current) return;
      chartRef.current?.destroy();

      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: dates,
          datasets: visible.map((ticker, i) => ({
            label: ticker,
            data: dates.map(d => normalized[ticker]?.get(d) ?? null),
            borderColor: PALETTE[allTickers.indexOf(ticker) % PALETTE.length],
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
            fill: false,
            spanGaps: true,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label: (ctx: any) =>
                  ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y as number).toFixed(1),
              },
            },
          },
          scales: {
            x: {
              ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 10, font: { size: 11 } },
              grid: { display: false },
            },
            y: {
              ticks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callback: (v: any) => Number(v).toFixed(0),
                font: { size: 11 },
              },
              grid: { color: 'rgba(128,128,128,0.1)' },
            },
          },
        },
      });
    });

    return () => {
      active = false;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [allData, selected, allTickers]);

  if (!allTickers.length) return null;

  const toggle = (t: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  return (
    <div>
      {/* Ticker toggle chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {allTickers.map((t, i) => {
          const on = selected.has(t);
          const color = PALETTE[i % PALETTE.length];
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              style={{
                padding: '2px 10px',
                borderRadius: 12,
                border: `1.5px solid ${color}`,
                background: on ? color : 'transparent',
                color: on ? '#fff' : color,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative', width: '100%', height: 280 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
        Each ticker indexed to 100 at its own first data point.
      </div>
    </div>
  );
}
