import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

function normalizeRow(row: Record<string, string>) {
  const emailOrUrl = (row.email_or_contact_url || '').trim();
  const isEmail = emailOrUrl.includes('@') && !emailOrUrl.startsWith('http');

  return {
    company_name: row.company_name?.trim() || '',
    category: row.category?.trim() || null,
    zip: row.zip?.trim() || null,
    city: row.city?.trim() || null,
    website: row.website?.trim() || null,
    email: isEmail ? emailOrUrl : null,
    contact_form_url: !isEmail && emailOrUrl ? emailOrUrl : null,
    summary: row.summary?.trim() || null,
    source_url: row.source_url?.trim() || null,
    status: row.status?.trim() || 'Not Contacted',
    last_contacted: row.last_contacted?.trim() || null,
    next_follow_up: row.next_follow_up?.trim() || null,
    reply_type: row.reply_type?.trim() || null,
    notes: row.notes?.trim() || null
  };
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const form = await req.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing CSV file' }, { status: 400 });
  }

  const text = await file.text();
  const records = parse(text, { columns: true, skip_empty_lines: true });
  const rows = records
    .map(normalizeRow)
    .filter((row: any) => row.company_name);

  if (!rows.length) {
    return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Supabase config missing' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('leads')
    .upsert(rows, { onConflict: 'company_name,zip' })
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: data?.length || 0 });
}
