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
  const senderName = process.env.SENDER_NAME || 'SersweAI';
  const fromEmail = 'auto@sersweai.com';
  const resendApiKey = process.env.RESEND_API_KEY || '';

  if (!resendApiKey) {
    return NextResponse.json({ error: 'Missing RESEND_API_KEY env' }, { status: 400 });
  }

  // --- Daily rate limiting (20/day) ---
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const { count: todayCount } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', todayMidnight.toISOString());

  if ((todayCount ?? 0) >= 25) {
    return NextResponse.json(
      { error: 'Daily send limit reached (25/day)' },
      { status: 429 }
    );
  }
  // --- End rate limiting ---

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
    from: `${senderName} <${fromEmail}>`,
    to: [lead.email],
    replyTo: 'sersweai2@gmail.com',
    subject,
    text,
    html,
    scheduledAt: nextBusinessDay8AMPT()
  } as any);

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

  const followUpDays: Record<string, number | null> = {
    email1: 3,
    email2: 7,
    email3: null
  };

  const today = new Date();
  const daysOut = followUpDays[template];
  const next_follow_up = daysOut !== null
    ? nextWeekday(new Date(today.getTime() + daysOut * 86_400_000))
    : null;

  await supabase
    .from('leads')
    .update({
      status: statusMap[template] || lead.status,
      last_contacted: today.toISOString().slice(0, 10),
      ...(template !== 'email3' ? { next_follow_up } : { next_follow_up: null })
    })
    .eq('id', lead.id);

  return NextResponse.json({ ok: true, message_id: sendData?.id || null, scheduledAt: nextBusinessDay8AMPT() });
}

function nextWeekday(date: Date): string {
  const day = date.getUTCDay();
  if (day === 6) date.setUTCDate(date.getUTCDate() + 2); // Sat → Mon
  if (day === 0) date.setUTCDate(date.getUTCDate() + 1); // Sun → Mon
  return date.toISOString().slice(0, 10);
}

function nextBusinessDay8AMPT(): string {
  const next = new Date();
  do {
    next.setDate(next.getDate() + 1);
  } while (['Saturday', 'Sunday'].includes(
    next.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long' })
  ));
  const datePT = next.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  // Determine PST vs PDT offset
  const month = next.getMonth() + 1;
  const day = next.getDate();
  const isDST = (month > 3 && month < 11) ||
    (month === 3 && day >= 8) ||
    (month === 11 && day < 7);
  return `${datePT}T08:00:00${isDST ? '-07:00' : '-08:00'}`;
}
