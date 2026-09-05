/**
 * enrich.ts — one multicall + a few tx reads per launch.
 *
 * Reads for a single launch:
 *   - metadata (name, symbol, description, links)
 *   - factory record (creatorTaxBps, feeRecipient, phase, pair, tickSpacing)
 *   - exempt wallets list
 *   - curve state (reserveEth, reserveTokens, phantom)
 *   - dev buy from the launch transaction's CurveBuy events
 * Everything bundled in `aggregate3` where possible.
 *
 * Rate-limited by the RPC gate (see util/rpcGate.ts).
 */

import { decodeEventLog, encodeFunctionData, decodeFunctionResult, parseAbiItem } from 'viem';
import { client, ADDR } from '../chain.js';
import { factoryAbi } from '../abi/factory.js';
import { curveAbi } from '../abi/curve.js';
import { erc20Abi } from '../abi/erc20.js';
import { multicall3Abi } from '../abi/multicall3.js';
import type { LaunchEvent } from './launches.js';

export interface EnrichedLaunch {
  event: LaunchEvent;
  name: string;
  symbol: string;
  description: string;
  links: { x: string | null; website: string | null; telegram: string | null };
  creatorTaxBps: number;
  feeRecipient: string;
  phase: 0 | 1 | 2;
  pair: string;
  tickSpacing: number;
  poolFee: number;
  exemptWallets: string[];
  reserveEth: bigint;
  reserveTokens: bigint;
  devBuyShare: number;              // 0..1 of total supply
  devBuyWei: bigint;                // ETH the deployer spent
  isEthPair: boolean;
  enrichedInMs: number;
}

const CURVE_BUY = parseAbiItem(
  'event CurveBuy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 taxBps)'
);

export async function enrichLaunch(ev: LaunchEvent): Promise<EnrichedLaunch> {
  const t0 = Date.now();
  const c = client();

  // Build calls for aggregate3
  const calls = [
    { target: ev.token, allowFailure: true, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'name' }) },
    { target: ev.token, allowFailure: true, callData: encodeFunctionData({ abi: erc20Abi, functionName: 'symbol' }) },
    { target: ADDR.factory, allowFailure: true, callData: encodeFunctionData({ abi: factoryAbi, functionName: 'launchInfo', args: [ev.token as `0x${string}`] }) },
    { target: ADDR.factory, allowFailure: true, callData: encodeFunctionData({ abi: factoryAbi, functionName: 'exemptWallets', args: [ev.token as `0x${string}`] }) },
    { target: ev.curve, allowFailure: true, callData: encodeFunctionData({ abi: curveAbi, functionName: 'reserveEth' }) },
    { target: ev.curve, allowFailure: true, callData: encodeFunctionData({ abi: curveAbi, functionName: 'reserveTokens' }) },
  ];

  const results = await c.readContract({
    address: ADDR.multicall3,
    abi: multicall3Abi,
    functionName: 'aggregate3',
    args: [calls],
  }) as ReadonlyArray<{ success: boolean; returnData: `0x${string}` }>;

  const name = safeDecode(results[0], erc20Abi, 'name') as string || '';
  const symbol = safeDecode(results[1], erc20Abi, 'symbol') as string || '';
  const info = safeDecode(results[2], factoryAbi, 'launchInfo') as any;
  const exempt = safeDecode(results[3], factoryAbi, 'exemptWallets') as string[] || [];
  const reserveEth = safeDecode(results[4], curveAbi, 'reserveEth') as bigint || 0n;
  const reserveTokens = safeDecode(results[5], curveAbi, 'reserveTokens') as bigint || 0n;

  // Metadata: JSON at metadataURI. IPFS or plain https.
  let description = '';
  let links = { x: null as string | null, website: null as string | null, telegram: null as string | null };
  if (ev.metadataURI) {
    try {
      const url = ev.metadataURI.startsWith('ipfs://')
        ? `https://ipfs.io/ipfs/${ev.metadataURI.slice(7)}`
        : ev.metadataURI;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const meta = await res.json() as { description?: string; x?: string; website?: string; telegram?: string };
        description = meta.description ?? '';
        links = { x: meta.x ?? null, website: meta.website ?? null, telegram: meta.telegram ?? null };
      }
    } catch { /* ignore metadata failures */ }
  }

  // Dev buy: parse CurveBuy events in the launch tx
  let devBuyWei = 0n;
  let devBuyTokens = 0n;
  try {
    const receipt = await c.getTransactionReceipt({ hash: ev.txHash as `0x${string}` });
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== ev.curve.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: [CURVE_BUY], data: log.data, topics: log.topics });
        if ((decoded.args.buyer as string).toLowerCase() === ev.deployer.toLowerCase()) {
          devBuyWei += decoded.args.ethIn as bigint;
          devBuyTokens += decoded.args.tokensOut as bigint;
        }
      } catch { /* not a CurveBuy */ }
    }
  } catch { /* rare tx read failure */ }

  const totalSupply = 1_000_000_000n * 10n ** 18n;
  const devBuyShare = devBuyTokens > 0n ? Number((devBuyTokens * 10_000n) / totalSupply) / 10_000 : 0;

  const creatorTaxBps = Number(info?.creatorTaxBps ?? 0n);
  const feeRecipient = (info?.feeRecipient ?? ev.deployer).toLowerCase();
  const phase = Number(info?.phase ?? 0) as 0 | 1 | 2;
  const pair = (info?.pair ?? ev.pair).toLowerCase();
  const tickSpacing = Number(info?.tickSpacing ?? 60);
  const poolFee = Number(info?.poolFee ?? 3000);
  const isEthPair = pair === '0x0000000000000000000000000000000000000000';

  return {
    event: ev,
    name, symbol, description, links,
    creatorTaxBps, feeRecipient, phase, pair, tickSpacing, poolFee,
    exemptWallets: exempt.map((a) => a.toLowerCase()),
    reserveEth, reserveTokens,
    devBuyShare, devBuyWei,
    isEthPair,
    enrichedInMs: Date.now() - t0,
  };
}

function safeDecode(res: { success: boolean; returnData: `0x${string}` } | undefined, abi: any, fn: string): unknown {
  if (!res || !res.success) return undefined;
  try {
    return decodeFunctionResult({ abi, functionName: fn, data: res.returnData });
  } catch {
    return undefined;
  }
}
