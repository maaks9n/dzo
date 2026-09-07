import { env } from '../util/env.js';

export async function discordSend(content: string): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch { /* best-effort */ }
}
