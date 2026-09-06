/**
 * wallet.ts — the ONLY file that reads PRIVATE_KEY.
 *
 * We keep this small so any future audit can reason about the whole signing
 * surface in one screen.
 */

import { createWalletClient, http, type WalletClient, type Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '../util/env.js';
import { robinhood } from '../chain.js';

let cached: { client: WalletClient; account: Account } | null = null;

export function walletClient(): { client: WalletClient; account: Account } {
  if (cached) return cached;
  if (!env.PRIVATE_KEY) throw new Error('PRIVATE_KEY not set — this action requires --live and a key in .env');
  const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: robinhood,
    transport: http(env.RPC_URL || undefined, { timeout: 10_000 }),
  });
  cached = { client, account };
  return cached;
}

export function walletAddress(): string {
  return walletClient().account.address;
}
