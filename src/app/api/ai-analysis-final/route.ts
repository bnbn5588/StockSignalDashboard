import Redis from "ioredis";

// Single Redis client reused across warm invocations.
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;

export const dynamic = "force-dynamic";

// The final-synthesis step (worker/main_final.py) reconciles the signal-only analysis
// with the news step into one favor/caution stance per ticker. It's chained
// automatically at the end of every main_news.py run and has no cache-skip — unlike
// ai-analysis:{date}, this key can be overwritten several times a day as the news step
// re-runs. This route just reads whatever's there now; the client is expected to poll.
export async function GET() {
  if (!redis) {
    return Response.json(
      { error: "REDIS_URL not configured — add it to .env.local or Vercel Environment Variables." },
      { status: 503 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `ai-analysis-final:${today}`;
  const promptKey = `ai-analysis-final-prompt:${today}`;

  try {
    const cached = await redis.get(cacheKey);
    if (!cached) {
      return Response.json(
        { error: "No final recommendation found for today yet." },
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
