import { SupabaseClient } from '@supabase/supabase-js';

// Default send hour if not enough data
const DEFAULT_HOUR = 8;
// Minimum opens needed before we trust the data
const MIN_OPENS_THRESHOLD = 10;

/**
 * Analyze historical open data to find the best send hour (PT) for a category.
 * Falls back to 8 AM PT if not enough data.
 */
export async function getOptimalSendHour(
  supabase: SupabaseClient,
  category: string
): Promise<number> {
  // Get opens for this category with timestamps
  const { data: opens } = await supabase
    .from('email_events')
    .select('created_at, leads!inner(category)')
    .eq('event_type', 'open')
    .eq('leads.category', category)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!opens || opens.length < MIN_OPENS_THRESHOLD) {
    // Not enough category data — try all categories
    const { data: allOpens } = await supabase
      .from('email_events')
      .select('created_at')
      .eq('event_type', 'open')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!allOpens || allOpens.length < MIN_OPENS_THRESHOLD) {
      return DEFAULT_HOUR;
    }

    return findPeakHour(allOpens.map((o) => o.created_at));
  }

  return findPeakHour(opens.map((o) => o.created_at));
}

/**
 * Find the hour (PT) with the most opens.
 */
function findPeakHour(timestamps: string[]): number {
  const hourCounts = new Array(24).fill(0);

  for (const ts of timestamps) {
    // Convert to PT hour
    const ptHour = parseInt(
      new Date(ts).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hour12: false,
      }),
      10
    );
    if (ptHour >= 0 && ptHour < 24) {
      hourCounts[ptHour]++;
    }
  }

  // Only consider business hours (7 AM - 6 PM)
  let bestHour = DEFAULT_HOUR;
  let bestCount = 0;
  for (let h = 7; h <= 18; h++) {
    if (hourCounts[h] > bestCount) {
      bestCount = hourCounts[h];
      bestHour = h;
    }
  }

  return bestHour;
}
