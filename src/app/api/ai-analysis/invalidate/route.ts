import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

// Called by the Refresh button in AIInsights.tsx.
// Busts the shared 'ai-analysis' Data Cache so the next GET to
// /api/ai-analysis re-runs Claude regardless of the daily key.
export async function POST() {
  revalidateTag("ai-analysis");
  return Response.json({ revalidated: true });
}
