import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import { renderTemplate, TemplateKey } from '../../../lib/templates';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const { lead_id, template } = await req.json().catch(() => ({}));
  if (!lead_id || !template) {
    return NextResponse.json({ error: 'Missing lead_id or template' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Supabase config missing' }, { status: 500 });
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if (!lead.email) {
    return NextResponse.json({ error: 'Lead has no email' }, { status: 400 });
  }

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const senderName = process.env.SENDER_NAME || 'Your Name';
  const senderEmail = process.env.SENDER_EMAIL || '';
  const resendApiKey = process.env.RESEND_API_KEY || '';

  if (!senderEmail) {
    return NextResponse.json({ error: 'Missing SENDER_EMAIL env' }, { status: 400 });
  }
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Missing RESEND_API_KEY env' }, { status: 400 });
  }

  const resend = new Resend(resendApiKey);

  // Create email record first to get email_id
  const { data: emailRow, error: emailError } = await supabase
    .from('emails')
    .insert({
      lead_id: lead.id,
      template,
      subject: 'pending',
      body: 'pending',
      to_email: lead.email
    })
    .select('*')
    .single();

  if (emailError || !emailRow) {
    return NextResponse.json({ error: 'Failed to create email record' }, { status: 500 });
  }

  const { subject, text, html } = renderTemplate(lead, template as TemplateKey, baseUrl, emailRow.id);

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to: [lead.email],
    subject,
    text,
    html
  });

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  await supabase
    .from('emails')
    .update({
      subject,
      body: text,
      message_id: sendData?.id || null,
      sent_at: new Date().toISOString()
    })
    .eq('id', emailRow.id);

  const statusMap: Record<string, string> = {
    email1: 'Email 1 Sent',
    email2: 'Email 2 Sent',
    email3: 'Email 3 Sent'
  };

  await supabase
    .from('leads')
    .update({
      status: statusMap[template] || lead.status,
      last_contacted: new Date().toISOString().slice(0, 10)
    })
    .eq('id', lead.id);

  return NextResponse.json({ ok: true, message_id: sendData?.id || null });
}
