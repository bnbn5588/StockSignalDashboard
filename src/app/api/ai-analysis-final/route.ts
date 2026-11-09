import Redis from "ioredis";
import { latestCached } from "@/lib/latestCached";

// Single Redis client reused across warm invocations.
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;

export const dynamic = "force-dynamic";

// The final-synthesis step (worker/main_final.py) turns the signal-only analysis and
// the news step into one favor/caution stance per ticker. It is chained at the end of
// main_news.py, which runs once a weekday at 13:00 UTC (20:00 Bangkok).
export async function GET() {
  if (!redis) {
    return Response.json(
      { error: "REDIS_URL not configured — add it to .env.local or Vercel Environment Variables." },
      { status: 503 }
    );
  }

  try {
    const result = await latestCached(
      redis,
      (date) => [`ai-analysis-final:${date}`, `ai-analysis-final-archive:${date}`],
      (date) => `ai-analysis-final-prompt:${date}`,
    );
    if (!result) {
      return Response.json({ error: "No final recommendation found in the last few days." }, { status: 404 });
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
