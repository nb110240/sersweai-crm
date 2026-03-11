import { getSupabase } from './supabase';
import { searchLocalBusinesses, type SerpApiLead } from './serpapi';
import { scrapeEmail } from './scrape-email';
import { verifyEmail } from './verify-email';
import { findContactByDomain } from './apollo';

export type DiscoverResult = {
  discovered: number;
  imported: number;
  skipped: number;
  enriched: number;
};

const COMMON_NAMES = new Set(
  'aaron adam alan albert alex alexander alfred alice amanda amber amy andrea andrew angela ann anna anne anthony arthur ashley barbara benjamin beth betty beverly bill bob bonnie brad brandon brenda brian bruce carl carol caroline catherine charles charlotte cheryl chris christian christina christine christopher cindy claire craig crystal cynthia dale dan daniel danny darren dave david dawn dean debbie deborah debra dennis diana diane don donald donna dorothy doug douglas earl ed edward eileen elaine elizabeth ellen emily eric erik ernest eugene eva evelyn florence forest frances francis frank fred frederick gail gary george gerald gloria gordon grace greg gregory gretchen harold harry heather helen henry howard jack jacqueline james jamie jane janet janice jason jean jeff jeffrey jennifer jeremy jerry jessica jill jim jimmy joan joanne joe john jonathan joseph joshua joyce judith judy julia julie justin karen karl kate katherine kathleen kathy katie keith kelly ken kenneth kevin kim kimberly kirk kurt kyle larry laura lauren lawrence lee leonard leslie lillian linda lisa lois lori louis louise luke lynn margaret maria marie marilyn mark martha martin mary matthew maureen max melissa michael michele michelle mike mildred mitchell monica nancy nathan neil nicholas nicole norma norman pam pamela pat patricia patrick paul paula peggy penny peter philip phillip phyllis rachel ralph randy ray raymond rebecca renee richard rick rita rob robert robin roger ron ronald rose roy russell ruth ryan sally sam samuel sandra sara sarah scott sean sharon shawn sheila sherry shirley stacy stanley stephanie stephen steve steven stewart stuart sue susan suzanne tammy teresa terri terry theresa thomas tim timothy tina todd tom tony tracy troy tyler valerie vernon vicki victoria vincent virginia walter wanda warren wayne wendy wesley william willie winnie'.split(' ')
);

function extractFirstName(email: string | null, companyName: string): string | null {
  // Try email prefix first
  if (email && email.includes('@')) {
    const prefix = email.split('@')[0].toLowerCase().replace(/\d+/g, '');
    const parts = prefix.split(/[._\-]/);
    const candidate = parts[0];
    if (candidate && candidate.length > 2 && COMMON_NAMES.has(candidate)) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }
  // Try company name patterns like "Law Office of Christine Padilla"
  const patterns = [/(?:Law\s+(?:Office|Firm)\s+of\s+)(\w+)/i, /(?:Offices\s+of\s+)(\w+)/i];
  for (const p of patterns) {
    const m = companyName.match(p);
    if (m && m[1] && COMMON_NAMES.has(m[1].toLowerCase()) && m[1].length > 2) {
      return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    }
  }
  return null;
}

/**
 * Shared discovery logic: search SerpAPI, dedup against existing leads, upsert new ones.
 * Used by both the manual /api/discover and the /api/discover/webhook endpoints.
 */
export async function discoverAndImport(
  query: string,
  location: string,
  category?: string
): Promise<DiscoverResult> {
  // 1. Search SerpAPI
  const { leads: serpLeads } = await searchLocalBusinesses(query, location, { category });

  if (serpLeads.length === 0) {
    return { discovered: 0, imported: 0, skipped: 0, enriched: 0 };
  }

  // 2. Normalize into lead rows
  const rows = serpLeads.map((sl: SerpApiLead) => ({
    company_name: sl.company_name,
    category: sl.category || category || null,
    city: sl.city || null,
    zip: sl.zip || null,
    website: sl.website || null,
    summary: sl.summary || null,
    status: 'Not Contacted',
    source_url: null,
    email: null as string | null,
    contact_form_url: null as string | null,
    notes: sl.address || null,
    first_name: null,
  })).filter((r) => r.company_name && r.zip);

  if (rows.length === 0) {
    return { discovered: serpLeads.length, imported: 0, skipped: serpLeads.length, enriched: 0 };
  }

  // 2b. Scrape emails from websites (concurrency limit of 5)
  const CONCURRENCY = 5;
  let enriched = 0;
  const scrapable = rows.filter((r) => r.website && !r.email);

  for (let i = 0; i < scrapable.length; i += CONCURRENCY) {
    const batch = scrapable.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((r) => scrapeEmail(r.website!))
    );
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value) {
        const row = batch[idx];
        if (res.value.email) {
          row.email = res.value.email;
          enriched++;
        }
        if (res.value.contactFormUrl && !row.contact_form_url) {
          row.contact_form_url = res.value.contactFormUrl;
        }
      }
    });
  }

  // 2c. Apollo enrichment — get real contact names and emails for leads
  //     missing email or first_name (concurrency limit of 5)
  const apolloTargets = rows.filter((r) => r.website && (!r.email || !r.first_name));
  for (let i = 0; i < apolloTargets.length; i += CONCURRENCY) {
    const batch = apolloTargets.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((r) => {
        try {
          const domain = new URL(
            r.website!.startsWith('http') ? r.website! : `https://${r.website!}`
          ).hostname.replace(/^www\./, '');
          return findContactByDomain(domain);
        } catch {
          return Promise.resolve(null);
        }
      })
    );
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value) {
        const row = batch[idx];
        const contact = res.value;
        // Use Apollo email if we don't have one from scraping
        if (!row.email && contact.email) {
          row.email = contact.email;
          enriched++;
        }
        // Always prefer Apollo's real first name
        if (contact.first_name) {
          (row as any).first_name = contact.first_name;
        }
      }
    });
  }

  // 2d. Verify emails (MX check — free, unlimited)
  for (const row of rows) {
    if (row.email) {
      const result = await verifyEmail(row.email);
      if (!result.valid) {
        row.email = null;
      }
    }
  }

  // 2e. Fallback: extract first names from emails and company names
  for (const row of rows) {
    if (!row.first_name) {
      (row as any).first_name = extractFirstName(row.email, row.company_name);
    }
  }

  const supabase = getSupabase();

  // 3. Build dedup set on (company_name, zip)
  const { data: existing } = await supabase
    .from('leads')
    .select('company_name, zip');

  const existingSet = new Set<string>();
  (existing || []).forEach((l: { company_name: string; zip: string | null }) => {
    if (l.company_name && l.zip) {
      existingSet.add(`${l.company_name.toLowerCase()}::${l.zip}`);
    }
  });

  // 4. Filter out duplicates
  const newRows = rows.filter(
    (r) => !existingSet.has(`${r.company_name.toLowerCase()}::${r.zip}`)
  );

  if (newRows.length === 0) {
    return { discovered: rows.length, imported: 0, skipped: rows.length, enriched };
  }

  // 5. Upsert new leads
  const { data, error } = await supabase
    .from('leads')
    .upsert(newRows, { onConflict: 'company_name,zip' })
    .select('id');

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return {
    discovered: rows.length,
    imported: data?.length || 0,
    skipped: rows.length - (data?.length || 0),
    enriched,
  };
}
