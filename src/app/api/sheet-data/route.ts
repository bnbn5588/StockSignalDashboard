import { NextResponse } from 'next/server';

// One short, non-stale cache layer only: the edge caches the response for 60s
// (Cache-Control below) and nothing else does. Previously the route segment
// (revalidate), the Google fetch (next.revalidate) and the edge
// (stale-while-revalidate) each cached for 5 min and each served a *stale*
// copy to the first request after expiry while refreshing in the background —
// stacked, a visitor needed 2-3 reloads to see new data.
// Override the sheet via SHEET_ID env var in the Vercel dashboard if needed.
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.SHEET_ID!;
const SHEET_NAME = 'history';

export async function GET() {
  if (!SHEET_ID) {
    return NextResponse.json({ error: 'SHEET_ID environment variable is not set.' }, { status: 500 });
  }

  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    return NextResponse.json({ error: 'Network error fetching sheet' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Google Sheets returned HTTP ${res.status}` },
      { status: 502 },
    );
  }

  const csv = await res.text();

  // Google returns an HTML error page when the sheet is private or not found
  if (csv.trimStart().startsWith('<')) {
    return NextResponse.json(
      { error: 'Sheet not found or not public. Check the Sheet ID and sharing settings.' },
      { status: 404 },
    );
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // no stale-while-revalidate: once expired, the next request waits for a
      // fresh copy instead of being handed the old one
      'Cache-Control': 'public, s-maxage=60',
    },
  });
}
