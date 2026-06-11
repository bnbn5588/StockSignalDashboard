import { NextResponse } from 'next/server';

// Vercel will cache the entire route response for this many seconds.
// Override the sheet via SHEET_ID env var in the Vercel dashboard if needed.
export const revalidate = 300;

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
    res = await fetch(url, { next: { revalidate: 300 } });
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
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
}
