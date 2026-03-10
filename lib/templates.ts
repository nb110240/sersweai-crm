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
  notes: string | null;
  first_name: string | null;
};

export type TemplateKey = 'email1' | 'email2' | 'email3' | 'email4';

const senderName = process.env.SENDER_NAME || 'SersweAI';
const senderEmail = 'sersweai2@gmail.com';
const bookingUrl = process.env.BOOKING_URL || '';

const categoryExamples: Record<string, [string, string]> = {
  'Health & Wellness':  ['patient intake + insurance pre-screening automation', 'appointment reminder + follow-up sequences'],
  'Real Estate':        ['auto-routing leads from Zillow and MLS inquiries', 'auto-generated listing summaries and client update sequences'],
  'Technology':         ['support ticket triage + auto-responses', 'onboarding workflows for new users and clients'],
  'Beauty & Fitness':   ['booking confirmation + rebook reminder sequences', 'post-appointment review request automation'],
  'Home Services':      ['quote follow-up automation', 'job completion → invoice → review request flows'],
  'Creative & Media':   ['client onboarding + asset collection workflows', 'automated project status update sequences'],
  'Retail':             ['abandoned cart + restock notification flows', 'post-purchase review and loyalty follow-ups'],
  'Food & Beverage':    ['catering inquiry → quote → follow-up automation', 'reservation confirmation + upsell sequences'],
  'Insurance':          ['claims processing + renewal reminder automation', 'policy quote follow-up sequences'],
  'Dental & Medical':   ['patient intake + insurance pre-verification automation', 'appointment reminder + post-visit follow-up sequences'],
  'Property Management':['tenant communication + maintenance request routing', 'lease renewal reminder + rent collection automation'],
  'Financial Advisors': ['client onboarding + document collection automation', 'portfolio review scheduling + meeting prep workflows'],
  'Veterinary':         ['pet owner intake + vaccination reminder automation', 'appointment confirmation + post-visit care follow-ups'],
  'Legal (Solo/Small)': ['client intake + document collection automation', 'case status update + deadline reminder sequences'],
};

// Category-specific hook questions for email 1
const categoryHooks: Record<string, string> = {
  'Health & Wellness':  'do you still handle patient intake and appointment reminders manually',
  'Real Estate':        'do you still follow up with new leads and schedule showings by hand',
  'Technology':         'do you still handle support tickets and user onboarding manually',
  'Beauty & Fitness':   'do you still send booking confirmations and rebook reminders by hand',
  'Home Services':      'do you still follow up on quotes and chase invoices manually',
  'Creative & Media':   'do you still collect client assets and send project updates by hand',
  'Retail':             'do you still send restock alerts and follow up with customers manually',
  'Food & Beverage':    'do you still handle catering inquiries and reservation confirmations by hand',
  'Insurance':          'do you still handle policy renewals and quote follow-ups manually',
  'Dental & Medical':   'do you still handle patient intake forms and appointment reminders by hand',
  'Property Management':'do you still manage tenant requests and lease renewals manually',
  'Financial Advisors': 'do you still collect client documents and schedule reviews by hand',
  'Veterinary':         'do you still send vaccination reminders and appointment confirmations manually',
  'Legal (Solo/Small)': 'do you still handle client intake and deadline tracking manually',
};

// A/B subject line variants per template
const subjectVariants: Record<string, ((firm: string, category: string) => string)[]> = {
  email1: [
    (firm) => `Quick question for ${firm}`,
    (firm) => `${firm} — quick idea`,
  ],
  email2: [
    (firm) => `Thought of something for ${firm}`,
    (firm) => `Following up — ${firm}`,
  ],
  email3: [
    (firm) => `Last note — ${firm}`,
  ],
  email4: [
    (firm) => `Circling back — ${firm}`,
  ],
};

