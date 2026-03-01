import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const expectedSecret = process.env.RESEND_WEBHOOK_SECRET || '';

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.type || !body?.data) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const eventType = body.type as string;
  const emailId = body.data.email_id as string | undefined;

  if (!['email.bounced', 'email.complained'].includes(eventType)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!emailId) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Supabase config missing' }, { status: 500 });
  }

  // Look up the email record by Resend message_id
  const { data: emailRow } = await supabase
    .from('emails')
    .select('lead_id')
    .eq('message_id', emailId)
    .single();

  if (!emailRow?.lead_id) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const newStatus = eventType === 'email.complained' ? 'Do Not Contact' : 'Not Fit';

  await supabase
    .from('leads')
    .update({ status: newStatus })
    .eq('id', emailRow.lead_id);

  return NextResponse.json({ ok: true, lead_id: emailRow.lead_id, status: newStatus });
}
