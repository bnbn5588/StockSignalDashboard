'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCSV, latestDataDate, type AllData } from '@/lib/analytics';
import SnapshotTable from './SnapshotTable';
import ConsensusGauge from './ConsensusGauge';
import TickerSection from './TickerSection';
import HeatmapGrid from './HeatmapGrid';
import PortfolioChart from './PortfolioChart';
import NormalizedChart from './NormalizedChart';
import InfoTooltip from './InfoTooltip';
import AIInsights from './AIInsights';
import TrackRecord from './TrackRecord';
import { LangProvider, LangToggle, useLang, useT } from '@/lib/i18n';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string, lang: string): string {
  if (!d) return '—';
  return new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function Divider({ title, info }: { title: string; info?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2rem 0 1.25rem' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {title}
        {info && <InfoTooltip text={info} />}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <LangProvider>
      <DashboardInner />
    </LangProvider>
  );
}

function DashboardInner() {
  const t = useT();
  const { lang } = useLang();
  const [allData, setAllData] = useState<AllData>({});
  const [status, setStatus] = useState<'loading' | 'error' | 'ok'>('loading');
  const [errMsg, setErrMsg] = useState('');

  // Ticker deep-dive selection is lifted up here so clicking a ticker anywhere else on
  // the page (snapshot table, AI analysis picks/news) can drive it.
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const tickerSectionRef = useRef<HTMLDivElement>(null);

  const jumpToTicker = useCallback((t: string) => {
    setSelectedTicker(t);
    tickerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // silent=true is for background refreshes: skip the loading screen, and on failure
  // keep showing the last good data rather than wiping the whole dashboard over a
  // transient network/sheet hiccup.
  const fetchSheetData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setStatus('loading');
    try {
      // no-store: this app's own copy of "freshness" is the server's s-maxage=60
      // Cache-Control on /api/sheet-data — the browser shouldn't also cache this
      // response on top of that, or a manual reload could still show stale data.
      const r = await fetch('/api/sheet-data', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const csv = await r.text();
      setAllData(parseCSV(csv));
      setStatus('ok');
    } catch (e) {
      if (opts?.silent) return;
      setErrMsg(String((e as Error).message ?? e));
      setStatus('error');
    }
  }, []);

  // Poll every 5 min (the "refreshes every 5 min" text below — the sheet only
  // changes once a day, the server cache is 60s), and refetch on tab focus in case the tab was backgrounded/asleep longer
  // than that — otherwise this only ever fetches once on mount and goes stale until a
  // manual page reload, which is what "the data never updates" reports usually are.
  useEffect(() => {
    fetchSheetData();

    const id = setInterval(() => fetchSheetData({ silent: true }), 5 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchSheetData({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchSheetData]);

  if (status === 'loading') {
    return (
      <p style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
        {t('Loading live data from Google Sheets…', 'กำลังโหลดข้อมูลล่าสุดจาก Google Sheets…')}
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p style={{ padding: '2rem 0', color: '#D85A30' }}>
        {t('Failed to load sheet data:', 'โหลดข้อมูลไม่สำเร็จ:')} {errMsg}
      </p>
    );
  }

  const tickerCount = Object.keys(allData).length;
  const signals = Object.fromEntries(
    Object.entries(allData).map(([t, rows]) => [t, rows[rows.length - 1]?.signal ?? '']),
  );
  const dataDate = formatDate(latestDataDate(allData), lang);

  return (
    <div>

      {/* ── Latest-data timestamp ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: '1rem', fontSize: 11, color: 'var(--text-secondary)' }}>
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#1D9E75',
            display: 'inline-block', flexShrink: 0,
          }}
        />
        {t('Data as of', 'ข้อมูล ณ')} <strong style={{ color: 'var(--text-primary)' }}>{dataDate}</strong>
        &nbsp;·&nbsp;{tickerCount} {t('tickers', 'หุ้น')}&nbsp;·&nbsp;{t('refreshes every 5 min', 'รีเฟรชทุก 5 นาที')}
        <span style={{ marginLeft: 6 }}><LangToggle /></span>
      </div>

      {/* ── Claude AI analysis ───────────────────────────────────────────────── */}
      <Divider
        title={t("Today's calls — Claude", 'คำแนะนำวันนี้ — Claude')}
        info={t(
          'The final recommendation (also sent to the LINE OA) first, then the morning signal analysis and the news it was checked against. Generated by a scheduled worker each weekday: analysis at 08:15, news and final recommendation at 20:00 Bangkok time. Each card shows when it was generated. Not financial advice.',
          'คำแนะนำสุดท้าย (ตัวเดียวกับที่ส่งใน LINE OA) อยู่บนสุด ตามด้วยบทวิเคราะห์สัญญาณตอนเช้า และข่าวที่ใช้ตรวจสอบ ระบบสร้างให้อัตโนมัติทุกวันทำการ: บทวิเคราะห์ 08:15 ข่าวและคำแนะนำสุดท้าย 20:00 (เวลาไทย) แต่ละการ์ดบอกเวลาที่สร้างไว้ ไม่ใช่คำแนะนำการลงทุน',
        )}
      />
      <AIInsights onTickerSelect={jumpToTicker} signals={signals} />

      <Divider
        title={t('Signals — all tickers', 'สัญญาณ — หุ้นทุกตัว')}
        info={t(
          "The engine's latest signal for every ticker, with the figures the AI analysis refers to, and how each signal type has historically performed.",
          'สัญญาณล่าสุดของหุ้นทุกตัว พร้อมตัวเลขที่บทวิเคราะห์ AI อ้างถึง และผลในอดีตของสัญญาณแต่ละแบบ',
        )}
      />
      {/* ── Snapshot + market pulse ──────────────────────────────────────────── */}
      <SnapshotTable allData={allData} onTickerSelect={jumpToTicker} />
      <ConsensusGauge allData={allData} />

      {/* ── Forward-test track record ────────────────────────────────────────── */}
      <Divider
        title={t('Track record — live calls vs SPY', 'ผลงานจริง — เทียบกับ SPY')}
        info={t(
          'How the live calls actually did after go-live: each AI final stance and each engine signal change is scored against SPY over the next 5, 10 and 20 trading days. Updated once a day. Small samples are noise — this becomes meaningful after a couple of months.',
          'คำแนะนำจริงหลังเริ่มใช้งานให้ผลอย่างไร: คำแนะนำสุดท้ายของ AI และการเปลี่ยนสัญญาณแต่ละครั้งถูกเทียบกับ SPY ในอีก 5, 10 และ 20 วันทำการ อัปเดตวันละครั้ง ตัวอย่างน้อยยังเชื่อไม่ได้ — จะเริ่มมีความหมายหลังผ่านไปสักสองสามเดือน',
        )}
      />
      <TrackRecord />

      {/* ── Ticker deep-dive ─────────────────────────────────────────────────── */}
      <div ref={tickerSectionRef}>
        <Divider
          title={t('Ticker deep-dive', 'เจาะลึกรายตัว')}
          info={t(
            'Select a ticker to see its full price history with signal overlays, monthly distribution, streak and agree % over time, simulated P&L, and a trade-by-trade performance log. Click any ticker in the snapshot table or AI analysis above to jump here.',
            'เลือกหุ้นเพื่อดูกราฟราคาทั้งหมดพร้อมจุดสัญญาณ, การกระจายสัญญาณรายเดือน, streak และ agree % ตามเวลา, กำไรขาดทุนจำลอง และบันทึกการเทรดทีละครั้ง กดชื่อหุ้นในตารางหรือในบทวิเคราะห์ AI ด้านบนเพื่อกระโดดมาที่นี่ได้',
          )}
        />
        <TickerSection allData={allData} selectedTicker={selectedTicker} onTickerChange={setSelectedTicker} />
      </div>

      {/* ── Cross-ticker heatmap ─────────────────────────────────────────────── */}
      <Divider
        title={t('Market heatmap — dominant signal per month', 'Heatmap — สัญญาณหลักรายเดือน')}
        info={t(
          'Each cell shows the most common signal for that ticker in that calendar month: B = BUY (green), S = SELL (red), H = HOLD (gray). Scan rows for persistent trends and columns for market-wide regime shifts.',
          'แต่ละช่องคือสัญญาณที่พบบ่อยที่สุดของหุ้นตัวนั้นในเดือนนั้น: B = BUY (เขียว), S = SELL (แดง), H = HOLD (เทา) ดูแนวนอนเพื่อหาแนวโน้มที่ยืดยาว และดูแนวตั้งเพื่อดูการเปลี่ยนภาวะของทั้งตลาด',
        )}
      />
      <HeatmapGrid allData={allData} />

      {/* ── Portfolio simulation ─────────────────────────────────────────────── */}
      <Divider
        title={t('Portfolio simulation — equal weight', 'พอร์ตจำลอง — ถือทุกตัวเท่ากัน')}
        info={t(
          'Combines all tickers into one equal-weight portfolio. Each ticker follows its own signals; returns are averaged across all of them. Shows whether the strategy adds value at the portfolio level, not just per stock.',
          'รวมหุ้นทุกตัวเป็นพอร์ตเดียวในสัดส่วนเท่ากัน แต่ละตัวเทรดตามสัญญาณของตัวเอง แล้วเฉลี่ยผลตอบแทน ใช้ดูว่ากลยุทธ์เพิ่มมูลค่าในระดับพอร์ตหรือไม่ ไม่ใช่แค่รายตัว',
        )}
      />
      <PortfolioChart allData={allData} />

      {/* ── Relative performance ─────────────────────────────────────────────── */}
      <Divider
        title={t('Relative performance — indexed to 100', 'ผลตอบแทนเทียบกัน — ตั้งต้นที่ 100')}
        info={t(
          'Every ticker is rebased to 100 at its own first data point, so lines with different price scales can be compared directly. A line at 150 means the price is up 50 % from its starting date. Use the chips above the chart to show or hide individual tickers.',
          'หุ้นทุกตัวถูกปรับให้เริ่มที่ 100 ณ วันแรกของข้อมูล จึงเทียบกันได้แม้ราคาต่างกันมาก เส้นที่ 150 แปลว่าราคาขึ้น 50% จากวันเริ่มต้น กดปุ่มเหนือกราฟเพื่อซ่อน/แสดงแต่ละตัว',
        )}
      />
      <NormalizedChart allData={allData} />

    </div>
  );
}
