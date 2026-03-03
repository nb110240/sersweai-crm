import { NextRequest, NextResponse } from 'next/server';

type Entry = { count: number; resetTime: number };

const store = new Map<string, Entry>();

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetTime) store.delete(key);
  }
}, 60_000);

export function rateLimit(
  req: NextRequest,
  { limit, windowMs }: { limit: number; windowMs: number }
): NextResponse | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();

  const entry = store.get(ip);
  if (!entry || now > entry.resetTime) {
    store.set(ip, { count: 1, resetTime: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > limit) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetTime - now) / 1000)) } }
    );
  }

  return null;
}
