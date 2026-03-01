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

// A/B subject line variants per template
const subjectVariants: Record<string, ((firm: string, category: string) => string)[]> = {
  email1: [
    (firm) => `Quick idea for ${firm}`,
    (firm) => `Saving ${firm} 10 hrs/week`,
  ],
  email2: [
    (firm) => `2 automations that could help ${firm}`,
    (_firm, category) => `How ${category} firms cut admin time in half`,
  ],
  email3: [
    (firm) => `Closing the loop — ${firm}`,
  ],
  email4: [
    (firm) => `Still happy to help — ${firm}`,
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

  if (template === 'email1') {
    const opener = lead.notes?.trim() || (contextLine + '.');
    const text = `Hi ${firstName},\n\n${opener}\n\nI'm Neil from SersweAI — we're a local San Diego business that helps ${category} firms save time by automating repetitive admin work (intake forms, document collection, client follow-ups, scheduling) using simple AI workflows. For ${category} businesses specifically, we typically build things like ${example1} and ${example2}.\n\nNo new software to learn — we build on top of the tools you already use.\n\nWould you be open to a free 30-minute call where I walk through 2–3 automations specific to ${firm}?\n\nYou can see what we do here: ${siteLink}${bookingLink ? `\n\nBook a time: ${bookingLink}` : ''}${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>${opener}</p>
      <p>I'm Neil from SersweAI — we're a local San Diego business that helps ${category} firms save time by automating repetitive admin work (intake forms, document collection, client follow-ups, scheduling) using simple AI workflows. For ${category} businesses specifically, we typically build things like ${example1} and ${example2}.</p>
      <p>No new software to learn — we build on top of the tools you already use.</p>
      <p>Would you be open to a free 30-minute call where I walk through 2–3 automations specific to ${firm}?</p>
      <p>You can see what we do here: <a href="${siteLink}">sersweai.com</a></p>
      ${bookingLink ? `<p>Book a time: <a href="${bookingLink}">${bookingUrl}</a></p>` : ''}
      <p>— ${senderName}<br/>${senderEmail}<br/><a href="${siteLink}">sersweai.com</a></p>
      <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, subjectVariant, text, html };
  }

  if (template === 'email2') {
    const text = `Hi ${firstName},\n\nFollowing up — here are two workflows we've built for other ${category} firms in San Diego that usually save 5–10 hours a week:\n\n1) Smart intake + routing: new inquiries are captured, key details extracted, and routed to the right person automatically.\n2) Document collection + auto-reminders: clients get a simple upload link with automatic follow-ups until everything is in.\n\nFor ${category} businesses specifically, we also build things like ${example1} and ${example2}.\n\nI'd love to spend 30 minutes mapping out how these could work for ${firm} specifically — no cost, no obligation.\n\nSee examples on our site: ${siteLink}${bookingLink ? `\n\nGrab a time here: ${bookingLink}` : ''}${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>Following up — here are two workflows we've built for other ${category} firms in San Diego that usually save 5–10 hours a week:</p>
      <ol>
        <li><strong>Smart intake + routing:</strong> new inquiries are captured, key details extracted, and routed to the right person automatically.</li>
        <li><strong>Document collection + auto-reminders:</strong> clients get a simple upload link with automatic follow-ups until everything is in.</li>
      </ol>
      <p>For ${category} businesses specifically, we also build things like ${example1} and ${example2}.</p>
      <p>I'd love to spend 30 minutes mapping out how these could work for ${firm} specifically — no cost, no obligation.</p>
      <p>See examples on our site: <a href="${siteLink}">sersweai.com</a></p>
      ${bookingLink ? `<p>Grab a time here: <a href="${bookingLink}">${bookingUrl}</a></p>` : ''}
      <p>— ${senderName}<br/>${senderEmail}<br/><a href="${siteLink}">sersweai.com</a></p>
      <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, subjectVariant, text, html };
  }

  if (template === 'email4') {
    const text = `Hi ${firstName},\n\nI reached out a few weeks ago about automating some of the admin work at ${firm}.\n\nNo worries if the timing wasn't right — just wanted to let you know the offer still stands.\n\nIf you ever want a quick walkthrough of what automation could look like for ${firm}, I'm here.\n\nYou can see what we do here: ${siteLink}${bookingLink ? `\n\nBook a time: ${bookingLink}` : ''}${footer}`;

    const html = `
      <p>Hi ${firstName},</p>
      <p>I reached out a few weeks ago about automating some of the admin work at ${firm}.</p>
      <p>No worries if the timing wasn't right — just wanted to let you know the offer still stands.</p>
      <p>If you ever want a quick walkthrough of what automation could look like for ${firm}, I'm here.</p>
      <p>You can see what we do here: <a href="${siteLink}">sersweai.com</a></p>
      ${bookingLink ? `<p>Book a time: <a href="${bookingLink}">${bookingUrl}</a></p>` : ''}
      <p>— ${senderName}<br/>${senderEmail}<br/><a href="${siteLink}">sersweai.com</a></p>
      <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
    return { subject, subjectVariant, text, html };
  }

  // email3 (default)
  const text = `Hi ${firstName},\n\nJust one last note. I know things get busy, so no worries if now isn't the right time.\n\nI'm based in San Diego and work with a lot of local ${category} businesses — if you're curious what AI automation could look like for ${firm}, I'm happy to put together a quick 1-page workflow suggestion — completely free.\n\nJust reply or book 30 minutes here: ${bookingLink || siteLink}\n\nEither way, you can always check out what we do at: ${siteLink}${footer}`;

  const html = `
    <p>Hi ${firstName},</p>
    <p>Just one last note. I know things get busy, so no worries if now isn't the right time.</p>
    <p>I'm based in San Diego and work with a lot of local ${category} businesses — if you're curious what AI automation could look like for ${firm}, I'm happy to put together a quick 1-page workflow suggestion — completely free.</p>
    <p>Just reply or book 30 minutes here: <a href="${bookingLink || siteLink}">${bookingLink ? bookingUrl : 'sersweai.com'}</a></p>
    <p>Either way, you can always check out what we do at: <a href="${siteLink}">sersweai.com</a></p>
    <p>— ${senderName}<br/>${senderEmail}<br/><a href="${siteLink}">sersweai.com</a></p>
    <p style="font-size:12px;color:#999;">If you'd prefer not to hear from me, reply "unsubscribe."</p>
    <img src="${trackingPixel}" width="1" height="1" alt="" />
  `;
  return { subject, subjectVariant, text, html };
}