export function renderTemplate(lead: Lead, template: TemplateKey, baseUrl: string, emailId: string) {
  const firstName = lead.first_name || 'there';
  const firm = lead.company_name;
  const category = lead.category || 'business';
  const city = lead.city || '';
  const summary = lead.summary || '';
  const websiteUrl = 'https://sersweai.com';
  const [example1, example2] = categoryExamples[category] || ['workflow automation', 'client follow-up sequences'];
  const bookingLink = bookingUrl
    ? `${baseUrl}/api/track/click?email_id=${encodeURIComponent(emailId)}&lead_id=${encodeURIComponent(lead.id)}&url=${encodeURIComponent(bookingUrl)}`
    : '';
  const siteLink = `${baseUrl}/api/track/click?email_id=${encodeURIComponent(emailId)}&lead_id=${encodeURIComponent(lead.id)}&url=${encodeURIComponent(websiteUrl)}`;

  const footer = `\n\n— ${senderName}\n${senderEmail}\nhttps://sersweai.com\n\nIf you'd prefer not to hear from me, reply "unsubscribe."`;

  const trackingPixel = `${baseUrl}/api/track/open?email_id=${encodeURIComponent(emailId)}&lead_id=${encodeURIComponent(lead.id)}`;

  // A/B variant selection (deterministic based on lead ID)
  const variants = subjectVariants[template] || subjectVariants.email1;
  const variantIndex = lead.id.charCodeAt(0) % variants.length;
  const subject = variants[variantIndex](firm, category);
  const subjectVariant = variants.length > 1 ? String.fromCharCode(65 + variantIndex) : null; // 'A', 'B', etc.

  const summaryClean = summary?.replace(/\.?\s*Rating:[\d\s./()reviews]+\.?$/i, '').trim() || '';
  const contextLine = summaryClean
    ? `I came across ${firm} and noticed ${summaryClean.toLowerCase().startsWith('they') || summaryClean.toLowerCase().startsWith('the') ? summaryClean.charAt(0).toLowerCase() + summaryClean.slice(1) : `that you ${summaryClean.charAt(0).toLowerCase() + summaryClean.slice(1)}`}`
    : `I came across ${firm}${city ? ` in ${city}` : ''} and work with a lot of ${category} firms`;

  // Parse enrichment details from summary (format: "Services: X | Stack: Y | Customers: Z | Opportunity: W")
  const enriched = {
    services: summary?.match(/Services:\s*([^|]+)/i)?.[1]?.trim() || '',
    stack: summary?.match(/Stack:\s*([^|]+)/i)?.[1]?.trim() || '',
    customers: summary?.match(/Customers:\s*([^|]+)/i)?.[1]?.trim() || '',
    opportunity: summary?.match(/Opportunity:\s*([^|]+)/i)?.[1]?.trim() || '',
  };
  const hasEnrichment = !!(enriched.services || enriched.opportunity);

  if (template === 'email1') {
    const hook = categoryHooks[category] || 'do you still handle a lot of admin work manually';
    const customOpener = lead.notes?.trim();
    // If we have a custom AI-generated opener, use it + hook. Otherwise just hook.
    const openingLine = customOpener
      ? `${customOpener} — ${hook}?`
      : `I came across ${firm}${city ? ` in ${city}` : ''} — ${hook}?`;

    const text = `Hi ${firstName},\n\n${openingLine}\n\nI'm Neil, based in San Diego. I build simple automations that handle that kind of work automatically — no new software, just connects to what you already use.\n\nHappy to show you a quick example if you're curious.${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>${openingLine}</p>
      <p>I'm Neil, based in San Diego. I build simple automations that handle that kind of work automatically — no new software, just connects to what you already use.</p>
      <p>Happy to show you a quick example if you're curious.</p>
      <p>— Neil<br/>${senderEmail}<br/><a href="${siteLink}">sersweai.com</a></p>
      <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, subjectVariant, text, html };
  }

  if (template === 'email2') {
    const ideaLine = hasEnrichment && enriched.opportunity
      ? `I was thinking about ${firm} and noticed ${enriched.opportunity.toLowerCase()}. I recently built a workflow for a similar ${category.toLowerCase()} business that handles exactly that — took about a week and saved them ~10 hours/month.`
      : `A lot of ${category} businesses I work with waste hours on ${example1.split('+')[0].trim().toLowerCase()}. I recently built a workflow that handles it automatically — took about a week and saved the owner ~10 hours/month.`;

    const stackLine = hasEnrichment && enriched.stack && enriched.stack !== 'unknown'
      ? ` It connects directly to tools like ${enriched.stack} — no new software needed.`
      : '';

    const text = `Hi ${firstName},\n\nJust following up — I had a specific idea for ${firm}.\n\n${ideaLine}${stackLine}\n\nI also build lead generation systems that find and reach new prospects on autopilot — same idea, no extra software.\n\nWould either of those be useful for you? Happy to walk through it — takes 15 minutes.\n\nYou can see examples here: ${siteLink}${bookingLink ? `\n\nOr grab a time: ${bookingLink}` : ''}${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>Just following up — I had a specific idea for ${firm}.</p>
      <p>${ideaLine}${stackLine}</p>
      <p>I also build lead generation systems that find and reach new prospects on autopilot — same idea, no extra software.</p>
      <p>Would either of those be useful for you? Happy to walk through it — takes 15 minutes.</p>
      <p>You can see examples here: <a href="${siteLink}">sersweai.com</a></p>
      ${bookingLink ? `<p>Or grab a time: <a href="${bookingLink}">${bookingUrl}</a></p>` : ''}
      <p>— Neil<br/>${senderEmail}</p>
      <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, subjectVariant, text, html };
  }

  if (template === 'email4') {
    const e4Line = hasEnrichment && enriched.customers
      ? `If you ever want to spend less time on admin and more time with ${enriched.customers.toLowerCase()}, I'm around.`
      : `If ${firm} ever needs help automating the busywork or generating new leads on autopilot, I'm around.`;

    const text = `Hi ${firstName},\n\nCircling back one more time — I know timing is everything.\n\n${e4Line} Just reply to this email.\n\n— Neil${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>Circling back one more time — I know timing is everything.</p>
      <p>${e4Line} Just reply to this email.</p>
      <p>— Neil<br/><a href="${siteLink}">sersweai.com</a></p>
      <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, subjectVariant, text, html };
  }

  // email3 (default)
  const e3Specific = hasEnrichment && enriched.services
    ? `I sketched out a quick idea for how ${firm} could automate part of your ${enriched.services.split(',')[0].trim().toLowerCase()} workflow and free up a few hours a week`
    : `I put together a quick idea for how ${firm} could automate some of the repetitive work and bring in new leads automatically`;

  const text = `Hi ${firstName},\n\nLast note from me — no worries if this isn't a priority right now.\n\n${e3Specific}. No call needed, just reply and I'll share it.\n\n— Neil${footer}`;

  const html = `
    <p>Hi ${firstName},</p>
    <p>Last note from me — no worries if this isn't a priority right now.</p>
    <p>${e3Specific}. No call needed, just reply and I'll share it.</p>
    <p>— Neil<br/><a href="${siteLink}">sersweai.com</a></p>
    <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
    <img src="${trackingPixel}" width="1" height="1" alt="" />
  `;
  return { subject, subjectVariant, text, html };
}
