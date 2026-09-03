"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeStreaks,
  currentStreak,
  SIG_COLORS,
  type AllData,
  type Row,
} from "@/lib/analytics";
import PnLChart from "./PnLChart";
import TradeLog from "./TradeLog";
import InfoTooltip from "./InfoTooltip";

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        borderRadius: 8,
        padding: "0.75rem 1rem",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: color ?? "inherit",
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Real-time quote ──────────────────────────────────────────────────────────
// Purely informational context from a third-party API (Finnhub, proxied via
// /api/quote) — never feeds into the sheet-derived BUY/SELL/HOLD signals, which stay
// once-daily. Silently absent (no KPI card) if FINNHUB_API_KEY isn't configured or the
// symbol has no quote, same graceful-omission pattern used elsewhere in this app.

interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  quotedAt: string;
}

const QUOTE_POLL_MS = 20_000;

function useQuote(ticker: string): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!ticker) {
      setQuote(null);
      return;
    }
    let active = true;

    const fetchQuote = async () => {
      try {
        const res = await fetch(
          `/api/quote?ticker=${encodeURIComponent(ticker)}`,
          { cache: "no-store" },
        );
        if (!active) return;
        if (!res.ok) {
          setQuote(null);
          return;
        }
        const json = await res.json();
        setQuote(json.error ? null : json);
      } catch {
        if (active) setQuote(null);
      }
    };

    setQuote(null); // clear stale quote from the previous ticker while the new one loads
    fetchQuote();
    const id = setInterval(fetchQuote, QUOTE_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [ticker]);

  return quote;
}

// ── TickerSection ─────────────────────────────────────────────────────────────

