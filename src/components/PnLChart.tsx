'use client';

import { useEffect, useRef } from 'react';
import { simulatePnL, type Row } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';

export default function PnLChart({ rows }: { rows: Row[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!rows.length || !canvasRef.current) return;
    let active = true;
    const points = simulatePnL(rows);

    import('chart.js/auto').then(({ default: Chart }) => {
      if (!active || !canvasRef.current) return;
      chartRef.current?.destroy();

      // zero-line annotation via a dataset at y=0
      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: points.map(p => p.date),
          datasets: [
            {
              label: 'Signal strategy',
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
  }, [rows]);

  if (!rows.length) return null;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Simulated P&amp;L — $10,000 starting capital
        <InfoTooltip text="Green area = hypothetical strategy that invests $10,000 on the first BUY signal and sells everything on the first SELL signal, then re-enters on the next BUY. Dashed blue = simple buy-and-hold from day one. The gap between the two lines shows whether following the signals added or destroyed value versus doing nothing. Past results do not guarantee future performance." />
      </div>
      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
