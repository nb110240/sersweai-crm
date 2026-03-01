import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Supabase config missing' }, { status: 500 });
  }
  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (searchParams.get('contact_form_only') === 'true') {
    query = query.is('email', null).not('contact_form_url', 'is', null);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,city.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leadIds = (data || []).map((l: any) => l.id);
  let eventMap: Record<string, { opens: number; clicked: boolean }> = {};

  if (leadIds.length > 0) {
    const { data: events } = await supabase
      .from('email_events')
      .select('lead_id, event_type')
      .in('lead_id', leadIds);

    for (const event of (events || [])) {
      if (!eventMap[event.lead_id]) eventMap[event.lead_id] = { opens: 0, clicked: false };
      if (event.event_type === 'open') eventMap[event.lead_id].opens++;
      if (event.event_type === 'click') eventMap[event.lead_id].clicked = true;
    }
  }

  const leads = (data || []).map((lead: any) => ({
    ...lead,
    opens: eventMap[lead.id]?.opens || 0,
    clicked: eventMap[lead.id]?.clicked || false,
  }));

  return NextResponse.json({ leads });
}
