import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deals: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const { lead_id, company_name, stage = 'Discovery', value = 0, notes = '' } = body;

  if (!company_name) return NextResponse.json({ error: 'Missing company_name' }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('deals')
    .insert({ lead_id: lead_id || null, company_name, stage, value, notes })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deal: data });
}
