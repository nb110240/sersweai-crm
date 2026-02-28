import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Supabase config missing' }, { status: 500 });
  }

  // Last 90 days
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString();

  const [emailsResult, leadsResult] = await Promise.all([
    supabase
      .from('emails')
      .select('sent_at, template')
      .gte('sent_at', sinceStr)
      .not('sent_at', 'is', null),
    supabase
      .from('leads')
      .select('created_at')
      .gte('created_at', sinceStr),
  ]);

  const emailsByDate: Record<string, { email1: number; email2: number; email3: number; total: number }> = {};
  for (const email of (emailsResult.data || [])) {
    if (!email.sent_at) continue;
    const day = email.sent_at.split('T')[0];
    if (!emailsByDate[day]) emailsByDate[day] = { email1: 0, email2: 0, email3: 0, total: 0 };
    emailsByDate[day].total++;
    if (email.template === 'email1') emailsByDate[day].email1++;
    if (email.template === 'email2') emailsByDate[day].email2++;
    if (email.template === 'email3') emailsByDate[day].email3++;
  }

  const leadsImportedByDate: Record<string, number> = {};
  for (const lead of (leadsResult.data || [])) {
    if (!lead.created_at) continue;
    const day = lead.created_at.split('T')[0];
    leadsImportedByDate[day] = (leadsImportedByDate[day] || 0) + 1;
  }

  return NextResponse.json({ emailsByDate, leadsImportedByDate });
}
