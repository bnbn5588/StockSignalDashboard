// Cache invalidation is intentionally disabled.
// The AI analysis cache is date-keyed at the server level via unstable_cache.
// Allowing mid-day invalidation would let any client trigger extra Claude API
// calls beyond the one guaranteed per day.
export async function POST() {
  return Response.json(
    { message: "Cache invalidation is not supported. Analysis is generated once per day after 08:30 AM and shared across all clients." },
    { status: 405 }
  );
}
