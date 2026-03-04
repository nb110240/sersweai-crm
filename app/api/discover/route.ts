import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/auth';
import { discoverAndImport } from '../../../lib/discover';
import { getAccountInfo } from '../../../lib/serpapi';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  let body: { query?: string; location?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = body.query?.trim();
  const location = body.location?.trim() || 'San Diego, CA';
  const category = body.category?.trim();

  if (!query) {
    return NextResponse.json({ error: 'Missing required field: query' }, { status: 400 });
  }

  try {
    const result = await discoverAndImport(query, location, category);

    // Fetch remaining searches after the search
    let searchesRemaining: number | null = null;
    try {
      const account = await getAccountInfo();
      searchesRemaining = account.searches_remaining;
    } catch {
      // Non-fatal — still return the import results
    }

    return NextResponse.json({
      ...result,
      remaining_searches: searchesRemaining,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discovery failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  try {
    const account = await getAccountInfo();
    return NextResponse.json({
      searches_remaining: account.searches_remaining,
      plan: account.plan,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to check SerpAPI account';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
