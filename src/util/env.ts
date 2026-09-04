/**
 * env.ts — parses process.env with defaults matching .env.example.
 * Validates values that must be positive numbers or specific enums.
 * Never prints PRIVATE_KEY.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Minimal .env loader — no dependency on `dotenv`.
function loadDotEnv(): void {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return;
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!isFinite(n)) throw new Error(`env ${name} must be numeric, got ${v}`);
  return n;
}

function str(name: string, def: string = ''): string {
  return process.env[name] ?? def;
}

function bool(name: string, def: boolean): boolean {
  const v = process.env[name]?.toLowerCase();
  if (v === undefined || v === '') return def;
  if (v === 'on' || v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'off' || v === 'false' || v === '0' || v === 'no') return false;
  throw new Error(`env ${name} must be on/off, got ${v}`);
}

function list(name: string): string[] {
  const v = process.env[name];
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export const env = {
  RPC_URL: str('RPC_URL'),
  RPC_URL_EXTRA: list('RPC_URL_EXTRA'),
  RPC_WS_URL: str('RPC_WS_URL'),
  RPC_IN_FLIGHT: num('RPC_IN_FLIGHT', 3),
  RPC_SPACING_MS: num('RPC_SPACING_MS', 50),
  RPC_LOGS_SPACING_MS: num('RPC_LOGS_SPACING_MS', 400),
  RPC_COOLDOWN_MS: num('RPC_COOLDOWN_MS', 1500),

  PRIVATE_KEY: str('PRIVATE_KEY'),

  SNIPE_ETH: num('SNIPE_ETH', 0.01),
  SNIPE_MAX_TAX_BPS: num('SNIPE_MAX_TAX_BPS', 300),
  SNIPE_BUDGET_ETH: num('SNIPE_BUDGET_ETH', 0.05),
  SNIPE_MAX_OPEN: num('SNIPE_MAX_OPEN', 3),
  SNIPE_MIN_SCORE: num('SNIPE_MIN_SCORE', 60),
  SNIPE_ADAPTIVE_TAX: bool('SNIPE_ADAPTIVE_TAX', true),

  TAKE_PROFIT_PCT: num('TAKE_PROFIT_PCT', 80),
  STOP_LOSS_PCT: num('STOP_LOSS_PCT', -35),
  TRAILING_PCT: num('TRAILING_PCT', 25),
  MAX_HOLD_MIN: num('MAX_HOLD_MIN', 45),

  BOARD_PORT: num('BOARD_PORT', 4663),
  BOARD_HOST: str('BOARD_HOST', '127.0.0.1'),

  SCORING_CONFIG: str('SCORING_CONFIG'),

  TELEGRAM_BOT_TOKEN: str('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_CHAT_ID: str('TELEGRAM_CHAT_ID'),
  TELEGRAM_TWO_WAY: bool('TELEGRAM_TWO_WAY', false),
  DISCORD_WEBHOOK_URL: str('DISCORD_WEBHOOK_URL'),

  REF_AXIOM: str('REF_AXIOM'),
  REF_FOMO: str('REF_FOMO'),
} as const;
