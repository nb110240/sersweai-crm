import { SupabaseClient } from '@supabase/supabase-js';

const OPEN_THRESHOLD = 3;
const TELEGRAM_TIMEOUT_MS = 5000;

/**
 * Check if a lead is "hot" (3+ opens or any click) and send a Telegram alert.
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.
 */
export async function checkHotLead(
  supabase: SupabaseClient,
  leadId: string,
  eventType: 'open' | 'click'
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  // Get lead info
  const { data: lead } = await supabase
    .from('leads')
    .select('company_name, category, email, first_name, status')
    .eq('id', leadId)
    .single();

  if (!lead) return;

  // Don't alert for leads already marked as hot or replied
  if (lead.status === 'Hot Lead' || lead.status === 'Replied') return;

  if (eventType === 'click') {
    // Any click = hot lead immediately
    await supabase
      .from('leads')
      .update({ status: 'Hot Lead' })
      .eq('id', leadId);

    await sendTelegramAlert(botToken, chatId,
      `🔥 *HOT LEAD — Click!*\n\n` +
      `*${lead.company_name}*\n` +
      `${lead.category || 'Unknown category'}\n` +
      `${lead.first_name || 'Unknown'} — ${lead.email || 'no email'}\n\n` +
      `They clicked through to your site. Reply ASAP!`
    );
    return;
  }

  // For opens: check total open count
  const { count } = await supabase
    .from('email_events')
    .select('*', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('event_type', 'open');

  if ((count || 0) >= OPEN_THRESHOLD) {
    await supabase
      .from('leads')
      .update({ status: 'Hot Lead' })
      .eq('id', leadId);

    await sendTelegramAlert(botToken, chatId,
      `🔥 *HOT LEAD — ${count}+ Opens!*\n\n` +
      `*${lead.company_name}*\n` +
      `${lead.category || 'Unknown category'}\n` +
      `${lead.first_name || 'Unknown'} — ${lead.email || 'no email'}\n\n` +
      `They've opened your email ${count} times. Follow up now!`
    );
  }
}

async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch {
    // Don't let alert failures break tracking
  } finally {
    clearTimeout(timer);
  }
}
