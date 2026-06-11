'use client';

import { useEffect, useRef } from 'react';
import { portfolioSimulation, type AllData } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

export default function PortfolioChart({ allData }: { allData: AllData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  const tickerCount = Object.keys(allData).length;

  useEffect(() => {
    if (!canvasRef.current || !tickerCount) return;
    let active = true;
    const points = portfolioSimulation(allData);

    import('chart.js/auto').then(({ default: Chart }) => {
      if (!active || !canvasRef.current) return;
      chartRef.current?.destroy();

      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: points.map(p => p.date),
          datasets: [
            {
              label: 'Signal portfolio',
              data: points.map(p => p.strategy),
              borderColor: '#1D9E75',
              backgroundColor: 'rgba(29,158,117,0.08)',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.2,
              fill: true,
              order: 1,
            },
            {
              label: 'Buy & hold',
              data: points.map(p => p.bah),
              borderColor: '#378ADD',
              borderWidth: 1.5,
              borderDash: [4, 3],
              pointRadius: 0,
              tension: 0.2,
              fill: false,
              order: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: { font: { size: 11 }, padding: 10, boxWidth: 16 },
            },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label: (ctx: any) =>
                  ' ' + ctx.dataset.label + ': ' +
                  (ctx.parsed.y >= 0 ? '+' : '') + (ctx.parsed.y as number).toFixed(1) + '%',
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
                callback: (v: any) => (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(0) + '%',
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
  }, [allData, tickerCount]);

  if (!tickerCount) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Equal-weight portfolio — {tickerCount} tickers, $10,000 starting capital
        <InfoTooltip text="Simulates owning an equal slice of each ticker and following all of their signals simultaneously. Green = hypothetical strategy that enters on BUY and exits on SELL for every ticker, then averages the returns. Dashed blue = holding all tickers from day one with no trading. Each ticker's P&L is calculated independently from its own first data date, then averaged into the portfolio return. This shows whether the signal strategy adds value at the portfolio level — not just for any single stock." />
      </div>
      <div style={{ position: 'relative', width: '100%', height: 220 }}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
        Returns are averages across all tickers. Each ticker is included from its own first data date.
      </div>
    </div>
  );
}
