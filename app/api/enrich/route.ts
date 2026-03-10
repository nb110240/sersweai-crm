import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';
import { enrichLead } from '../../../lib/enrich-lead';

/**
 * POST /api/enrich
 * Body: { lead_ids: string[] }
 * Enriches leads by scraping their website and generating a personalized opener via AI.
 * Saves the opener to the lead's `notes` field.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth) return auth;

  const { lead_ids } = await req.json().catch(() => ({ lead_ids: [] }));

  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return NextResponse.json({ error: 'lead_ids array required' }, { status: 400 });
  }

  if (lead_ids.length > 20) {
    return NextResponse.json({ error: 'Max 20 leads per request' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
  }

  // Fetch leads
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, company_name, category, city, website, notes')
    .in('id', lead_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: 'No leads found' }, { status: 404 });
  }

  const results: { id: string; status: string; opener?: string }[] = [];

  // Process in batches of 5 to avoid overwhelming
  const BATCH_SIZE = 5;
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    const enrichResults = await Promise.allSettled(
      batch.map(async (lead) => {
        if (!lead.website) {
          return { id: lead.id, status: 'skipped', reason: 'no website' };
        }

        const result = await enrichLead({
          company_name: lead.company_name,
          category: lead.category,
          city: lead.city,
          website: lead.website,
        });

        if (!result) {
          return { id: lead.id, status: 'failed', reason: 'could not analyze' };
        }

        // Save opener to notes, and details to summary
        const detailsLine = [
          result.details.services ? `Services: ${result.details.services}` : '',
          result.details.stack && result.details.stack !== 'unknown'
            ? `Stack: ${result.details.stack}`
            : '',
          result.details.customerProfile
            ? `Customers: ${result.details.customerProfile}`
            : '',
          result.details.observation
            ? `Opportunity: ${result.details.observation}`
            : '',
        ]
          .filter(Boolean)
          .join(' | ');

        await supabase
          .from('leads')
          .update({
            notes: result.opener,
            summary: detailsLine || lead.notes,
          })
          .eq('id', lead.id);

        return { id: lead.id, status: 'enriched', opener: result.opener };
      })
    );

    for (const r of enrichResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({ id: 'unknown', status: 'error' });
      }
    }
  }

  const enriched = results.filter((r) => r.status === 'enriched').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed' || r.status === 'error').length;

  return NextResponse.json({ enriched, skipped, failed, results });
}
