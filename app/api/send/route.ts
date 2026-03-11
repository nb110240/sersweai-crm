import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import { renderTemplate, TemplateKey } from '../../../lib/templates';
import { verifyEmail } from '../../../lib/verify-email';
import { getOptimalSendHour } from '../../../lib/send-time';
import { getWinningVariant } from '../../../lib/ab-winner';
import { Resend } from 'resend';

// Tighter follow-up cadence: Day 3 → Day 7 → Day 12 → Day 18
// Reddit feedback: 1 week gaps are too long for local businesses
const categoryFollowUp: Record<string, Record<string, number>> = {
  'Technology':           { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Real Estate':          { email1: 3, email2: 5, email3: 6, email4: 7 },
  'Health & Wellness':    { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Insurance':            { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Dental & Medical':     { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Legal (Solo/Small)':   { email1: 3, email2: 5, email3: 5, email4: 6 },
  'Financial Advisors':   { email1: 3, email2: 5, email3: 5, email4: 6 },
  'Property Management':  { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Veterinary':           { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Beauty & Fitness':     { email1: 2, email2: 4, email3: 5, email4: 6 },
  'Home Services':        { email1: 2, email2: 4, email3: 5, email4: 6 },
  'Creative & Media':     { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Retail':               { email1: 3, email2: 4, email3: 5, email4: 6 },
  'Food & Beverage':      { email1: 2, email2: 4, email3: 5, email4: 6 },
};

const defaultFollowUpDays: Record<string, number> = {
  email1: 3,
  email2: 4,
  email3: 5,
  email4: 6,
};

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
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
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

  // Verify email domain has valid MX records before sending
  const verification = await verifyEmail(lead.email);
  if (!verification.valid) {
    return NextResponse.json(
      { error: `Email failed verification: ${verification.reason}` },
      { status: 400 }
    );
  }

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const senderName = process.env.SENDER_NAME || 'Neil';
  const fromEmail = 'neil@sersweai.com';
  const resendApiKey = process.env.RESEND_API_KEY || '';

  if (!resendApiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 400 });
  }

  // --- Daily rate limiting (50/day) — use PT midnight ---
  const ptDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const fmtRL = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' });
  const tzRL = fmtRL.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || 'GMT-8';
  const rlMatch = tzRL.match(/GMT([+-]\d+)/);
  const rlOffset = rlMatch ? parseInt(rlMatch[1], 10) : -8;
  const rlSign = rlOffset >= 0 ? '+' : '-';
  const rlAbs = String(Math.abs(rlOffset)).padStart(2, '0');
  const todayMidnightPT = new Date(`${ptDate}T00:00:00${rlSign}${rlAbs}:00`);

  const { count: todayCount } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', todayMidnightPT.toISOString());

  if ((todayCount ?? 0) >= 50) {
    return NextResponse.json(
      { error: 'Daily send limit reached (50/day)' },
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

  // A/B auto-winner: if a variant has proven better, force it
  const winner = await getWinningVariant(supabase, template);
  const renderOptions = winner ? { forceVariant: winner } : undefined;

  const { subject, subjectVariant, text, html } = renderTemplate(lead, template as TemplateKey, baseUrl, emailRow.id, renderOptions);

  // Send time optimization: use best hour from open data instead of always 8 AM
  const optimalHour = await getOptimalSendHour(supabase, lead.category || '');
  const scheduledAt = nextBusinessDayAtHourPT(optimalHour);

  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${lead.id}`;

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: `${senderName} <${fromEmail}>`,
    to: [lead.email],
    replyTo: 'sersweai2@gmail.com',
    subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:sersweai2@gmail.com?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    scheduledAt,
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
      sent_at: new Date().toISOString(),
      ...(subjectVariant ? { subject_variant: subjectVariant } : {})
    })
    .eq('id', emailRow.id);

  const statusMap: Record<string, string> = {
    email1: 'Email 1 Sent',
    email2: 'Email 2 Sent',
    email3: 'Email 3 Sent',
    email4: 'Email 4 Sent',
  };

  // Category-aware follow-up interval (Feature 9)
  const daysOut = categoryFollowUp[lead.category]?.[template] ?? defaultFollowUpDays[template] ?? null;

  const today = new Date();
  const next_follow_up = daysOut !== null
    ? nextWeekday(new Date(today.getTime() + daysOut * 86_400_000))
    : null;

  await supabase
    .from('leads')
    .update({
      status: statusMap[template] || lead.status,
      last_contacted: today.toISOString().slice(0, 10),
      next_follow_up,
    })
    .eq('id', lead.id);

  return NextResponse.json({
    ok: true,
    message_id: sendData?.id || null,
    scheduledAt,
    sendHour: optimalHour,
    abWinner: winner || null,
  });
}

function nextWeekday(date: Date): string {
  const day = date.getUTCDay();
  if (day === 6) date.setUTCDate(date.getUTCDate() + 2); // Sat → Mon
  if (day === 0) date.setUTCDate(date.getUTCDate() + 1); // Sun → Mon
  return date.toISOString().slice(0, 10);
}

function nextBusinessDayAtHourPT(hour: number): string {
  const next = new Date();
  do {
    next.setDate(next.getDate() + 1);
  } while (['Saturday', 'Sunday'].includes(
    next.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long' })
  ));
  const datePT = next.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const probe = new Date(`${datePT}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(probe);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-8';
  const offsetMatch = tzPart.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : -8;
  const sign = offsetHours >= 0 ? '+' : '-';
  const abs = String(Math.abs(offsetHours)).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  return `${datePT}T${hh}:00:00${sign}${abs}:00`;
}
