import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.RESEND_WEBHOOK_SECRET || '';

  // Check header-based secret (svix-signature from Resend, or custom header)
  const svixSignature = req.headers.get('svix-signature') || '';
  const customSecret = req.headers.get('x-webhook-secret') || '';

  if (!expectedSecret || (svixSignature !== expectedSecret && customSecret !== expectedSecret)) {
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
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
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

  // Both bounces and complaints should prevent future sends
  const newStatus = 'Do Not Contact';

  await supabase
    .from('leads')
    .update({ status: newStatus })
    .eq('id', emailRow.lead_id);

  return NextResponse.json({ ok: true, lead_id: emailRow.lead_id, status: newStatus });
}
