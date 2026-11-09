'use client';

import React, { useEffect, useState } from 'react';
import { SIG_COLORS } from '@/lib/analytics';
import { useLang, useT } from '@/lib/i18n';
import Term from './Term';

// Shape of `track:summary`, written by stockBot_AI_Insight's worker/track.py.
type HorizonStats = { n: number; meanExcess: number | null; hitRate: number | null };
type GroupStats = { calls: number } & Record<string, HorizonStats | number>;
type Groups = Record<string, GroupStats>;
type RecentCall = { date: string; ticker: string; label: string; entry: string | null } & Record<string, number | string | null>;

interface Summary {
  updatedAt: string;
  liveSince: string;
  benchmark: string;
  horizons: number[];
  engine: { daily: Groups; events: Groups; pending: number };
  ai: { stances: Groups; pending: number; days: number };
  history?: { from: string | null; to: string | null; daily: Groups; events: Groups };
  recentAi: RecentCall[];
}

const LABEL_COLORS: Record<string, string> = {
  favor: SIG_COLORS.BUY,
  caution: '#E67E22',
  ...SIG_COLORS,
};

const fmtX = (v: number | null | undefined) =>
  v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

const cell: React.CSSProperties = { padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' };
const head: React.CSSProperties = { ...cell, fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' };
// First column stays visible while the table scrolls sideways on a phone.
const stick: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-primary)' };

function StatsTable({ title, groups, labels, horizons }: {
  title: string; groups: Groups; labels: string[]; horizons: number[];
}) {
  const t = useT();
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ ...head, ...stick, textAlign: 'left' }}>{t('Call', 'คำแนะนำ')}</th>
              {horizons.map(h => (
                <th key={h} style={head}>
                  {h}d <Term id="hitRate">{t('hit', 'ถูกทาง')}</Term> · {t('avg vs', 'เฉลี่ยเทียบ')} <Term id="spy">SPY</Term>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map(label => {
              const g = groups[label];
              return (
                <tr key={label} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ ...cell, ...stick, textAlign: 'left', fontWeight: 600, color: LABEL_COLORS[label] }}>
                    <Term id={label}>{label}</Term>
                    <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>
                      {' '}({g ? g.calls : 0})
                    </span>
                  </td>
                  {horizons.map(h => {
                    const s = g?.[`h${h}`] as HorizonStats | undefined;
                    if (!s || s.n === 0) return <td key={h} style={{ ...cell, color: 'var(--text-secondary)' }}>{t('pending', 'รอผล')}</td>;
                    return (
                      <td key={h} style={cell}>
                        {s.hitRate == null ? '—' : `${s.hitRate.toFixed(0)}%`}
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}> n={s.n}</span>
                        <div style={{ fontSize: 11, color: (s.meanExcess ?? 0) >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                          {fmtX(s.meanExcess)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TrackRecord() {
  const t = useT();
  const { lang } = useLang();
  const [data, setData] = useState<Summary | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/track', { cache: 'no-store' })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        setData(body);
      })
      .catch(e => setMsg(String((e as Error).message ?? e)));
  }, []);

  if (!data) {
    return <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '2rem' }}>{msg || t('Loading track record…', 'กำลังโหลดผลงาน…')}</p>;
  }

  const { horizons } = data;
  const scored = (g: Groups) => Object.values(g).some(s => (s[`h${horizons[0]}`] as HorizonStats)?.n > 0);
  const anyScored = scored(data.ai.stances) || scored(data.engine.events);
  const updated = new Date(data.updatedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US');

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        {t('Live since', 'เริ่มใช้งานจริง')} <strong style={{ color: 'var(--text-primary)' }}>{data.liveSince}</strong>
        &nbsp;·&nbsp;{t('vs', 'เทียบกับ')} {data.benchmark}&nbsp;·&nbsp;{t('updated', 'อัปเดต')} {updated}
        &nbsp;·&nbsp;{t(
          `${data.ai.days} AI day(s), ${data.ai.pending + data.engine.pending} call(s) awaiting their first 5 trading days`,
          `AI ${data.ai.days} วัน, ${data.ai.pending + data.engine.pending} คำแนะนำกำลังรอครบ 5 วันทำการแรก`,
        )}
      </div>

      {!anyScored && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {t('Tracking has started — results appear once the first calls have been held for 5 trading days.', 'เริ่มเก็บผลแล้ว — ผลจะขึ้นเมื่อคำแนะนำชุดแรกครบ 5 วันทำการ')}
        </p>
      )}

      <StatsTable title={t('AI final stance (the LINE broadcast)', 'คำแนะนำสุดท้ายของ AI (ที่ส่งใน LINE)')} groups={data.ai.stances}
        labels={['favor', 'caution']} horizons={horizons} />
      <StatsTable title={t('Engine signal changes (new BUY / SELL / HOLD)', 'การเปลี่ยนสัญญาณ (BUY / SELL / HOLD ใหม่)')} groups={data.engine.events}
        labels={['BUY', 'SELL', 'HOLD']} horizons={horizons} />

      {data.recentAi.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '1rem' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('Recent AI calls', 'คำแนะนำ AI ล่าสุด')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ ...head, textAlign: 'left' }}>{t('Date', 'วันที่')}</th>
                <th style={{ ...head, textAlign: 'left' }}>{t('Ticker', 'หุ้น')}</th>
                <th style={{ ...head, textAlign: 'left' }}>{t('Stance', 'มุมมอง')}</th>
                {horizons.map(h => <th key={h} style={head}>{h}d {t('vs', 'เทียบ')} SPY</th>)}
              </tr>
            </thead>
            <tbody>
              {data.recentAi.slice(0, 12).map(c => (
                <tr key={`${c.date}-${c.ticker}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ ...cell, textAlign: 'left' }}>{c.date}</td>
                  <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{c.ticker}</td>
                  <td style={{ ...cell, textAlign: 'left', color: LABEL_COLORS[c.label] }}>{c.label}</td>
                  {horizons.map(h => {
                    const v = c[`x${h}`] as number | null;
                    return (
                      <td key={h} style={{ ...cell, color: v == null ? 'var(--text-secondary)' : v >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                        {v == null ? t('pending', 'รอผล') : fmtX(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.history?.from && (
        <>
          <StatsTable
            title={t(
              `Engine signal changes — rebuilt history ${data.history.from} → ${data.history.to} (backtest, not live)`,
              `การเปลี่ยนสัญญาณ — ข้อมูลย้อนหลังที่คำนวณใหม่ ${data.history.from} → ${data.history.to} (backtest ไม่ใช่ผลจริง)`,
            )}
            groups={data.history.events} labels={['BUY', 'SELL', 'HOLD']} horizons={horizons} />
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: -8, marginBottom: '1rem' }}>
            {t(
              "The sheet's pre-go-live rows were recomputed with the v2 engine using only data available on each day, but v2 was chosen after this period was known — treat these as a backtest. AI stances have no history: they can't be regenerated without the model and its news search seeing what happened next.",
              'ข้อมูลก่อนเริ่มใช้งานจริงถูกคำนวณใหม่ด้วยระบบ v2 โดยใช้เฉพาะข้อมูลที่มีในแต่ละวัน แต่ v2 ถูกเลือกหลังจากรู้ผลของช่วงนี้แล้ว — จึงควรมองเป็น backtest ส่วนคำแนะนำของ AI ไม่มีข้อมูลย้อนหลัง เพราะสร้างใหม่ไม่ได้โดยไม่ให้ AI และการค้นข่าวเห็นสิ่งที่เกิดขึ้นภายหลัง',
            )}
          </p>
        </>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {t(
          `Hit = a favor/BUY call beat ${data.benchmark}, or a caution/SELL call trailed it, over the next 5/10/20 trading days (entered at the next open). 50% is a coin flip. With small n the numbers are noise — judge only once n is in the dozens. Not financial advice.`,
          `ถูกทาง = คำแนะนำ favor/BUY ทำได้ดีกว่า ${data.benchmark} หรือ caution/SELL แย่กว่า ${data.benchmark} ในอีก 5/10/20 วันทำการ (นับจากราคาเปิดวันถัดไป) 50% เท่ากับโยนเหรียญ ถ้า n ยังน้อยตัวเลขยังเชื่อไม่ได้ — ควรตัดสินเมื่อ n มีหลายสิบ ไม่ใช่คำแนะนำการลงทุน`,
        )}
      </p>
    </div>
  );
}
