import Redis from "ioredis";

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

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `ai-analysis-news:${today}`;
  const promptKey = `ai-analysis-news-prompt:${today}`;

  try {
    const cached = await redis.get(cacheKey);
    if (!cached) {
      return Response.json(
        { error: "No news highlights found for today." },
        { status: 404 }
      );
    }

    const result = JSON.parse(cached);

    // Prompt is stored on its own key by the worker — merge it in, but don't fail the
    // whole response if this secondary lookup has trouble.
    try {
      const prompt = await redis.get(promptKey);
      if (prompt) result.prompt = prompt;
    } catch {
      // ignore — prompt display is a nice-to-have, not required
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
