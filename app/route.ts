import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// IMPORTANT: The live homepage is public/marketing.html (light theme).
// Do NOT change this to index.html or any other file — that is the dark theme used for presentations only.
const HOMEPAGE_FILE = 'public/marketing.html';

export async function GET() {
  let html = readFileSync(join(process.cwd(), HOMEPAGE_FILE), 'utf-8');

  // Inject pageview tracking beacon
  const trackingScript = `<script>
(function(){try{fetch('/api/track/pageview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:location.pathname,referrer:document.referrer}),keepalive:true})}catch(e){}})();
</script>`;
  html = html.replace('</body>', trackingScript + '</body>');

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
