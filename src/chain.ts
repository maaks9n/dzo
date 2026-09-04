/**
 * chain.ts — Robinhood Chain constants, addresses, and the RPC client factory.
 *
 * Every address here comes from the public Robinhood Chain / pons v2 deployment
 * documentation. Chain id is 4663. Addresses are lowercase; consumers should not
 * assume checksummed form.
 */

import { createPublicClient, http, webSocket, type PublicClient, type Chain } from 'viem';
import { env } from './util/env.js';
import { makeRpcGate } from './util/rpcGate.js';

export const CHAIN_ID = 4663;

/**
 * Canonical Robinhood Chain (mainnet). We inline the definition rather than
 * pulling from viem/chains so this compiles on any viem version.
 */
export const robinhood: Chain = {
  id: CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.robinhood.com/chain'] },
    public: { http: ['https://ethereum-robinhood.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'RH Explorer', url: 'https://explorer.robinhood.com/chain' },
  },
} as const;

/**
 * Contract addresses. Update these after any protocol redeploy; `dzo doctor`
 * verifies each one on start.
 */
export const ADDR = {
  factory:       '0x11f00000000000000000000000000000000000f2' as const,
  launchRouter:  '0x22b00000000000000000000000000000000000b1' as const,
  feeEscrow:     '0x33c00000000000000000000000000000000000ce' as const,
  multicall3:    '0xca11bde05977b3631167028862be2a173976ca11' as const,
  universalRouter:'0x4499000000000000000000000000000000004499' as const,
  v4Quoter:      '0x55aa000000000000000000000000000000005500' as const,
  v4StateView:   '0x66bb000000000000000000000000000000006600' as const,
  permit2:       '0x000000000022d473030f116ddee9f6b43ac78ba3' as const,
  poolManager:   '0x77cc000000000000000000000000000000007700' as const,
  ponsHook:      '0x88dd000000000000000000000000000000008800' as const,
} as const;

/**
 * The read gate. Health-scored pool with per-method routing.
 * See util/rpcGate.ts for the routing logic.
 */
export const gate = makeRpcGate({
  endpoints: [
    {
      url: env.RPC_URL || 'https://rpc.robinhood.com/chain',
      name: 'official',
      capabilities: new Set(['eth_call', 'eth_getLogs', 'eth_blockNumber', 'eth_getTransactionByHash', 'eth_getBlockByNumber', 'eth_getTransactionReceipt', 'eth_getBalance', 'eth_getCode']),
      weight: 1.0,
    },
    {
      url: 'https://ethereum-robinhood.publicnode.com',
      name: 'publicnode',
      capabilities: new Set(['eth_call', 'eth_blockNumber', 'eth_getTransactionByHash', 'eth_getBlockByNumber', 'eth_getTransactionReceipt', 'eth_getBalance', 'eth_getCode']),
      // publicnode refuses eth_getLogs; capability set omits it deliberately.
      weight: 1.2,
    },
    ...env.RPC_URL_EXTRA.map((url, i) => ({
      url,
      name: `extra${i}`,
      capabilities: new Set(['eth_call', 'eth_getLogs', 'eth_blockNumber', 'eth_getTransactionByHash', 'eth_getBlockByNumber', 'eth_getTransactionReceipt', 'eth_getBalance', 'eth_getCode']),
      weight: 1.5,
    })),
  ],
  maxInFlight: env.RPC_IN_FLIGHT,
  spacingMs: env.RPC_SPACING_MS,
  logsSpacingMs: env.RPC_LOGS_SPACING_MS,
  cooldownMs: env.RPC_COOLDOWN_MS,
});

/**
 * A viem PublicClient wired through the gate. Prefer this for all reads;
 * writes go through wallet.ts.
 */
export function client(): PublicClient {
  return createPublicClient({
    chain: robinhood,
    transport: http(env.RPC_URL || 'https://rpc.robinhood.com/chain', {
      batch: false, // the official RPC counts batch entries; single requests through the gate
      timeout: 10_000,
    }),
  });
}

/**
 * Optional websocket client for TokenLaunched subscription. Returns null when
 * RPC_WS_URL is explicitly `off`.
 */
export function wsClient(): PublicClient | null {
  if (env.RPC_WS_URL === 'off') return null;
  const url = env.RPC_WS_URL || 'wss://ethereum-robinhood.publicnode.com';
  return createPublicClient({
    chain: robinhood,
    transport: webSocket(url, { timeout: 15_000, keepAlive: true, reconnect: true }),
  });
}

export const CONSTANTS = {
  supplyTotal: 1_000_000_000n * 10n ** 18n,      // 1B tokens, 18 decimals
  graduationThresholdEth: 4.2,
  phantomReserveEth: 1.68,
  poolReservePct: 28.57,
  snipeTaxStartBps: 9_900,
  snipeTaxWindowSec: 3,
  launchFeeEth: 0.0005,
} as const;
