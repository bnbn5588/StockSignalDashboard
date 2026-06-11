// ── Shared types ──────────────────────────────────────────────────────────────

export type Row = { date: string; signal: string; price: number };
export type AllData = Record<string, Row[]>;

export const SIG_COLORS: Record<string, string> = {
  BUY: '#1D9E75',
  SELL: '#D85A30',
  HOLD: '#888780',
};

// ── CSV parsing ───────────────────────────────────────────────────────────────
//
// Sheet format (7 columns, no header row):
//   "2025-10-19 8:00:07","AAPL","BUY","","0","","$252.29"
//
// Col 0 = bot-run timestamp → YYYY-MM-DD (first 10 chars)
// Col 1 = ticker
// Col 2 = signal
// Col 6 = price with $-prefix
//
// The bot runs daily so the same trading-day row appears multiple times;
// we keep only the first occurrence per (date, ticker).

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}

export function parseCSV(csv: string): AllData {
  const data: AllData = {};
  const seen = new Set<string>();

  for (const line of csv.trim().split('\n')) {
    if (!line.trim()) continue;
    const p = splitCSVLine(line);
    if (p.length < 7) continue;

    const date = p[0].trim().slice(0, 10);
    const ticker = p[1].trim();
    const signal = p[2].trim();
    const price = parseFloat(p[6].trim().replace(/[$,]/g, ''));

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!ticker || !signal || isNaN(price) || price <= 0) continue;

    const key = `${date}|${ticker}`;
    if (seen.has(key)) continue;
    seen.add(key);

    (data[ticker] ??= []).push({ date, signal, price });
  }

  for (const rows of Object.values(data)) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
  }

  return data;
}

// ── Streak ────────────────────────────────────────────────────────────────────

/** Consecutive-day run length at each index (same signal as rows[i]). */
export function computeStreaks(rows: Row[]): number[] {
  return rows.map((r, i) => {
    let n = 1;
    for (let j = i - 1; j >= 0 && rows[j].signal === r.signal; j--) n++;
    return n;
  });
}

/** Current signal and how many trailing days share that signal. */
export function currentStreak(rows: Row[]): { signal: string; days: number } {
  if (!rows.length) return { signal: '', days: 0 };
  const sig = rows.at(-1)!.signal;
  let n = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i].signal === sig; i--) n++;
  return { signal: sig, days: n };
}

// ── Simulated P&L ─────────────────────────────────────────────────────────────

export interface PnLPoint {
  date: string;
  strategy: number; // % return, $10 000 starting capital, BUY→enter SELL→exit
  bah: number;      // buy-and-hold % return from same start
}

export function simulatePnL(rows: Row[]): PnLPoint[] {
  if (!rows.length) return [];
  const K = 10_000;
  let cash = K;
  let shares = 0;
  let inPos = false;
  const bahShares = K / rows[0].price;

  return rows.map(row => {
    if (row.signal === 'BUY' && !inPos) {
      shares = cash / row.price;
      cash = 0;
      inPos = true;
    } else if (row.signal === 'SELL' && inPos) {
      cash = shares * row.price;
      shares = 0;
      inPos = false;
    }
    const cur = inPos ? shares * row.price : cash;
    return {
      date: row.date,
      strategy: ((cur - K) / K) * 100,
      bah: ((bahShares * row.price - K) / K) * 100,
    };
  });
}

// ── Today's snapshot ──────────────────────────────────────────────────────────

export interface SnapshotRow {
  ticker: string;
  price: number;
  signal: string;
  date: string;
  firstDate: string;
  tradingDays: number;
  dayChangePct: number;
  periodChangePct: number;
  streak: { signal: string; days: number };
}

export function latestSnapshot(allData: AllData): SnapshotRow[] {
  return Object.entries(allData)
    .map(([ticker, rows]) => {
      const last = rows.at(-1)!;
      const prev = rows.at(-2);
      const first = rows[0];
      return {
        ticker,
        price: last.price,
        signal: last.signal,
        date: last.date,
        firstDate: first?.date ?? '',
        tradingDays: rows.length,
        dayChangePct: prev ? ((last.price - prev.price) / prev.price) * 100 : 0,
        periodChangePct: first ? ((last.price - first.price) / first.price) * 100 : 0,
        streak: currentStreak(rows),
      };
    })
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// ── High-confidence alerts ────────────────────────────────────────────────────

export interface AlertRow {
  ticker: string;
  signal: string;
  days: number;
}

export function highConfidenceAlerts(allData: AllData, minDays = 5): AlertRow[] {
  return Object.entries(allData)
    .map(([ticker, rows]) => ({ ticker, ...currentStreak(rows) }))
    .filter(a => a.days >= minDays && a.signal)
    .sort((a, b) => b.days - a.days);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

/** Dominant signal per (ticker, YYYY-MM) pair. */
export function monthlySignalMap(allData: AllData): {
  tickers: string[];
  months: string[];
  cells: Record<string, Record<string, string>>;
} {
  const cells: Record<string, Record<string, string>> = {};
  const monthSet = new Set<string>();

  for (const [ticker, rows] of Object.entries(allData)) {
    const counts: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      monthSet.add(m);
      counts[m] ??= { BUY: 0, SELL: 0, HOLD: 0 };
      counts[m][r.signal] = (counts[m][r.signal] ?? 0) + 1;
    }
    cells[ticker] = {};
    for (const [m, c] of Object.entries(counts)) {
      cells[ticker][m] = (Object.entries(c).sort((a, b) => b[1] - a[1])[0] ?? ['HOLD'])[0];
    }
  }

  return {
    tickers: Object.keys(cells).sort(),
    months: Array.from(monthSet).sort(),
    cells,
  };
}

export function formatMonth(ym: string): string {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [yr, mo] = ym.split('-');
  return `${names[parseInt(mo) - 1]}'${yr.slice(2)}`;
}

// ── Normalized comparison ─────────────────────────────────────────────────────

/** ticker → Map<date, value normalized to 100 at first date> */
export function normalizeAll(allData: AllData): Record<string, Map<string, number>> {
  const result: Record<string, Map<string, number>> = {};
  for (const [ticker, rows] of Object.entries(allData)) {
    if (!rows.length) continue;
    const base = rows[0].price;
    result[ticker] = new Map(rows.map(r => [r.date, (r.price / base) * 100]));
  }
  return result;
}

/** Latest date string (YYYY-MM-DD) present anywhere in allData. */
export function latestDataDate(allData: AllData): string {
  let latest = '';
  for (const rows of Object.values(allData)) {
    const d = rows.at(-1)?.date ?? '';
    if (d > latest) latest = d;
  }
  return latest;
}

/** All unique dates across all tickers, sorted ascending. */
export function allUniqueDates(allData: AllData): string[] {
  const s = new Set<string>();
  for (const rows of Object.values(allData)) rows.forEach(r => s.add(r.date));
  return Array.from(s).sort();
}
