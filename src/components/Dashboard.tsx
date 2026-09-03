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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  if (!d) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [yr, mo, day] = d.split('-');
  return `${months[parseInt(mo, 10) - 1]} ${parseInt(day, 10)}, ${yr}`;
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
      // no-store: this app's own copy of "freshness" is the server's s-maxage=300
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

  // Poll to match the server's 5-minute cache window (the "refreshes every 5 min" text
  // below), and refetch on tab focus in case the tab was backgrounded/asleep longer
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
        Loading live data from Google Sheets…
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p style={{ padding: '2rem 0', color: '#D85A30' }}>
        Failed to load sheet data: {errMsg}
      </p>
    );
  }

  const tickerCount = Object.keys(allData).length;
  const dataDate = formatDate(latestDataDate(allData));

  return (
    <div>

      {/* ── Latest-data timestamp ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: '1rem', fontSize: 11, color: 'var(--text-secondary)' }}>
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#1D9E75',
            display: 'inline-block', flexShrink: 0,
          }}
        />
        Data as of <strong style={{ color: 'var(--text-primary)' }}>{dataDate}</strong>
        &nbsp;·&nbsp;{tickerCount} tickers&nbsp;·&nbsp;refreshes every 5 min
      </div>

      {/* ── Snapshot + market pulse ──────────────────────────────────────────── */}
      <SnapshotTable allData={allData} onTickerSelect={jumpToTicker} />
      <ConsensusGauge allData={allData} />

      {/* ── Claude AI analysis ───────────────────────────────────────────────── */}
      <Divider
        title="AI Analysis — Claude"
        info="A Claude-powered summary generated from the daily signal snapshot. Cached for 24 hours — Claude is called once per day, after the sheet updates at 08:00 AM. Not financial advice."
      />
      <AIInsights onTickerSelect={jumpToTicker} />

      {/* ── Ticker deep-dive ─────────────────────────────────────────────────── */}
      <div ref={tickerSectionRef}>
        <Divider
          title="Ticker deep-dive"
          info="Select a ticker to see its full price history with signal overlays, monthly distribution, confidence trend, simulated P&L, and a trade-by-trade performance log. Click any ticker in the snapshot table or AI analysis above to jump here."
        />
        <TickerSection allData={allData} selectedTicker={selectedTicker} onTickerChange={setSelectedTicker} />
      </div>

      {/* ── Cross-ticker heatmap ─────────────────────────────────────────────── */}
      <Divider
        title="Market heatmap — dominant signal per month"
        info="Each cell shows the most common signal for that ticker in that calendar month: B = BUY (green), S = SELL (red), H = HOLD (gray). Scan rows for persistent trends and columns for market-wide regime shifts."
      />
      <HeatmapGrid allData={allData} />

      {/* ── Portfolio simulation ─────────────────────────────────────────────── */}
      <Divider
        title="Portfolio simulation — equal weight"
        info="Combines all tickers into one equal-weight portfolio. Each ticker follows its own signals; returns are averaged across all of them. Shows whether the strategy adds value at the portfolio level, not just per stock."
      />
      <PortfolioChart allData={allData} />

      {/* ── Relative performance ─────────────────────────────────────────────── */}
      <Divider
        title="Relative performance — indexed to 100"
        info="Every ticker is rebased to 100 at its own first data point, so lines with different price scales can be compared directly. A line at 150 means the price is up 50 % from its starting date. Use the chips above the chart to show or hide individual tickers."
      />
      <NormalizedChart allData={allData} />

    </div>
  );
}
