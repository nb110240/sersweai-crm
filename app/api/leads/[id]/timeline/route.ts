import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../../lib/supabase';
import { requireAuth } from '../../../../../lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const supabase = getSupabase();

  const [{ data: lead }, { data: emails }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', params.id).single(),
    supabase.from('emails').select('*').eq('lead_id', params.id).order('sent_at', { ascending: true }),
  ]);

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const emailIds = (emails || []).map((e: any) => e.id);
  let events: any[] = [];
  if (emailIds.length > 0) {
    const { data } = await supabase
      .from('email_events')
      .select('*')
      .in('email_id', emailIds)
      .order('created_at', { ascending: true });
    events = data || [];
  }

  const timeline: any[] = [];

  for (const email of (emails || [])) {
    timeline.push({
      type: 'email_sent',
      date: email.sent_at,
      template: email.template,
      subject: email.subject,
      email_id: email.id,
    });
    const emailEvents = events.filter((e: any) => e.email_id === email.id);
    for (const ev of emailEvents) {
      timeline.push({
        type: ev.event_type,
        date: ev.created_at,
        url: ev.url || null,
        email_id: email.id,
        template: email.template,
      });
    }
  }

  if (lead.status === 'Replied' && lead.last_contacted) {
    timeline.push({
      type: 'replied',
      date: lead.last_contacted,
      reply_type: lead.reply_type || null,
    });
  }

  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({ lead, timeline });
}
