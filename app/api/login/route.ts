import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const expected = process.env.APP_PASSWORD || '';

  if (!expected) {
    return NextResponse.json({ ok: true });
  }

  if (password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
