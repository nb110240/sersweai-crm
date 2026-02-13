import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { requireAuth } from '../../../../lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const updates = await req.json().catch(() => ({}));
  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Supabase config missing' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ ...updates })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}
