/**
 * v4.ts — pool key derivation and pool-id computation.
 * The factory records the pair, tick spacing and fee at launch time; we
 * reconstruct the poolKey and its id from those fields.
 */

import { keccak256, encodeAbiParameters } from 'viem';
import { ADDR } from '../chain.js';

export interface PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

export function poolKey(token: string, pair: string, fee: number, tickSpacing: number): PoolKey {
  const [c0, c1] = token.toLowerCase() < pair.toLowerCase() ? [token, pair] : [pair, token];
  return { currency0: c0, currency1: c1, fee, tickSpacing, hooks: ADDR.ponsHook };
}

export function poolId(k: PoolKey): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' },
    ],
    [k.currency0 as `0x${string}`, k.currency1 as `0x${string}`, k.fee, k.tickSpacing, k.hooks as `0x${string}`],
  );
  return keccak256(encoded);
}
