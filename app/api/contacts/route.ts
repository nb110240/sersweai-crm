import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import { rateLimit } from '../../../lib/rate-limit';
import { Resend } from 'resend';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// POST — public endpoint called by n8n webhook (no auth)
export async function POST(req: NextRequest) {
  const blocked = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;
  const body = await req.json().catch(() => ({}));
  const { full_name, email, phone, company_name, interest, message, source } = body;

  if (!full_name || !email) {
    return NextResponse.json({ error: 'full_name and email are required' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('website_contacts')
    .insert({
      full_name,
      email,
      phone: phone || null,
      company_name: company_name || null,
      interest: interest || null,
      message: message || null,
      source: source || 'sersweai.com'
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email notification
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const senderEmail = process.env.SENDER_EMAIL || '';
  const notifyEmail = process.env.SENDER_EMAIL || 'sersweai2@gmail.com';

  if (resendApiKey && senderEmail) {
    try {
      const resend = new Resend(resendApiKey);
      const safeName = escapeHtml(full_name);
      const safeEmail = escapeHtml(email);
      const safePhone = phone ? escapeHtml(phone) : '';
      const safeCompany = company_name ? escapeHtml(company_name) : '';
      const safeInterest = interest ? escapeHtml(interest) : '';
      const safeMessage = message ? escapeHtml(message) : '';

      await resend.emails.send({
        from: `SersweAI Website <${senderEmail}>`,
        to: [notifyEmail],
        subject: `New Contact: ${safeName}${safeCompany ? ` from ${safeCompany}` : ''}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto;">
            <h2 style="color: #0f5d5c; margin-bottom: 4px;">New Website Contact</h2>
            <p style="color: #6a6f73; margin-top: 0;">Someone submitted the contact form on sersweai.com</p>
            <hr style="border: none; border-top: 1px solid #e5e1d8; margin: 20px 0;" />
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6a6f73; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${safeName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6a6f73;">Email</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
              ${safePhone ? `<tr><td style="padding: 8px 0; color: #6a6f73;">Phone</td><td style="padding: 8px 0;"><a href="tel:${safePhone}">${safePhone}</a></td></tr>` : ''}
              ${safeCompany ? `<tr><td style="padding: 8px 0; color: #6a6f73;">Company</td><td style="padding: 8px 0;">${safeCompany}</td></tr>` : ''}
              ${safeInterest ? `<tr><td style="padding: 8px 0; color: #6a6f73;">Interest</td><td style="padding: 8px 0;">${safeInterest}</td></tr>` : ''}
              ${safeMessage ? `<tr><td style="padding: 8px 0; color: #6a6f73;">Message</td><td style="padding: 8px 0;">${safeMessage}</td></tr>` : ''}
            </table>
            <hr style="border: none; border-top: 1px solid #e5e1d8; margin: 20px 0;" />
            <p style="color: #6a6f73; font-size: 13px;">View all contacts in your <a href="https://sersweai.com/crm/contacts">CRM dashboard</a>.</p>
          </div>
        `
      });
    } catch {
      // Don't fail the contact creation if email fails
    }
  }

  return NextResponse.json({ ok: true, contact: data });
}

// GET — auth required, returns all website contacts
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('website_contacts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: data || [] });
}
