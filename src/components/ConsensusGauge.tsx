'use client';

import { useMemo } from 'react';
import {
  marketConsensus,
  aggregateForwardReturns,
  SIG_COLORS,
  type AllData,
} from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';
import Term from './Term';
import { useT } from '@/lib/i18n';

const sgn = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const HORIZONS = [1, 5, 20];

export default function ConsensusGauge({ allData }: { allData: AllData }) {
  const t = useT();
  const consensus = useMemo(() => marketConsensus(allData), [allData]);
  const fwd = useMemo(
    () => HORIZONS.map(h => aggregateForwardReturns(allData, h)),
    [allData],
  );

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
          {t(`Signal split — ${total} tickers`, `สัดส่วนสัญญาณ — ${total} ตัว`)}
          <InfoTooltip text={t(
            'How many tickers are currently on each signal (latest row per ticker). Mostly BUY = most of the watchlist is in an uptrend right now; mostly SELL = most trends are broken.',
            'จำนวนหุ้นที่อยู่ในแต่ละสัญญาณตอนนี้ (ข้อมูลล่าสุดของแต่ละตัว) BUY เป็นส่วนใหญ่ = หุ้นส่วนใหญ่อยู่ในแนวโน้มขาขึ้น, SELL เป็นส่วนใหญ่ = แนวโน้มส่วนใหญ่เสียแล้ว',
          )} />
        </div>
        {(['BUY', 'SELL', 'HOLD'] as const).map(sig => {
          const n = consensus[sig] ?? 0;
          const pct = total ? (n / total) * 100 : 0;
          return (
            <div key={sig} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 32, fontSize: 11, fontWeight: 700, color: SIG_COLORS[sig] }}><Term id={sig}>{sig}</Term></span>
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
          {t('Avg price change after signal', 'ราคาเปลี่ยนเฉลี่ยหลังสัญญาณ')}
          <InfoTooltip text={t(
            "Across all tickers and all history: the average price change 1, 5 and 20 trading days after each signal. If BUY and SELL averages are close, the signal does not predict returns well — this system's value is avoiding long drawdowns (see Portfolio simulation), not picking winners. n = number of BUY/SELL/HOLD days measured over 1 day.",
            'จากหุ้นทุกตัวและข้อมูลทั้งหมด: ราคาเปลี่ยนเฉลี่ยหลังเกิดสัญญาณ 1, 5 และ 20 วันทำการ ถ้าค่าเฉลี่ยของ BUY กับ SELL ใกล้กัน แปลว่าสัญญาณไม่ได้ทำนายผลตอบแทนได้ดี — จุดเด่นของระบบนี้คือช่วยหลบช่วงขาลงยาว (ดูพอร์ตจำลอง) ไม่ใช่การเลือกหุ้นที่จะขึ้น n = จำนวนวันของ BUY/SELL/HOLD ที่วัดได้ใน 1 วัน',
          )} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              {[t('Signal', 'สัญญาณ'), ...HORIZONS.map(h => `${h}d`), 'n'].map((h, i) => (
                <th key={h} style={{ padding: '3px 6px', fontWeight: 500, fontSize: 11, color: 'var(--text-secondary)', textAlign: i === 0 ? 'left' : 'right' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['BUY', 'SELL', 'HOLD'] as const).map(sig => {
              return (
                <tr key={sig} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '5px 6px', fontWeight: 700, color: SIG_COLORS[sig] }}><Term id={sig}>{sig}</Term></td>
                  {fwd.map((f, i) => {
                    const avg = f[sig]?.avg ?? 0;
                    return (
                      <td key={HORIZONS[i]} style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: avg >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                        {sgn(avg)}
                      </td>
                    );
                  })}
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {(fwd[0][sig]?.count ?? 0).toLocaleString()}
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
