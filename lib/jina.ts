const JINA_TIMEOUT_MS = 10000;

/**
 * Fetch a URL via Jina Reader API — returns clean markdown content.
 * Handles JS-rendered sites (Wix, Squarespace, React, etc.)
 */
export async function jinaReader(url: string): Promise<string | null> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/plain',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
