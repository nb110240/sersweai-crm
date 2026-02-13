import { NextRequest } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';

const pixel = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const emailId = searchParams.get('email_id');
  const leadId = searchParams.get('lead_id');

  if (emailId) {
    try {
      const supabase = getSupabase();
      await supabase.from('email_events').insert({
        email_id: emailId,
        lead_id: leadId,
        event_type: 'open'
      });
    } catch {
      // Ignore tracking failures when config is missing.
    }
  }

  return new Response(pixel, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    }
  });
}
