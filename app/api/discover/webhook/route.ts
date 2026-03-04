import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '../../../../lib/rate-limit';
import { discoverAndImport } from '../../../../lib/discover';

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per hour
  const rl = rateLimit(req, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (rl) return rl;

  // Authenticate via webhook secret (no cookie auth)
  const secret = process.env.DISCOVER_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const headerSecret = req.headers.get('x-webhook-secret');
  if (headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discovery failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
