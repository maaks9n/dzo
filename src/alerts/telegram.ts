/**
 * telegram.ts — optional Telegram Bot API notifications.
 * Two-way commands opt-in via TELEGRAM_TWO_WAY=on: replies of the form
 * `close 0xabc…`, `pause`, `resume`, `status` are handled.
 */

import { env } from '../util/env.js';

export async function tgSend(text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
  } catch { /* alerts are best-effort */ }
}

export interface TgHandlers {
  onClose: (token: string) => Promise<void>;
  onPause: () => void;
  onResume: () => void;
  onStatus: () => string;
}

export function tgListen(handlers: TgHandlers): void {
  if (!env.TELEGRAM_TWO_WAY || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  let offset = 0;
  const poll = async () => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
      const j = await r.json() as { ok: boolean; result: Array<{ update_id: number; message?: { chat: { id: number }; text: string } }> };
      if (j.ok) {
        for (const u of j.result) {
          offset = u.update_id + 1;
          if (!u.message) continue;
          if (String(u.message.chat.id) !== env.TELEGRAM_CHAT_ID) continue;
          const text = u.message.text.trim();
          if (text === 'pause') { handlers.onPause(); await tgSend('paused'); }
          else if (text === 'resume') { handlers.onResume(); await tgSend('resumed'); }
          else if (text === 'status') { await tgSend(handlers.onStatus()); }
          else if (text.startsWith('close ')) { const token = text.slice(6).trim(); await handlers.onClose(token); await tgSend(`closed ${token}`); }
        }
      }
    } catch { /* keep polling */ }
    setImmediate(poll);
  };
  poll();
}
