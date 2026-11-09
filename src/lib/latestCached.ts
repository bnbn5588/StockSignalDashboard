import type Redis from "ioredis";

// The worker writes each key under the UTC date it ran on (analysis 01:15 UTC,
// news + final 13:00 UTC). Looking up only today's UTC date left the news and
// final cards empty from 00:00 to 13:00 UTC (07:00–20:00 Bangkok) every day, and
// over the weekend. So walk back day by day to the newest one that exists; the
// card shows its own date, so an older result is never mistaken for today's.

const LOOKBACK_DAYS = 5;

function utcDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Newest cached result among `keys(date)` (tried in order per date), with the
 * prompt from `promptKey(date)` attached when present. Null if none exists in
 * the last LOOKBACK_DAYS days.
 */
export async function latestCached(
  redis: Redis,
  keys: (date: string) => string[],
  promptKey: (date: string) => string,
): Promise<Record<string, unknown> | null> {
  for (let d = 0; d < LOOKBACK_DAYS; d++) {
    const date = utcDate(d);
    for (const key of keys(date)) {
      const cached = await redis.get(key);
      if (!cached) continue;
      const result = JSON.parse(cached);
      try {
        const prompt = await redis.get(promptKey(date));
        if (prompt) result.prompt = prompt;
      } catch {
        // the prompt is optional — the result is still valid without it
      }
      return result;
    }
  }
  return null;
}
