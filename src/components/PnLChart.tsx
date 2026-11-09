'use client';

import { useEffect, useRef } from 'react';
import { simulatePnL, type Row } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';
import { useT } from '@/lib/i18n';

export default function PnLChart({ rows }: { rows: Row[] }) {
  const t = useT();
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
              label: t('Signal strategy', 'กลยุทธ์ตามสัญญาณ'),
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
              label: t('Buy & hold', 'ซื้อแล้วถือยาว'),
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
  }, [rows, t]);

  if (!rows.length) return null;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {t('Simulated P&L — $10,000 starting capital', 'กำไรขาดทุนจำลอง — เงินต้น $10,000')}
        <InfoTooltip text={t(
          'Green area = hypothetical strategy that invests $10,000 on the first BUY signal and sells everything on the first SELL signal, then re-enters on the next BUY. Dashed blue = simple buy-and-hold from day one. The gap between the two lines shows whether following the signals added or destroyed value versus doing nothing. Past results do not guarantee future performance.',
          'พื้นที่สีเขียว = กลยุทธ์สมมติที่ลงเงิน $10,000 เมื่อเกิด BUY ครั้งแรก ขายทั้งหมดเมื่อเกิด SELL แล้วกลับเข้าซื้อเมื่อ BUY ครั้งถัดไป เส้นประสีน้ำเงิน = ซื้อตั้งแต่วันแรกแล้วถือยาว ช่องว่างระหว่างสองเส้นบอกว่าการเทรดตามสัญญาณเพิ่มหรือลดมูลค่าเมื่อเทียบกับการไม่ทำอะไร ผลในอดีตไม่ได้รับประกันอนาคต',
        )} />
      </div>
      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
