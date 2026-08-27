import Redis from "ioredis";

// Single Redis client reused across warm invocations.
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;

export const dynamic = "force-dynamic";

// Short TTL — long enough to absorb bursts from multiple concurrent visitors (or a
// visitor's own polling interval) without multiplying Finnhub calls, short enough that
// "real-time" still means something. Finnhub's free tier is 60 calls/min per key.
const QUOTE_CACHE_TTL_SECONDS = 10;

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // day high
  l: number; // day low
  o: number; // day open
  pc: number; // previous close
  t: number; // quote timestamp (unix seconds)
}

// Proxies Finnhub so the API key stays server-side. This is a live market quote —
// purely informational context alongside the sheet's once-daily signal snapshot; it
// never feeds into the BUY/SELL/HOLD signals themselves.
export async function GET(req: Request) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "FINNHUB_API_KEY not configured — add it to .env.local or Vercel Environment Variables." },
      { status: 503 }
    );
  }

  const ticker = new URL(req.url).searchParams.get("ticker")?.toUpperCase().trim();
  if (!ticker) {
    return Response.json({ error: "Missing ?ticker= query param." }, { status: 400 });
  }

  const cacheKey = `quote:${ticker}`;

  try {
    const cached = redis ? await redis.get(cacheKey) : null;
    if (cached) return Response.json(JSON.parse(cached));
  } catch {
    // Redis unreachable — fall through to a live fetch
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    const q: FinnhubQuote = await res.json();

    // Finnhub returns all-zero fields (rather than a 404) for an unrecognized symbol.
    if (!q || (q.c === 0 && q.pc === 0)) {
      return Response.json({ error: `No quote available for ${ticker}.` }, { status: 404 });
    }

    const result = {
      ticker,
      price: q.c,
      change: q.d,
      changePercent: q.dp,
      high: q.h,
      low: q.l,
      open: q.o,
      previousClose: q.pc,
      quotedAt: new Date(q.t * 1000).toISOString(),
    };

    try {
      if (redis) await redis.set(cacheKey, JSON.stringify(result), "EX", QUOTE_CACHE_TTL_SECONDS);
    } catch {
      // Redis unreachable — skip cache write, next request just fetches again
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
