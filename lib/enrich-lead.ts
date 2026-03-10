import Anthropic from '@anthropic-ai/sdk';

const FETCH_TIMEOUT_MS = 8000;

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadCRM/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip scripts, styles, and HTML tags to get readable text
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000); // Keep it under token limits
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type EnrichResult = {
  opener: string;
  details: {
    services?: string;
    stack?: string;
    customerProfile?: string;
    observation?: string;
  };
};

/**
 * Visit a lead's website, analyze it with Claude, and generate
 * a personalized cold email opener + business details.
 */
export async function enrichLead(lead: {
  company_name: string;
  category: string;
  city: string;
  website: string | null;
}): Promise<EnrichResult | null> {
  if (!lead.website) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const baseUrl = lead.website.startsWith('http')
    ? lead.website
    : `https://${lead.website}`;

  // Fetch homepage + contact page in parallel
  const [homepage, contactPage] = await Promise.all([
    fetchPage(baseUrl),
    fetchPage(`${new URL(baseUrl).origin}/contact`),
  ]);

  const siteContent = [homepage, contactPage].filter(Boolean).join('\n\n---\n\n');

  if (!siteContent || siteContent.length < 50) return null;

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `You are helping write a personalized cold email opener for a sales outreach. Analyze this business website content and return a JSON object.

Business: ${lead.company_name}
Category: ${lead.category}
City: ${lead.city}

Website content:
${siteContent}

Return ONLY a JSON object with these fields:
- "opener": A 1-sentence personalized observation about their business that shows you actually looked at their website. Reference something specific — a service they offer, how they position themselves, their target customer, something on their site that could be improved, or a gap where automation would help. Do NOT be generic. Do NOT mention AI or automation in the opener — just show you know their business. Write it as a natural sentence starting with "I noticed..." or "I saw that..." or "I came across...". Keep it under 25 words.
- "services": Their main services/offerings (comma-separated, 3-5 items max)
- "stack": Any tech/tools/platforms visible on their site (e.g., "Squarespace", "Jane App", "Mindbody", "WordPress"). Say "unknown" if not detectable.
- "customerProfile": Who their target customer appears to be in 5-10 words
- "observation": One specific thing about their business that automation could improve (e.g., "booking is phone-only", "no online intake forms", "manual quote requests"). Keep it under 15 words.`,
      },
    ],
  });

  try {
    const text =
      message.content[0].type === 'text' ? message.content[0].text : '';
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      opener: parsed.opener,
      details: {
        services: parsed.services,
        stack: parsed.stack,
        customerProfile: parsed.customerProfile,
        observation: parsed.observation,
      },
    };
  } catch {
    return null;
  }
}
