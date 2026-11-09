import Redis from "ioredis";
import { latestCached } from "@/lib/latestCached";

// Single Redis client reused across warm invocations.
// maxRetriesPerRequest: 1 prevents long hangs on connection failure in serverless.
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;

export const dynamic = "force-dynamic";

// News highlights are an experimental, manually-run follow-on step in the
// stockBot_AI_Insight worker (worker/main_news.py) — not guaranteed to run every day,
// and depends on that day's ai-analysis:{date} already existing. This route just reads
// whatever the worker wrote; a missing key is a normal, expected state (not an error).
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
      (date) => [`ai-analysis-news:${date}`],
      (date) => `ai-analysis-news-prompt:${date}`,
    );
    if (!result) {
      return Response.json({ error: "No news highlights found in the last few days." }, { status: 404 });
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
