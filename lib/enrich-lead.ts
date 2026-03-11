import Anthropic from '@anthropic-ai/sdk';
import { jinaReader } from './jina';

export type EnrichResult = {
  opener: string;
  details: {
    services?: string;
    stack?: string;
    customerProfile?: string;
    observation?: string;
    specificDetail?: string;
    followUpAngles?: string;
  };
};

/**
 * Visit a lead's website, analyze it with Claude, and generate
 * a personalized cold email opener + business details.
 * Uses Jina Reader for clean markdown extraction from JS-rendered sites.
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

  // Fetch homepage + contact page in parallel via Jina Reader
  const [homepage, contactPage] = await Promise.all([
    jinaReader(baseUrl),
    jinaReader(`${new URL(baseUrl).origin}/contact`),
  ]);

  const siteContent = [homepage, contactPage]
    .filter(Boolean)
    .join('\n\n---\n\n')
    .slice(0, 8000);

  if (!siteContent || siteContent.length < 50) return null;

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are helping write personalized cold email content for a sales outreach to a local business. Be PAINFULLY specific — reference real details from their website. Generic = ignored.

Business: ${lead.company_name}
Category: ${lead.category}
City: ${lead.city}

Website content:
${siteContent}

Return ONLY a JSON object with these fields:
- "opener": A 1-sentence hyper-specific observation. Reference a REAL detail: a named service they offer, a specific page on their site, their service area, a pricing detail, a team member name, how they describe themselves, or a visible gap (phone-only booking, no online forms, manual processes). NOT generic. Starting with "I noticed..." or "I saw that...". Under 25 words. Do NOT mention AI or automation.
- "services": Their main services/offerings (comma-separated, 3-5 items max)
- "stack": Tech/tools/platforms visible on their site (e.g., "Squarespace", "Jane App", "Mindbody"). Say "unknown" if not detectable.
- "customerProfile": Who their target customer is in 5-10 words
- "observation": One specific automation opportunity (e.g., "booking requires calling the front desk", "quote requests go to a generic email", "no online scheduling for consultations"). Under 15 words.
- "specificDetail": One concrete detail that proves you looked at their site — a named service, a team member, a location, a recent blog post, a promotion, a review count. This should be something only visible by actually visiting their website. Under 20 words.
- "followUpAngles": Three different angles for follow-up emails, separated by " | ". Each should be a fresh observation or value-add, NOT "just checking in." Examples: a stat about their industry, a reference to a specific service they offer, a concrete suggestion. Each angle under 20 words.`,
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
        specificDetail: parsed.specificDetail,
        followUpAngles: parsed.followUpAngles,
      },
    };
  } catch {
    return null;
  }
}
