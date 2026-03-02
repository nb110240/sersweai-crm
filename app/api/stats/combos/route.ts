import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { requireAuth } from '../../../../lib/auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }

  const { data: leads, error } = await supabase
    .from('leads')
    .select('source_combo, status')
    .not('source_combo', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const comboMap: Record<string, { total: number; bounced: number }> = {};
  for (const lead of leads || []) {
    const combo = lead.source_combo;
    if (!combo) continue;
    if (!comboMap[combo]) comboMap[combo] = { total: 0, bounced: 0 };
    comboMap[combo].total++;
    if (lead.status === 'Not Fit') comboMap[combo].bounced++;
  }

  const combos = Object.entries(comboMap)
    .map(([source_combo, { total, bounced }]) => ({
      source_combo,
      total,
      bounced,
      bounce_rate: total > 0 ? bounced / total : 0,
    }))
    .filter(c => c.bounce_rate > 0.3 && c.total >= 3);

  return NextResponse.json({ combos });
}
