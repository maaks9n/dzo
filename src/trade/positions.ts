/**
 * positions.ts — JSON store and the pure exit-rule function.
 * The store lives in data/positions.json. One engine per data/ directory.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Position {
  token: string;
  symbol: string;
  entryBlock: number;
  entryTimestamp: number;
  entryEthSpent: string;      // stringified bigint
  entryTokens: string;
  peakMarkPct: number;
  currentMarkPct: number;
  status: 'open' | 'closed';
  closedAt?: number;
  closedReason?: 'take-profit' | 'stop-loss' | 'trailing' | 'max-hold' | 'manual';
  closedEthOut?: string;
  wallet?: string;            // multi-wallet mode
}

const DATA_DIR = 'data';
const PATH = join(DATA_DIR, 'positions.json');

export function loadPositions(): Position[] {
  if (!existsSync(PATH)) return [];
  try {
    return JSON.parse(readFileSync(PATH, 'utf8')) as Position[];
  } catch {
    return [];
  }
}

export function savePositions(p: Position[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PATH, JSON.stringify(p, null, 2));
}

export interface ExitRules {
  takeProfitPct: number;      // +80
  stopLossPct: number;        // -35
  trailingPct: number;        // 25 (below peak)
  maxHoldMin: number;         // 45
}

export type ExitDecision =
  | { close: false }
  | { close: true; reason: 'take-profit' | 'stop-loss' | 'trailing' | 'max-hold' };

/** Pure. Given a position and current mark, decide whether to close. */
export function shouldExit(pos: Position, nowTs: number, rules: ExitRules): ExitDecision {
  const held = (nowTs - pos.entryTimestamp) / 60;
  if (held >= rules.maxHoldMin) return { close: true, reason: 'max-hold' };
  if (pos.currentMarkPct >= rules.takeProfitPct) return { close: true, reason: 'take-profit' };
  if (pos.currentMarkPct <= rules.stopLossPct) return { close: true, reason: 'stop-loss' };
  const trailingLevel = pos.peakMarkPct - rules.trailingPct;
  if (pos.peakMarkPct > 0 && pos.currentMarkPct <= trailingLevel) return { close: true, reason: 'trailing' };
  return { close: false };
}
