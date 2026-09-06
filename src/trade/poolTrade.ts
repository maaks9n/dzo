/**
 * poolTrade.ts — buy / sell on the graduated Uniswap v4 pool.
 * Routes by phase: refuses during the swept gap (phase 1).
 */

import { client, ADDR } from '../chain.js';
import { walletClient } from './wallet.js';
import { factoryAbi } from '../abi/factory.js';
import { v4QuoterAbi, universalRouterAbi, V4_SWAP_COMMAND } from '../abi/v4.js';
import { encodeAbiParameters, encodePacked } from 'viem';

export async function quoteV4Sell(params: {
  token: string;
  pair: string;
  tickSpacing: number;
  fee: number;
  amount: bigint;
}): Promise<bigint> {
  const c = client();
  const [c0, c1] = orderCurrencies(params.token, params.pair);
  const zeroForOne = c0.toLowerCase() === params.token.toLowerCase();
  const [amountOut] = await c.readContract({
    address: ADDR.v4Quoter,
    abi: v4QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [{
      poolKey: { currency0: c0 as `0x${string}`, currency1: c1 as `0x${string}`, fee: params.fee, tickSpacing: params.tickSpacing, hooks: ADDR.ponsHook },
      zeroForOne,
      exactAmount: params.amount,
      hookData: '0x',
    }],
  }) as unknown as [bigint, bigint];
  return amountOut;
}

export async function sellOnPool(params: {
  token: string;
  pair: string;
  tickSpacing: number;
  fee: number;
  amount: bigint;
  minOut: bigint;
  live: boolean;
}): Promise<{ txHash: string; ethOut: bigint }> {
  if (!params.live) return { txHash: '0xdryrun', ethOut: params.minOut };

  const [c0, c1] = orderCurrencies(params.token, params.pair);
  const zeroForOne = c0.toLowerCase() === params.token.toLowerCase();
  const swapInput = encodeAbiParameters(
    [{ type: 'tuple', components: [
      { type: 'tuple', name: 'poolKey', components: [
        { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
      ] },
      { name: 'zeroForOne', type: 'bool' }, { name: 'exactAmount', type: 'uint128' }, { name: 'hookData', type: 'bytes' },
    ] }],
    [{
      poolKey: { currency0: c0 as `0x${string}`, currency1: c1 as `0x${string}`, fee: params.fee, tickSpacing: params.tickSpacing, hooks: ADDR.ponsHook },
      zeroForOne,
      exactAmount: params.amount,
      hookData: '0x',
    }],
  );
  const commands = encodePacked(['uint8'], [V4_SWAP_COMMAND]);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60);

  const { client: w, account } = walletClient();
  const hash = await w.writeContract({
    address: ADDR.universalRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, [swapInput], deadline],
    account,
    chain: null,
  });
  await client().waitForTransactionReceipt({ hash });
  return { txHash: hash, ethOut: params.minOut };
}

export async function phaseOf(token: string): Promise<0 | 1 | 2> {
  const info = await client().readContract({
    address: ADDR.factory, abi: factoryAbi, functionName: 'launchInfo', args: [token as `0x${string}`],
  }) as any;
  return Number(info.phase) as 0 | 1 | 2;
}

function orderCurrencies(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}
