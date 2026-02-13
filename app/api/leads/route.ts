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

  return NextResponse.json({ leads: data || [] });
}
