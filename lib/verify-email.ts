import { promises as dns } from 'dns';

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'maildrop.cc', 'temp-mail.org', 'fakeinbox.com',
]);

export type VerifyResult = {
  valid: boolean;
  reason: string;
};

/**
 * Verify an email address without any external API.
 * Checks: format, disposable domain, MX records.
 * Free and unlimited.
 */
export async function verifyEmail(email: string): Promise<VerifyResult> {
  // 1. Basic format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'invalid_format' };
  }

  const domain = email.split('@')[1].toLowerCase();

  // 2. Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'disposable_domain' };
  }

  // 3. MX record check — does the domain accept email?
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { valid: false, reason: 'no_mx_records' };
    }
    return { valid: true, reason: 'mx_valid' };
  } catch {
    return { valid: false, reason: 'domain_not_found' };
  }
}
