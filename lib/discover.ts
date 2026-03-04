import { getSupabase } from './supabase';
import { searchLocalBusinesses, type SerpApiLead } from './serpapi';
import { scrapeEmail } from './scrape-email';

export type DiscoverResult = {
  discovered: number;
  imported: number;
  skipped: number;
  enriched: number;
};

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
