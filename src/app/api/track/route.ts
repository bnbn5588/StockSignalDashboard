import Redis from "ioredis";

// Single Redis client reused across warm invocations.
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  : null;

export const dynamic = "force-dynamic";

// Forward-test summary written once a day by the stockBot_AI_Insight worker
// (`python -m worker.track`): live engine signals and AI final stances scored
// against SPY over 5/10/20 trading days. No TTL on the key — it's overwritten
// by each scoring run.
export async function GET() {
  if (!redis) {
    return Response.json(
      { error: "REDIS_URL not configured — add it to .env.local or Vercel Environment Variables." },
      { status: 503 }
    );
  }
  try {
    const raw = await redis.get("track:summary");
    if (!raw) {
      return Response.json({ error: "No track record yet." }, { status: 404 });
    }
    return Response.json(JSON.parse(raw));
  } catch (err) {
    return Response.json({ error: `Redis error: ${(err as Error).message}` }, { status: 502 });
  }
}
