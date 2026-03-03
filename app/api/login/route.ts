import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '../../../lib/rate-limit';

const COOKIE_NAME = 'crm_token';
const MAX_AGE = 604800; // 7 days

export async function POST(req: NextRequest) {
  const blocked = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (blocked) return blocked;

  const { password } = await req.json().catch(() => ({ password: '' }));
  const expected = process.env.APP_PASSWORD || '';

  if (!expected) {
    const res = NextResponse.json({ ok: true });
    return res;
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}

// GET — check if cookie auth is valid (used by client on page load)
export async function GET(req: NextRequest) {
  const expected = process.env.APP_PASSWORD || '';
  if (!expected) {
    return NextResponse.json({ ok: true });
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token === expected) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
