export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel automatically sends Authorization: Bearer <CRON_SECRET> on every cron invocation.
  // Reject anything that doesn't carry the correct secret.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The cron schedule already limits to Mon–Fri, but guard defensively.
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    return Response.json({ skipped: "weekend" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  // Call /api/ai-analysis via HTTP so it runs through the same route handler and
  // the same unstable_cache instance. Cache populated here = instant responses for
  // all visitors for the rest of the day.
  //
  // VERCEL_PROJECT_PRODUCTION_URL: always the production domain (no protocol prefix).
  // VERCEL_URL: the current deployment URL (fallback for older Vercel setups).
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";

  try {
    const res = await fetch(`${protocol}://${host}/api/ai-analysis`);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return Response.json(
        { error: (body as { error?: string }).error ?? `Analysis endpoint returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json() as { fetchedAt?: string };
    return Response.json({ warmed: true, fetchedAt: data.fetchedAt });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
