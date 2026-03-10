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

  // Use PT midnight (not UTC) so "today" matches the user's timezone
  const ptDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const todayMidnight = new Date(`${ptDate}T00:00:00-08:00`);
  // Correct for DST: re-derive offset dynamically
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' });
  const tzPart = fmt.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || 'GMT-8';
  const offsetMatch = tzPart.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : -8;
  const sign = offsetHours >= 0 ? '+' : '-';
  const abs = String(Math.abs(offsetHours)).padStart(2, '0');
  const todayMidnightPT = new Date(`${ptDate}T00:00:00${sign}${abs}:00`);

  // Monday of the current week (PT)
  const todayPTDate = new Date(todayMidnightPT);
  const dayOfWeek = todayPTDate.getUTCDay(); // 0=Sun,1=Mon,...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayMidnightPT = new Date(todayMidnightPT.getTime() - daysSinceMonday * 86_400_000);

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    { data: leads },
    { data: emailsToday },
    { data: emailsWeek },
    { count: totalEmailsSent },
    { data: recentEmails },
    { data: rawOpens },
    { data: rawClicks },
    { data: pageViewsToday },
    { data: pageViewsWeek },
  ] = await Promise.all([
    supabase.from('leads').select('id, status, email, created_at'),
    supabase.from('emails').select('id, template').gte('sent_at', todayMidnightPT.toISOString()),
    supabase.from('emails').select('id, template').gte('sent_at', mondayMidnightPT.toISOString()),
    supabase.from('emails').select('*', { count: 'exact', head: true }).not('sent_at', 'is', null),
    supabase
      .from('emails')
      .select('id, template, sent_at, to_email, leads(company_name, category)')
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(8),
    // Recent email opens
    supabase
      .from('email_events')
      .select('lead_id, created_at, emails(template), leads(company_name)')
      .eq('event_type', 'open')
      .order('created_at', { ascending: false })
      .limit(100),
    // Recent email clicks
    supabase
      .from('email_events')
      .select('lead_id, url, created_at, emails(template), leads(company_name)')
      .eq('event_type', 'click')
      .order('created_at', { ascending: false })
      .limit(100),
    // Page views today
    supabase
      .from('page_views')
      .select('path, ip_hash, created_at')
      .gte('created_at', todayMidnightPT.toISOString()),
    // Page views this week
    supabase
      .from('page_views')
      .select('path, ip_hash, created_at')
      .gte('created_at', weekAgo.toISOString()),
  ]);

  const byStatus: Record<string, number> = {};
  let withEmail = 0;
  let addedToday = 0;

  for (const lead of leads || []) {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    if (lead.email) withEmail++;
    if (lead.created_at >= todayMidnightPT.toISOString()) addedToday++;
  }

  const emailsByTemplate: Record<string, number> = {};
  for (const e of emailsToday || []) {
    emailsByTemplate[e.template] = (emailsByTemplate[e.template] || 0) + 1;
  }

  // Deduplicate opens: keep most recent per lead
  const opensByLead = new Map<string, any>();
  for (const o of rawOpens || []) {
    if (!o.lead_id || opensByLead.has(o.lead_id)) continue;
    opensByLead.set(o.lead_id, {
      lead_id: o.lead_id,
      company_name: (o.leads as any)?.company_name || 'Unknown',
      template: (o.emails as any)?.template || '',
      opened_at: o.created_at,
    });
  }
  const recentOpens = Array.from(opensByLead.values()).slice(0, 15);

  // Deduplicate clicks: keep most recent per lead
  const clicksByLead = new Map<string, any>();
  for (const c of rawClicks || []) {
    if (!c.lead_id || clicksByLead.has(c.lead_id)) continue;
    let urlHostname = '';
    try { urlHostname = new URL(c.url).hostname; } catch { urlHostname = c.url || ''; }
    clicksByLead.set(c.lead_id, {
      lead_id: c.lead_id,
      company_name: (c.leads as any)?.company_name || 'Unknown',
      url_hostname: urlHostname,
      url: c.url || '',
      clicked_at: c.created_at,
    });
  }
  const recentClicks = Array.from(clicksByLead.values()).slice(0, 15);

  // Aggregate traffic stats
  const pvToday = pageViewsToday || [];
  const pvWeek = pageViewsWeek || [];
  const uniqueTodaySet = new Set(pvToday.map((p: any) => p.ip_hash).filter(Boolean));
  const uniqueWeekSet = new Set(pvWeek.map((p: any) => p.ip_hash).filter(Boolean));

  const pathCounts: Record<string, number> = {};
  for (const p of pvWeek) {
    pathCounts[p.path] = (pathCounts[p.path] || 0) + 1;
  }
  const topPages = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, views]) => ({ path, views }));

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
      totalSent: totalEmailsSent || 0,
      byTemplate: emailsByTemplate,
      recent: recentEmails || [],
    },
    recentOpens,
    recentClicks,
    traffic: {
      viewsToday: pvToday.length,
      viewsThisWeek: pvWeek.length,
      uniqueToday: uniqueTodaySet.size,
      uniqueThisWeek: uniqueWeekSet.size,
      topPages,
    },
  });
}