export default function TickerSection({
  allData,
  selectedTicker,
  onTickerChange,
}: {
  allData: AllData;
  // Controlled from Dashboard so clicking a ticker elsewhere (snapshot table, AI
  // analysis picks/news) can drive this section. null = no external selection yet,
  // fall back to the default below.
  selectedTicker: string | null;
  onTickerChange: (ticker: string) => void;
}) {
  // Derive ticker list live from the sheet — no hardcoding
  const tickers = useMemo(() => Object.keys(allData).sort(), [allData]);
  const defaultTicker = tickers.includes("AAPL")
    ? "AAPL"
    : (tickers[0] ?? "AAPL");
  const ticker = selectedTicker ?? defaultTicker;
  const [confMode, setConfMode] = useState<"streak" | "api">("streak");

  // Keep selection valid if tickers list changes
  const safeTicker = allData[ticker] ? ticker : (tickers[0] ?? ticker);

  // Stable reference; only changes when allData or ticker actually changes
  const rows: Row[] = useMemo(
    () => allData[safeTicker] ?? [],
    [allData, safeTicker],
  );

  const quote = useQuote(safeTicker);

  // Three chart canvases: price, signal-bar, confidence
  const priceRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const confRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceChart = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barChart = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confChart = useRef<any>(null);

  useEffect(() => {
    if (
      !rows.length ||
      !priceRef.current ||
      !barRef.current ||
      !confRef.current
    )
      return;
    let active = true;

    import("chart.js/auto").then(({ default: Chart }) => {
      if (!active || !priceRef.current || !barRef.current || !confRef.current)
        return;

      priceChart.current?.destroy();
      barChart.current?.destroy();
      confChart.current?.destroy();

      const labels = rows.map((r) => r.date);
      const prices = rows.map((r) => r.price);
      const streaks = computeStreaks(rows);

      // ── Pre-compute month keys (needed by all three onHover handlers) ────────
      const months: Record<
        string,
        { BUY: number; SELL: number; HOLD: number }
      > = {};
      rows.forEach((r) => {
        const m = r.date.slice(0, 7);
        months[m] ??= { BUY: 0, SELL: 0, HOLD: 0 };
        if (r.signal === "BUY" || r.signal === "SELL" || r.signal === "HOLD") {
          months[m][r.signal]++;
        }
      });
      const mKeys = Object.keys(months).sort();

      // ── Cross-chart sync helpers ─────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syncDailyCharts = (idx: number, skip: any) => {
        for (const ref of [priceChart, confChart]) {
          if (ref.current && ref.current !== skip) {
            ref.current.tooltip.setActiveElements(
              [{ datasetIndex: 0, index: idx }],
              { x: 0, y: 0 },
            );
            ref.current.update("none");
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syncBarChart = (rowIdx: number, skip: any) => {
        if (barChart.current && barChart.current !== skip) {
          const month = rows[rowIdx]?.date.slice(0, 7) ?? "";
          const mIdx = mKeys.indexOf(month);
          if (mIdx >= 0) {
            barChart.current.tooltip.setActiveElements(
              [0, 1, 2].map((di) => ({ datasetIndex: di, index: mIdx })),
              { x: 0, y: 0 },
            );
            barChart.current.update("none");
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearAll = (skip: any) => {
        for (const ref of [priceChart, barChart, confChart]) {
          if (ref.current && ref.current !== skip) {
            ref.current.tooltip.setActiveElements([], { x: 0, y: 0 });
            ref.current.update("none");
          }
        }
      };

      // ── Priority 4: dot radius encodes streak (= confidence) ───────────────
      const dotRadius = (sig: string, i: number) =>
        rows[i].signal === sig ? Math.min(2.5 + streaks[i] * 0.45, 9) : 0;

      // ── Price chart ────────────────────────────────────────────────────────
      priceChart.current = new Chart(priceRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Price",
              data: prices,
              borderColor: "#378ADD",
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.2,
              fill: false,
              order: 1,
            },
            {
              label: "BUY",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              type: "scatter" as any,
              data: rows.map((r) => (r.signal === "BUY" ? r.price : null)),
              pointBackgroundColor: "#1D9E75",
              pointRadius: rows.map((_, i) => dotRadius("BUY", i)),
              pointStyle: "circle",
              showLine: false,
              order: 0,
            },
            {
              label: "SELL",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              type: "scatter" as any,
              data: rows.map((r) => (r.signal === "SELL" ? r.price : null)),
              pointBackgroundColor: "#D85A30",
              pointRadius: rows.map((_, i) => dotRadius("SELL", i)),
              pointStyle: "triangle",
              showLine: false,
              order: 0,
            },
            {
              label: "HOLD",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              type: "scatter" as any,
              data: rows.map((r) => (r.signal === "HOLD" ? r.price : null)),
              pointBackgroundColor: "#888780",
              pointRadius: rows.map((_, i) => dotRadius("HOLD", i)),
              pointStyle: "rect",
              showLine: false,
              order: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index" as const, intersect: false },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onHover: (_e: any, elements: any[]) => {
            if (!elements.length) {
              clearAll(priceChart.current);
              return;
            }
            const idx = elements[0].index as number;
            syncDailyCharts(idx, priceChart.current);
            syncBarChart(idx, priceChart.current);
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label: (ctx: any) => {
                  const y = (ctx.parsed.y as number).toFixed(2);
                  if (ctx.dataset.label === "Price") return ` Price: $${y}`;
                  const streak = streaks[ctx.dataIndex as number];
                  return ` ${ctx.dataset.label}: $${y}  (${streak}d streak)`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                maxRotation: 45,
                autoSkip: true,
                maxTicksLimit: 10,
                font: { size: 11 },
              },
              grid: { display: false },
            },
            y: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ticks: {
                callback: (v: any) => "$" + Number(v).toLocaleString(),
                font: { size: 11 },
              },
              grid: { color: "rgba(128,128,128,0.1)" },
            },
          },
        },
      });

      // ── Signal distribution bar chart ──────────────────────────────────────
      barChart.current = new Chart(barRef.current, {
        type: "bar",
        data: {
          labels: mKeys,
          datasets: [
            {
              label: "BUY",
              data: mKeys.map((m) => months[m].BUY),
              backgroundColor: "#1D9E75",
            },
            {
              label: "SELL",
              data: mKeys.map((m) => months[m].SELL),
              backgroundColor: "#D85A30",
            },
            {
              label: "HOLD",
              data: mKeys.map((m) => months[m].HOLD),
              backgroundColor: "#888780",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index" as const, intersect: false },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onHover: (_e: any, elements: any[]) => {
            if (!elements.length) {
              clearAll(barChart.current);
              return;
            }
            const mIdx = elements[0].index as number;
            // Find the last daily row that belongs to this month and sync daily charts
            const targetMonth = mKeys[mIdx];
            const dayIdx = rows.reduce(
              (best, r, i) => (r.date.startsWith(targetMonth) ? i : best),
              -1,
            );
            if (dayIdx >= 0) {
              syncDailyCharts(dayIdx, barChart.current);
            }
          },
          plugins: { legend: { display: false } },
          scales: {
            x: {
              stacked: true,
              ticks: { font: { size: 11 } },
              grid: { display: false },
            },
            y: {
              stacked: true,
              ticks: { font: { size: 11 } },
              grid: { color: "rgba(128,128,128,0.1)" },
            },
          },
        },
      });

      // ── Priority 4: Confidence over time (streak or API %) ────────────────
      const confData =
        confMode === "streak" ? streaks : rows.map((r) => r.confidence);

      confChart.current = new Chart(confRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label:
                confMode === "streak" ? "Streak (days)" : "API Confidence (%)",
              data: confData,
              backgroundColor: rows.map((r) => SIG_COLORS[r.signal] + "AA"),
              borderColor: rows.map((r) => SIG_COLORS[r.signal]),
              borderWidth: 0,
              borderRadius: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index" as const, intersect: false },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onHover: (_e: any, elements: any[]) => {
            if (!elements.length) {
              clearAll(confChart.current);
              return;
            }
            const idx = elements[0].index as number;
            syncDailyCharts(idx, confChart.current);
            syncBarChart(idx, confChart.current);
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label: (ctx: any) => {
                  const r = rows[ctx.dataIndex as number];
                  return confMode === "streak"
                    ? ` ${r.signal} × ${ctx.parsed.y as number}d streak`
                    : ` ${r.signal} · ${(ctx.parsed.y as number).toFixed(1)}%${r.strength ? ` (${r.strength})` : ""}`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                maxRotation: 45,
                autoSkip: true,
                maxTicksLimit: 10,
                font: { size: 11 },
              },
              grid: { display: false },
            },
            y: {
              ...(confMode === "api" ? { min: 0, max: 100 } : {}),
              ticks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callback: (v: any) =>
                  confMode === "api" ? Number(v).toFixed(0) + "%" : Number(v),
                font: { size: 11 },
              },
              grid: { color: "rgba(128,128,128,0.1)" },
            },
          },
        },
      });
    });

    return () => {
      active = false;
      priceChart.current?.destroy();
      barChart.current?.destroy();
      confChart.current?.destroy();
      priceChart.current = null;
      barChart.current = null;
      confChart.current = null;
    };
  }, [rows, confMode]);

  // ── KPI values ──────────────────────────────────────────────────────────────

  const first = rows[0]?.price;
  const last = rows.at(-1)?.price;
  const lastDate = rows.at(-1)?.date;
  const pctRaw =
    first != null && last != null ? ((last - first) / first) * 100 : null;
  const pct = pctRaw?.toFixed(1) ?? null;
  const latestSignal = rows.at(-1)?.signal ?? "";
  const buyCount = rows.filter((r) => r.signal === "BUY").length;
  const streak = currentStreak(rows);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Ticker selector + legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: "1rem",
        }}
      >
        <select
          value={safeTicker}
          onChange={(e) => onTickerChange(e.target.value)}
          style={{
            padding: "6px 10px",
            fontSize: 13,
            borderRadius: 6,
            border: "0.5px solid var(--border-color)",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {tickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {Object.entries(SIG_COLORS).map(([sig, color]) => (
            <span
              key={sig}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {sig}
            </span>
          ))}
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            (dot size = streak length)
          </span>
        </div>
      </div>

      {/* KPI cards — includes Priority 5: streak card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: "1.25rem",
        }}
      >
        <KpiCard
          label="Signal price"
          value={
            last != null
              ? "$" +
                last.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"
          }
          sub={lastDate ? `close ${lastDate} (drives the signal)` : undefined}
        />
        {quote && (
          <KpiCard
            label="Real-time price"
            value={
              "$" +
              quote.price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            }
            sub={`${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%) · as of ${new Date(quote.quotedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
            color={quote.change >= 0 ? SIG_COLORS.BUY : SIG_COLORS.SELL}
          />
        )}
        <KpiCard
          label="Period change"
          value={
            pct != null ? (parseFloat(pct) >= 0 ? "+" : "") + pct + "%" : "—"
          }
          color={
            pctRaw != null
              ? pctRaw >= 0
                ? SIG_COLORS.BUY
                : SIG_COLORS.SELL
              : undefined
          }
        />
        <KpiCard
          label="Today's signal"
          value={latestSignal || "—"}
          color={SIG_COLORS[latestSignal]}
        />
        <KpiCard label="Buy days" value={`${buyCount} days`} />
        {/* ── Priority 5: Signal streak card ── */}
        <KpiCard
          label="Current streak"
          value={streak.signal ? `${streak.signal} ×${streak.days}d` : "—"}
          sub={
            streak.days >= 10
              ? "High confidence"
              : streak.days >= 5
                ? "Building"
                : undefined
          }
          color={SIG_COLORS[streak.signal]}
        />
      </div>

      {/* Price chart (dot size = streak = Priority 4 confidence) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 6,
          gap: 0,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Price &amp; signals
        </span>
        <InfoTooltip text="Blue line = closing price. Coloured dots mark each day's signal: green circle = BUY, red triangle = SELL, gray square = HOLD. Dot size grows with streak length — a larger dot means the algorithm has held the same signal for more consecutive days (higher confidence)." />
      </div>
      <div style={{ position: "relative", width: "100%", height: 320 }}>
        <canvas
          ref={priceRef}
          role="img"
          aria-label="Price with signal markers sized by streak confidence"
        />
      </div>

      {/* Signal distribution */}
      <div style={{ marginTop: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 8,
            gap: 0,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Signal distribution over time
          </span>
          <InfoTooltip text="Stacked bars show how many trading days in each calendar month received a BUY (green), SELL (red), or HOLD (gray) signal. A month dominated by one color means the algorithm had strong conviction that month." />
        </div>
        <div style={{ position: "relative", width: "100%", height: 140 }}>
          <canvas ref={barRef} />
        </div>
      </div>

      {/* Priority 4: Confidence / streak-length history */}
      <div style={{ marginTop: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Confidence over time
            </span>
            <InfoTooltip text="Two views — toggle between them. Streak: bar height = consecutive days the algorithm has held the same signal; resets to 1 on every signal change. API %: bar height = the confidence score (0–100%) returned by the analysis API for that day — the algorithm's own certainty measure. The bot sends urgent alerts when confidence ≥ 70%." />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["streak", "api"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setConfMode(mode)}
                style={{
                  padding: "2px 10px",
                  fontSize: 11,
                  borderRadius: 5,
                  border: "1px solid var(--border-color)",
                  background:
                    confMode === mode ? "var(--text-secondary)" : "transparent",
                  color:
                    confMode === mode
                      ? "var(--bg-primary)"
                      : "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: confMode === mode ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {mode === "streak" ? "Streak ×d" : "API %"}
              </button>
            ))}
          </div>
        </div>
        {confMode === "api" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div
              style={{ flex: 1, height: 1, background: "var(--border-color)" }}
            />
            <span
              style={{
                fontSize: 10,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              urgent alert threshold
            </span>
            <div
              style={{ flex: 1, height: 1, borderTop: "1px dashed #D85A3088" }}
            />
            <span
              style={{ fontSize: 10, color: SIG_COLORS.SELL, fontWeight: 600 }}
            >
              70%
            </span>
          </div>
        )}
        <div style={{ position: "relative", width: "100%", height: 120 }}>
          <canvas ref={confRef} />
        </div>
      </div>

      {/* Priority 2: Simulated P&L */}
      <PnLChart rows={rows} />

      {/* Trade performance log */}
      <TradeLog rows={rows} />
    </div>
  );
}
