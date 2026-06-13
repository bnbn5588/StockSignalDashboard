# Stock Signal Dashboard

A live Next.js dashboard that reads buy/sell/hold signals from a public Google Sheet and turns them into interactive charts, backtesting stats, and portfolio analytics. Mobile-friendly and deployable to Vercel in one click.

---

## Features

| Section | What it shows |
|---|---|
| **Today's snapshot** | Latest signal, price, day change, period return, and streak for every ticker |
| **High-confidence alerts** | Chips for tickers on a streak of 5+ consecutive same-signal days |
| **Market pulse** | Current BUY/SELL/HOLD split across all tickers + avg next-day return per signal type (historical) |
| **AI Analysis** | Claude-generated market summary, top picks, and risk watch — cached for 24 hours, regenerated once after the daily sheet update |
| **Ticker deep-dive** | Price chart with signal markers sized by streak, monthly signal distribution, confidence-over-time bar chart (streak mode or API % mode) |
| **Simulated P&L** | $10k strategy (follow BUY/SELL signals) vs buy-and-hold, per ticker |
| **Trade performance** | Win rate, avg win/loss, expectancy, max drawdown, avg hold duration, open position banner, full trade log table |
| **Market heatmap** | Dominant signal per ticker per month — spot macro regime shifts at a glance |
| **Portfolio simulation** | Equal-weight portfolio across all tickers, signal strategy vs buy-and-hold |
| **Relative performance** | All tickers indexed to 100 at their first date for fair cross-ticker comparison |

**All charts in the Ticker deep-dive section sync their tooltips** — hover a date on one chart and the others highlight the same date/month automatically. Works on both desktop (mouse) and mobile (touch).

---

## Tech stack

- **Next.js 14** (App Router, server-side ISR caching)
- **React 18** with `dynamic(() => ..., { ssr: false })` for Chart.js
- **Chart.js 4** — line, scatter, bar charts with mixed types
- **TypeScript 5**
- **Google Sheets** public CSV export as data source (no API key needed)
- Deployed on **Vercel** — zero config required

---

## Local development

```bash
# 1. Install dependencies
cd stock-dashboard
npm install

# 2. Set your Google Sheet ID (optional — defaults to the one in .env)
# Edit .env or create .env.local to override:
echo "SHEET_ID=your_sheet_id_here" > .env.local

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

1. Push the `stock-dashboard` folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) 뿯↽ **Add New Project** 뿯↽ import the repo.
3. Vercel auto-detects Next.js. Click **Deploy** — no additional settings needed.
4. *(Optional)* To use a different Google Sheet, go to **Settings 뿯↽ Environment Variables** and add `SHEET_ID` with your sheet's ID.

The API route caches the Google Sheets response for **5 minutes** (ISR). No cold-start latency for visitors after the first request.

---

## Google Sheet format

The sheet named `history` must be **publicly shared** ("Anyone with the link can view") and have this column layout (no header row):

| Col | Content | Example |
|---|---|---|
| 0 | Bot-run timestamp | `2025-10-19 8:00:07` |
| 1 | Ticker symbol | `AAPL` |
| 2 | Signal | `BUY` / `SELL` / `HOLD` |
| 3 | Signal strength | `Weak` / `Moderate` / `Strong` / `Insufficient` |
| 4 | Confidence % | `47.4` |
| 5 | Trend strength string | `Strong (ADX: 60.63)` |
| 6 | Price with `$` prefix | `$252.29` |

Rows are comma-separated and quoted. The bot can write the same trading day multiple times — duplicates are deduplicated automatically by `(date, ticker)` key.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SHEET_ID` | No | value in `.env` | Google Spreadsheet ID from the share URL |
| `ANTHROPIC_API_KEY` | Yes (for AI Analysis) | *(empty)* | Anthropic API key — get yours at [console.anthropic.com](https://console.anthropic.com/) |

Create `.env.local` for local overrides — it is gitignored and takes precedence over `.env`. For Vercel, set both variables in the dashboard under **Settings → Environment Variables**.

> **Without `ANTHROPIC_API_KEY`** the rest of the dashboard works normally — the AI Analysis section displays a "Claude AI unavailable" message instead of insights.

---

## Project structure

```
src/
  app/
    page.tsx                  # Root page, loads Dashboard dynamically (no SSR)
    layout.tsx                # Viewport meta, global font
    globals.css               # CSS variables (light/dark), canvas touch-action
    api/sheet-data/route.ts   # Proxy API: fetches & caches the Google Sheet CSV
    api/ai-analysis/route.ts  # Claude AI: builds prompt from sheet data, calls claude-opus-4-8
  components/
    Dashboard.tsx             # Orchestrator: fetch, parse, layout
    SnapshotTable.tsx         # Today's snapshot table + high-confidence alerts
    ConsensusGauge.tsx        # Market pulse: signal split bars + forward returns
    TickerSection.tsx         # Per-ticker charts with cross-chart tooltip sync
    PnLChart.tsx              # Simulated P&L chart (strategy vs buy-and-hold)
    TradeLog.tsx              # Trade stats chips + open position + trade table
    HeatmapGrid.tsx           # Monthly signal heatmap (CSS grid, no Chart.js)
    PortfolioChart.tsx        # Equal-weight portfolio simulation chart
    NormalizedChart.tsx       # Relative performance chart with ticker toggles
    InfoTooltip.tsx           # Hover/tap info button used throughout
    AIInsights.tsx            # Claude AI analysis card (market summary, picks, risk watch)
  lib/
    analytics.ts              # All pure data functions (no React), fully typed
```
