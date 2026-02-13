export type Lead = {
  id: string;
  company_name: string;
  category: string;
  city: string;
  zip: string;
  website: string | null;
  email: string | null;
  contact_form_url: string | null;
  summary: string | null;
};

export type TemplateKey = 'email1' | 'email2' | 'email3';

const senderName = process.env.SENDER_NAME || 'Your Name';
const senderEmail = process.env.SENDER_EMAIL || 'you@example.com';
const bookingUrl = process.env.BOOKING_URL || '';

export function renderTemplate(lead: Lead, template: TemplateKey, baseUrl: string, emailId: string) {
  const firstName = 'there';
  const firm = lead.company_name;
  const bookingLink = bookingUrl
    ? `${baseUrl}/api/track/click?email_id=${encodeURIComponent(emailId)}&lead_id=${encodeURIComponent(lead.id)}&url=${encodeURIComponent(bookingUrl)}`
    : '';

  const footer = `\n\n— ${senderName}\n${senderEmail}\n\nIf you’d prefer not to hear from me, reply “unsubscribe.”\n[Your Mailing Address]`;

  const trackingPixel = `${baseUrl}/api/track/open?email_id=${encodeURIComponent(emailId)}&lead_id=${encodeURIComponent(lead.id)}`;

  if (template === 'email1') {
    const subject = `Quick question about admin time at ${firm}`;
    const text = `Hi ${firstName},\n\nI’m ${senderName} in San Diego. I help small law and accounting firms save time with simple AI automations (intake, document collection, reminders, follow-ups).\n\nIf I reviewed ${firm} for 10 minutes, I could suggest 2–3 automations that reduce admin work without changing your current tools.\n\nOpen to a quick 10-minute call next week?${bookingLink ? `\n\nCalendar: ${bookingLink}` : ''}${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>I’m ${senderName} in San Diego. I help small law and accounting firms save time with simple AI automations (intake, document collection, reminders, follow-ups).</p>
      <p>If I reviewed ${firm} for 10 minutes, I could suggest 2–3 automations that reduce admin work without changing your current tools.</p>
      <p>Open to a quick 10-minute call next week?</p>
      ${bookingLink ? `<p>Calendar: <a href="${bookingLink}">${bookingUrl}</a></p>` : ''}
      <p>— ${senderName}<br/>${senderEmail}</p>
      <p>If you’d prefer not to hear from me, reply “unsubscribe.”<br/>[Your Mailing Address]</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, text, html };
  }

  if (template === 'email2') {
    const subject = '2 ideas that often help law/accounting firms';
    const text = `Hi ${firstName},\n\nTwo quick ideas that often save time:\n\n1) Intake + conflict check workflow: gather key details, validate conflicts, route to the right person.\n2) Document collection + reminders: clients upload required docs, and reminders run automatically.\n\nIf either sounds useful, I can map a simple workflow for ${firm} in 10 minutes.\n\nWould you like that?${bookingLink ? `\n\nCalendar: ${bookingLink}` : ''}${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>Two quick ideas that often save time:</p>
      <ol>
        <li>Intake + conflict check workflow: gather key details, validate conflicts, route to the right person.</li>
        <li>Document collection + reminders: clients upload required docs, and reminders run automatically.</li>
      </ol>
      <p>If either sounds useful, I can map a simple workflow for ${firm} in 10 minutes.</p>
      <p>Would you like that?</p>
      ${bookingLink ? `<p>Calendar: <a href="${bookingLink}">${bookingUrl}</a></p>` : ''}
      <p>— ${senderName}<br/>${senderEmail}</p>
      <p>If you’d prefer not to hear from me, reply “unsubscribe.”<br/>[Your Mailing Address]</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, text, html };
  }

  const subject = 'Should I close the loop?';
  const text = `Hi ${firstName},\n\nLast note from me. If it’s not a priority, no worries—just reply “unsubscribe” and I’ll take you off my list.\n\nIf you are interested, I can send a 1-page workflow suggestion tailored to ${firm}.${footer}`;

  const html = `
    <p>Hi ${firstName},</p>
    <p>Last note from me. If it’s not a priority, no worries—just reply “unsubscribe” and I’ll take you off my list.</p>
    <p>If you are interested, I can send a 1-page workflow suggestion tailored to ${firm}.</p>
    <p>— ${senderName}<br/>${senderEmail}</p>
    <p>If you’d prefer not to hear from me, reply “unsubscribe.”<br/>[Your Mailing Address]</p>
    <img src="${trackingPixel}" width="1" height="1" alt="" />
  `;
  return { subject, text, html };
}
