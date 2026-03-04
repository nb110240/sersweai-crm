import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  let html = readFileSync(join(process.cwd(), 'public/marketing.html'), 'utf-8');

  // Inject pageview tracking beacon
  const trackingScript = `<script>
(function(){try{fetch('/api/track/pageview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:location.pathname,referrer:document.referrer}),keepalive:true})}catch(e){}})();
</script>`;
  html = html.replace('</body>', trackingScript + '</body>');

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
