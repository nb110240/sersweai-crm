export type SerpApiLead = {
  company_name: string;
  category: string | null;
  city: string | null;
  zip: string | null;
  website: string | null;
  phone: string | null;
  summary: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  latitude: number | null;
  longitude: number | null;
};

function parseZip(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

function parseCity(address: string): string | null {
  // Try to extract city from typical formats like "123 Main St, San Diego, CA 92101"
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    // City is typically the second-to-last part (before state+zip)
    const cityPart = parts[parts.length - 2];
    // Remove any leading numbers (street address)
    if (cityPart && !/^\d/.test(cityPart)) return cityPart;
    // If that part starts with a number, try the part before it
    if (parts.length >= 3) {
      const alt = parts[parts.length - 3];
      if (alt && !/^\d/.test(alt)) return alt;
    }
  }
  return null;
}

function buildSummary(result: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (result.type) parts.push(String(result.type));
  if (result.rating) {
    let s = `Rating: ${result.rating}/5`;
    if (result.reviews) s += ` (${result.reviews} reviews)`;
    parts.push(s);
  }
  if (result.hours) parts.push(`Hours: ${result.hours}`);
  return parts.length > 0 ? parts.join('. ') : null;
}

export async function searchLocalBusinesses(
  query: string,
  location: string,
  options?: { category?: string }
): Promise<{ leads: SerpApiLead[]; searchesRemaining: number | null }> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error('Missing SERPAPI_API_KEY environment variable');

  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    ll: '', // let SerpAPI geocode from location text
    type: 'search',
    api_key: apiKey,
  });
  // Use the google_maps engine with a text-based location query
  // SerpAPI resolves location strings automatically
  if (location) params.set('q', `${query} in ${location}`);

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SerpAPI request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const results: Record<string, unknown>[] = data.local_results || [];

  const leads: SerpApiLead[] = results.map((r) => {
    const address = String(r.address || '');
    return {
      company_name: String(r.title || ''),
      category: options?.category || String(r.type || '') || null,
      city: parseCity(address),
      zip: parseZip(address),
      website: r.website ? String(r.website) : null,
      phone: r.phone ? String(r.phone) : null,
      summary: buildSummary(r),
      address,
      rating: typeof r.rating === 'number' ? r.rating : null,
      reviews: typeof r.reviews === 'number' ? r.reviews : null,
      latitude: r.gps_coordinates && typeof (r.gps_coordinates as Record<string, number>).latitude === 'number'
        ? (r.gps_coordinates as Record<string, number>).latitude
        : null,
      longitude: r.gps_coordinates && typeof (r.gps_coordinates as Record<string, number>).longitude === 'number'
        ? (r.gps_coordinates as Record<string, number>).longitude
        : null,
    };
  }).filter((l) => l.company_name);

  // Extract remaining searches from account info header if available
  const searchesRemaining = typeof data.search_metadata?.total_time_taken === 'number'
    ? null // SerpAPI doesn't return remaining in search results
    : null;

  return { leads, searchesRemaining };
}

export async function getAccountInfo(): Promise<{ searches_remaining: number; plan: string }> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new Error('Missing SERPAPI_API_KEY environment variable');

  const res = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`);
  if (!res.ok) throw new Error(`SerpAPI account check failed (${res.status})`);

  const data = await res.json();
  return {
    searches_remaining: data.total_searches_left ?? 0,
    plan: data.plan_name || 'unknown',
  };
}
