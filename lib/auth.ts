import { NextRequest, NextResponse } from 'next/server';

export function requireAuth(req: NextRequest): NextResponse | null {
  const password = process.env.APP_PASSWORD || '';
  if (!password) {
    return null;
  }

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = auth.slice(7);
  if (token !== password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
