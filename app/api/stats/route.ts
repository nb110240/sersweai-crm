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
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }

  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    { data: leads },
    { data: emailsToday },
    { data: emailsWeek },
    { data: recentEmails },
  ] = await Promise.all([
    supabase.from('leads').select('id, status, email, created_at'),
    supabase.from('emails').select('id, template').gte('sent_at', todayMidnight.toISOString()),
    supabase.from('emails').select('id, template').gte('sent_at', weekAgo.toISOString()),
    supabase
      .from('emails')
      .select('id, template, sent_at, to_email, leads(company_name, category)')
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(8),
  ]);

  const byStatus: Record<string, number> = {};
  let withEmail = 0;
  let addedToday = 0;

  for (const lead of leads || []) {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    if (lead.email) withEmail++;
    if (lead.created_at >= todayMidnight.toISOString()) addedToday++;
  }

  const emailsByTemplate: Record<string, number> = {};
  for (const e of emailsToday || []) {
    emailsByTemplate[e.template] = (emailsByTemplate[e.template] || 0) + 1;
  }

  return NextResponse.json({
    leads: {
      total: leads?.length || 0,
      withEmail,
      addedToday,
      byStatus,
    },
    emails: {
      sentToday: emailsToday?.length || 0,
      sentThisWeek: emailsWeek?.length || 0,
      byTemplate: emailsByTemplate,
      recent: recentEmails || [],
    },
  });
}
