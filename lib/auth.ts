import { NextRequest, NextResponse } from 'next/server';

export function requireAuth(req: NextRequest): NextResponse | null {
  const password = process.env.APP_PASSWORD || '';
  if (!password) {
    return null;
  }

  // Check HTTP-only cookie first
  const cookieToken = req.cookies.get('crm_token')?.value;
  if (cookieToken === password) {
    return null;
  }

  // Fall back to Bearer header (backward compatible)
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ') && auth.slice(7) === password) {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
