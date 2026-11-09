'use client';

import { useMemo } from 'react';
import { tradeStats, computeTrades, SIG_COLORS, type Row } from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';
import { useT } from '@/lib/i18n';

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
  const tr     = useT(); // not `t`: the trade rows below are mapped as `t`

  if (!rows.length) return null;

  const reversed = [...trades].reverse(); // newest first

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
        {tr('Trade performance', 'ผลการเทรดจำลอง')}
        <InfoTooltip text={tr(
          'Statistics computed from the simulated BUY→SELL round trips. Each trade starts on the first BUY after the previous SELL and ends on the next SELL. An open trade means the strategy is currently in a position with no exit signal yet.',
          'สถิติจากการซื้อ→ขายจำลองตามสัญญาณ แต่ละรอบเริ่มที่ BUY แรกหลัง SELL ครั้งก่อน และจบที่ SELL ถัดไป รอบที่ยังเปิดอยู่แปลว่ากลยุทธ์กำลังถือหุ้นอยู่และยังไม่มีสัญญาณขาย',
        )} />
      </div>

      {/* ── Stat chips ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
        <StatChip label={tr('Trades', 'จำนวนรอบ')} value={String(stats.totalTrades)} />
        <StatChip
          label={tr('Win rate', 'อัตราชนะ')}
          value={stats.totalTrades ? Math.round(stats.winRate) + '%' : '—'}
          color={stats.winRate >= 50 ? SIG_COLORS.BUY : SIG_COLORS.SELL}
          info={tr(
            'Percentage of completed trades that closed at a profit.',
            'สัดส่วนของรอบที่จบแล้วและได้กำไร',
          )}
        />
        <StatChip
          label={tr('Avg win', 'กำไรเฉลี่ย')}
          value={stats.avgWin ? fmtPct(stats.avgWin) : '—'}
          color={SIG_COLORS.BUY}
          info={tr(
            'Average return % across all profitable trades.',
            'ผลตอบแทนเฉลี่ย (%) ของรอบที่ได้กำไร',
          )}
        />
        <StatChip
          label={tr('Avg loss', 'ขาดทุนเฉลี่ย')}
          value={stats.avgLoss ? fmtPct(stats.avgLoss) : '—'}
          color={stats.avgLoss < 0 ? SIG_COLORS.SELL : undefined}
          info={tr(
            'Average return % across all losing trades (negative number).',
            'ผลตอบแทนเฉลี่ย (%) ของรอบที่ขาดทุน (เป็นค่าติดลบ)',
          )}
        />
        <StatChip
          label={tr('Expectancy', 'Expectancy')}
          value={stats.totalTrades ? fmtPct(stats.expectancy) : '—'}
          color={stats.expectancy >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL}
          info={tr(
            '(Win rate × Avg win) + (Loss rate × Avg loss). Positive means the strategy earns money on average per trade. This is the single most important summary number.',
            '(อัตราชนะ × กำไรเฉลี่ย) + (อัตราแพ้ × ขาดทุนเฉลี่ย) ค่าบวกแปลว่าโดยเฉลี่ยแต่ละรอบได้กำไร เป็นตัวเลขสรุปที่สำคัญที่สุด',
          )}
        />
        <StatChip
          label={tr('Max DD', 'Max DD')}
          value={stats.maxDrawdown ? '−' + stats.maxDrawdown.toFixed(1) + '%' : '—'}
          color={stats.maxDrawdown > 0 ? SIG_COLORS.SELL : undefined}
          info={tr("Max drawdown: the largest peak-to-trough drop in the strategy's equity curve. Measures worst-case pain you'd have experienced holding through a losing stretch.", "Max drawdown: การร่วงจากจุดสูงสุดลงไปจุดต่ำสุดครั้งใหญ่ที่สุดของเงินในพอร์ตจำลอง บอกว่าช่วงที่แย่ที่สุดต้องทนขาดทุนแค่ไหน")}
        />
        <StatChip
          label={tr('Avg hold', 'ถือเฉลี่ย')}
          value={stats.avgDuration ? Math.round(stats.avgDuration) + 'd' : '—'}
          info={tr(
            'Average number of trading days between entering (BUY) and exiting (SELL) a position.',
            'จำนวนวันทำการเฉลี่ยตั้งแต่ซื้อ (BUY) จนขาย (SELL)',
          )}
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
          <span style={{ fontWeight: 700, color: SIG_COLORS.BUY }}>{tr('OPEN', 'ถืออยู่')}</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {tr('Entered', 'เข้าซื้อ')} {stats.openEntry.entryDate} · {fmtPrice(stats.openEntry.entryPrice)}
          </span>
          <span style={{ fontWeight: 600, color: stats.openEntry.unrealizedPct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
            {tr('Unrealized:', 'กำไร/ขาดทุนที่ยังไม่ขาย:')} {fmtPct(stats.openEntry.unrealizedPct)}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {tr(`${stats.openEntry.durationDays}d held`, `ถือมา ${stats.openEntry.durationDays} วัน`)}
          </span>
        </div>
      )}

      {/* ── Trade table ─────────────────────────────────────────────────── */}
      {trades.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['#', tr('Entry', 'วันซื้อ'), tr('Exit', 'วันขาย'), tr('Entry $', 'ราคาซื้อ'), tr('Exit $', 'ราคาขาย'), tr('Return', 'ผลตอบแทน'), tr('Days', 'วัน')].map((h, idx) => (
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
          {tr("No completed trades yet — the strategy hasn't completed a full BUY→SELL cycle for this ticker.", 'ยังไม่มีรอบที่จบ — หุ้นตัวนี้ยังไม่ครบวงจรซื้อ→ขายเลย')}
        </p>
      )}
    </div>
  );
}
