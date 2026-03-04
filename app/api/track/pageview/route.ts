import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { path, referrer } = await req.json();
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabase();

    // Privacy-safe IP hashing: daily salt + SHA-256 truncated
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    const salt = `${today}-${process.env.SUPABASE_URL || 'salt'}`;
    const data = new TextEncoder().encode(`${ip}:${salt}`);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const ipHash = Array.from(new Uint8Array(hashBuf)).slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const userAgent = req.headers.get('user-agent') || '';

    await supabase.from('page_views').insert({
      path: path.slice(0, 500),
      referrer: referrer?.slice?.(0, 1000) || null,
      user_agent: userAgent.slice(0, 500),
      ip_hash: ipHash,
    });
  } catch {
    // Always return ok — this is a fire-and-forget beacon
  }

  return NextResponse.json({ ok: true });
}
