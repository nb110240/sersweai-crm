import { jinaReader } from './jina';

const CONTACT_PATHS = ['/contact', '/contact-us', '/about'];
const FETCH_TIMEOUT_MS = 5000;

const BUSINESS_PREFIXES = ['info@', 'hello@', 'contact@', 'team@', 'sales@'];

const JUNK_PATTERNS = [
  /noreply@/i,
  /no-reply@/i,
  /@example\.com$/i,
  /@sentry\./i,
  /@wixpress\.com$/i,
  /@w3\.org$/i,
  /\.(png|jpg|jpeg|gif|svg|webp)$/i,
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const OBFUSCATED_REGEX =
  /([a-zA-Z0-9._%+-]+)\s*[\[\(]\s*at\s*[\]\)]\s*([a-zA-Z0-9.-]+)\s*[\[\(]\s*dot\s*[\]\)]\s*([a-zA-Z]{2,})/gi;

function isJunk(email: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(email));
}

function extractEmails(content: string): string[] {
  const found = new Set<string>();

  // 1. mailto: links
  let m: RegExpExecArray | null;
  while ((m = MAILTO_REGEX.exec(content)) !== null) {
    found.add(m[1].toLowerCase());
  }

  // 2. General email regex
  const general = content.match(EMAIL_REGEX) || [];
  for (const e of general) {
    found.add(e.toLowerCase());
  }

  // 3. Deobfuscation: "info [at] company [dot] com"
  while ((m = OBFUSCATED_REGEX.exec(content)) !== null) {
    found.add(`${m[1]}@${m[2]}.${m[3]}`.toLowerCase());
  }

  // Filter junk
  return Array.from(found).filter((e) => !isJunk(e));
}

function pickBest(emails: string[]): string | null {
  if (emails.length === 0) return null;

  // Prefer business-style prefixes
  for (const prefix of BUSINESS_PREFIXES) {
    const match = emails.find((e) => e.startsWith(prefix));
    if (match) return match;
  }

  return emails[0];
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadCRM/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch page content — tries Jina Reader first (handles JS-rendered sites),
 * falls back to direct fetch.
 */
async function fetchPage(url: string): Promise<string | null> {
  const jina = await jinaReader(url);
  if (jina && jina.length > 50) return jina;
  return fetchWithTimeout(url);
}

/**
 * Scrape a website for an email address.
 * Uses Jina Reader API for JS-rendered sites, falls back to direct fetch.
 * Tries the homepage, then /contact, /contact-us, /about — stops on first email found.
 */
export async function scrapeEmail(
  websiteUrl: string
): Promise<{ email: string | null; contactFormUrl: string | null }> {
  let base: URL;
  try {
    base = new URL(
      websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    );
  } catch {
    return { email: null, contactFormUrl: null };
  }

  let contactFormUrl: string | null = null;

  // Try homepage first
  const homepageContent = await fetchPage(base.origin);
  if (homepageContent) {
    const emails = extractEmails(homepageContent);
    const best = pickBest(emails);
    if (best) return { email: best, contactFormUrl: null };
  }

  // Try contact/about pages
  for (const path of CONTACT_PATHS) {
    const url = `${base.origin}${path}`;
    const content = await fetchPage(url);
    if (content === null) continue;

    // This contact page exists — record it as a fallback
    if (!contactFormUrl && (path === '/contact' || path === '/contact-us')) {
      contactFormUrl = url;
    }

    const emails = extractEmails(content);
    const best = pickBest(emails);
    if (best) return { email: best, contactFormUrl: null };
  }

  return { email: null, contactFormUrl };
}
