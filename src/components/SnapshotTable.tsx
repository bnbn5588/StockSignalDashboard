'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  latestSnapshot,
  highConfidenceAlerts,
  earningsDays,
  bangkokToday,
  SIG_COLORS,
  type Row,
  type AllData,
  type SnapshotRow,
} from '@/lib/analytics';
import InfoTooltip from './InfoTooltip';
import Term from './Term';
import { useT } from '@/lib/i18n';

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

const plainTh: React.CSSProperties = {
  borderBottom: '1px solid var(--border-color)',
  padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 11,
  color: 'var(--text-secondary)', whiteSpace: 'nowrap',
};

function InfoTh({ label, info }: { label: string; info: string }) {
  return (
    <th style={plainTh}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
        {label}
        <InfoTooltip text={info} />
      </span>
    </th>
  );
}

/** "UP +28/-18" with the direction colored by which DI leads. */
function TrendCell({ row }: { row: Row }) {
  if (!row.regime || row.plusDi === undefined || row.minusDi === undefined) {
    return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  }
  const up = row.plusDi > row.minusDi;
  return (
    <span>
      <span style={{ fontWeight: 600, color: row.regime === 'UP' ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
        {row.regime}
      </span>
      <span style={{ fontSize: 11, marginLeft: 4, color: up ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
        +{row.plusDi.toFixed(0)}/−{row.minusDi.toFixed(0)}
      </span>
    </span>
  );
}

function EarningsCell({ row, today, todayLabel }: { row: Row; today: string; todayLabel: string }) {
  const d = earningsDays(row, today);
  if (d === null || d < 0 || d > 30) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  const soon = d <= 7;
  return (
    <span
      title={row.earnings}
      style={{ fontWeight: soon ? 600 : 400, color: soon ? '#BA7517' : 'var(--text-secondary)' }}
    >
      {soon ? '⚠ ' : ''}{d === 0 ? todayLabel : `${d}d`}
    </span>
  );
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
  label, sortKey: col, active, dir, align, onSort, info, children, sticky,
}: {
  sticky?: boolean;
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
        borderBottom: '1px solid var(--border-color)',
        textAlign: align,
        fontWeight: 500,
        fontSize: 11,
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        ...(sticky ? { position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-primary)' } : {}),
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
  const t        = useT();
  const alerts   = highConfidenceAlerts(allData, 5);
  const today    = bangkokToday();
  const last     = (t: string) => allData[t][allData[t].length - 1];

  // On a phone the table is wider than the screen: show a hint until it is scrolled.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setCanScroll(el.scrollWidth > el.clientWidth + 4 && el.scrollLeft < 8);
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [allData]);

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
            {t('Long-running streaks:', 'สัญญาณที่ไม่เปลี่ยนมานาน:')}
            <InfoTooltip text={t(
              "Tickers that have kept the same signal for 5 or more trading days in a row. A long streak only means the trend hasn't changed in a while — it is not a confidence or accuracy measure (a SELL streak of 100+ days just means the stock has stayed below trend).",
              'หุ้นที่สัญญาณไม่เปลี่ยนติดต่อกัน 5 วันทำการขึ้นไป streak ยาวแปลว่าแนวโน้มไม่เปลี่ยนมานาน ไม่ได้บอกความมั่นใจหรือความแม่นยำ (SELL ติดกัน 100 วันขึ้นไป แค่แปลว่าหุ้นอยู่ใต้แนวโน้มมาตลอด)',
            )} />
          </span>
          {alerts.map(a => (
            <button
              key={a.ticker}
              onClick={() => onTickerSelect?.(a.ticker)}
              title={onTickerSelect ? t(`Jump to ${a.ticker} in Ticker deep-dive`, `ไปที่ ${a.ticker} ในส่วนเจาะลึก`) : undefined}
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
        {t("Today's snapshot — all tickers", 'ภาพรวมวันนี้ — หุ้นทุกตัว')}
        <InfoTooltip text={t(
          "Latest available data row for each ticker. Click a sortable column header to sort. 'Day Δ' is the price change from the previous record. 'Period Δ' is the total return from the ticker's first date. 'Streak' counts consecutive same-signal days. Agree, ADX, Trend and Earnings are the figures the AI analysis refers to. Hover a signal for what it means.",
          "ข้อมูลล่าสุดของหุ้นแต่ละตัว กดหัวคอลัมน์ที่มีลูกศรเพื่อเรียงลำดับ 'Day Δ' คือราคาเปลี่ยนจากวันก่อน 'Period Δ' คือผลตอบแทนรวมตั้งแต่วันแรกของข้อมูล 'Streak' คือจำนวนวันติดกันที่สัญญาณเหมือนเดิม ส่วน Agree, ADX, Trend และ Earnings คือตัวเลขที่บทวิเคราะห์ AI อ้างถึง ชี้ที่สัญญาณเพื่อดูความหมาย",
        )} />
      </div>
      {canScroll && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 4 }}>
          {t('Swipe for more columns →', 'เลื่อนดูคอลัมน์เพิ่ม →')}
        </div>
      )}
      <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              <SortTh label={t('Ticker', 'หุ้น')} sortKey="ticker" align="left" sticky {...thProps} />
              <SortTh label={t('Signal', 'สัญญาณ')} sortKey="signal" align="right" {...thProps} />
              <SortTh label={t('Price', 'ราคา')} sortKey="price" align="right" {...thProps} />
              <SortTh label="Day Δ" sortKey="dayChangePct" align="right" {...thProps} />
              <SortTh label="Period Δ" sortKey="periodChangePct" align="right" {...thProps}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                  Period Δ
                  <InfoTooltip text={t(
                    "Total return from the ticker's first record in the history sheet to its latest. Each ticker may start on a different date — the sub-line inside each cell shows the start month and number of trading days.",
                    'ผลตอบแทนรวมตั้งแต่ข้อมูลแรกของหุ้นตัวนั้นถึงล่าสุด แต่ละตัวอาจเริ่มคนละวัน — บรรทัดเล็กในช่องบอกเดือนที่เริ่มและจำนวนวันทำการ',
                  )} />
                </span>
              </SortTh>
              <SortTh label="Streak" sortKey="streak" align="right" {...thProps} />
              <InfoTh label="Agree" info={t(
                "How many of the engine's 5 trend checks point the same way: 20 = 3 of 5, 60 = 4 of 5, 100 = all 5. It describes how clear the trend is, not a win probability.",
                'จำนวนตัวชี้วัดแนวโน้ม 5 ตัวที่ชี้ไปทางเดียวกัน: 20 = 3 ใน 5, 60 = 4 ใน 5, 100 = ครบ 5 บอกว่าแนวโน้มชัดแค่ไหน ไม่ใช่โอกาสชนะ',
              )} />
              <InfoTh label="ADX" info={t(
                'Trend strength, whatever the direction. Below 20 = weak or no trend, 20–25 = developing, above 25 = strong.',
                'ความแข็งแรงของแนวโน้ม ไม่สนทิศทาง ต่ำกว่า 20 = อ่อนหรือไม่มีแนวโน้ม, 20–25 = กำลังก่อตัว, เกิน 25 = แข็งแรง',
              )} />
              <InfoTh label={t('Trend', 'แนวโน้ม')} info={t(
                'UP/DOWN = price above/below its 200-day average (the long-term trend). +X/−Y = +DI vs −DI: green when buyers lead (+DI higher), red when sellers lead.',
                'UP/DOWN = ราคาอยู่เหนือ/ใต้เส้นค่าเฉลี่ย 200 วัน (แนวโน้มระยะยาว) +X/−Y = +DI เทียบ −DI: เขียวเมื่อฝั่งซื้อนำ (+DI สูงกว่า), แดงเมื่อฝั่งขายนำ',
              )} />
              <InfoTh label={t('Earnings', 'ประกาศงบ')} info={t(
                'Days until the next earnings report (within 30 days). ⚠ = within 7 days: the price can jump either way on the report, which the trend signal cannot anticipate.',
                'อีกกี่วันจะประกาศผลประกอบการ (แสดงเมื่อไม่เกิน 30 วัน) ⚠ = ภายใน 7 วัน: ราคาอาจกระโดดขึ้นหรือลงแรงในวันประกาศ ซึ่งสัญญาณแนวโน้มคาดการณ์ไม่ได้',
              )} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.ticker}
                onClick={() => onTickerSelect?.(row.ticker)}
                title={onTickerSelect ? t(`Jump to ${row.ticker} in Ticker deep-dive`, `ไปที่ ${row.ticker} ในส่วนเจาะลึก`) : undefined}
                style={{
                  background: i % 2 === 0 ? SIG_BG[row.signal] : 'transparent',
                  cursor: onTickerSelect ? 'pointer' : 'default',
                }}
              >
                <td
                  style={{
                    padding: '7px 10px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, position: 'sticky', left: 0, zIndex: 1,
                    // opaque, so scrolled cells don't show through; same tint as the row
                    background: `linear-gradient(${i % 2 === 0 ? SIG_BG[row.signal] : 'transparent'}, ${i % 2 === 0 ? SIG_BG[row.signal] : 'transparent'}), var(--bg-primary)`,
                  }}
                >
                  {row.ticker}
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 600, color: SIG_COLORS[row.signal] }}>
                  <Term id={row.signal}>{row.signal}</Term>
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>
                  ${row.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', color: row.dayChangePct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                  {fmt(row.dayChangePct)}
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', color: row.periodChangePct >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL }}>
                  <div>{fmt(row.periodChangePct, 1)}</div>
                  <div style={{ fontSize: 10, opacity: 0.65, color: 'var(--text-secondary)' }}>
                    {shortDate(row.firstDate)} · {row.tradingDays}d
                  </div>
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', color: SIG_COLORS[row.streak.signal], fontWeight: 500 }}>
                  {row.streak.signal}×{row.streak.days}d
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{last(row.ticker).confidence.toFixed(0)}</td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', color: last(row.ticker).adx < 20 ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                  {last(row.ticker).adx.toFixed(0)}
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', whiteSpace: 'nowrap' }}><TrendCell row={last(row.ticker)} /></td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', whiteSpace: 'nowrap' }}><EarningsCell row={last(row.ticker)} today={today} todayLabel={t('today', 'วันนี้')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
