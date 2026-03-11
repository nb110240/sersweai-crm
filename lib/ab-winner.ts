import { SupabaseClient } from '@supabase/supabase-js';

// Minimum emails per variant before declaring a winner
const MIN_SAMPLE_SIZE = 15;

type VariantStats = {
  variant: string;
  sent: number;
  opened: number;
  openRate: number;
};

/**
 * Check if there's a statistically meaningful A/B winner for a template.
 * Returns the winning variant letter ('A' or 'B') or null if not enough data.
 */
export async function getWinningVariant(
  supabase: SupabaseClient,
  template: string
): Promise<string | null> {
  // Get all emails for this template that have a variant
  const { data: emails } = await supabase
    .from('emails')
    .select('id, subject_variant')
    .eq('template', template)
    .not('subject_variant', 'is', null)
    .not('sent_at', 'is', null);

  if (!emails || emails.length === 0) return null;

  // Group by variant
  const variantEmails: Record<string, string[]> = {};
  for (const e of emails) {
    const v = e.subject_variant;
    if (!v) continue;
    if (!variantEmails[v]) variantEmails[v] = [];
    variantEmails[v].push(e.id);
  }

  const variants = Object.keys(variantEmails);
  if (variants.length < 2) return null;

  // Check if all variants have enough samples
  for (const v of variants) {
    if (variantEmails[v].length < MIN_SAMPLE_SIZE) return null;
  }

  // Count opens per variant
  const stats: VariantStats[] = [];
  for (const v of variants) {
    const emailIds = variantEmails[v];
    const { count: openCount } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'open')
      .in('email_id', emailIds);

    stats.push({
      variant: v,
      sent: emailIds.length,
      opened: openCount || 0,
      openRate: (openCount || 0) / emailIds.length,
    });
  }

  // Sort by open rate descending
  stats.sort((a, b) => b.openRate - a.openRate);

  // Require at least 5 percentage points difference to declare a winner
  if (stats[0].openRate - stats[1].openRate < 0.05) return null;

  return stats[0].variant;
}
