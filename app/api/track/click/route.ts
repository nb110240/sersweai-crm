import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';

function isSafeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const emailId = searchParams.get('email_id');
  const leadId = searchParams.get('lead_id');
  const url = searchParams.get('url') || '';

  if (emailId && isSafeUrl(url)) {
    try {
      const supabase = getSupabase();
      await supabase.from('email_events').insert({
        email_id: emailId,
        lead_id: leadId,
        event_type: 'click',
        url
      });
    } catch {
      // Ignore tracking failures when config is missing.
    }
  }

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  return NextResponse.redirect(url, 302);
}
