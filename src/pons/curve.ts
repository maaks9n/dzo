/**
 * curve.ts — pons v2 bonding-curve math in the protocol's integer order.
 *
 * The protocol uses the standard x*y=k invariant with two fees applied per
 * side: 1% base + creator tax. The opening tax on buys decays linearly from
 * snipeTaxStartBps to 0 over snipeTaxSeconds seconds. Rounding matches the
 * on-chain contract so that our minTokensOut computation matches what the
 * transaction will actually mint.
 */

const BPS = 10_000n;

export interface CurveState {
  reserveEth: bigint;
  reserveTokens: bigint;
  phantomReserveEth: bigint;   // constant-product phantom liquidity
  creatorTaxBps: number;
  baseFeeBps: number;          // 100 by default (1%)
  snipeTaxStartBps: number;    // 9900
  snipeTaxSeconds: number;     // 3
  launchTimestamp: number;     // seconds
}

/** Current opening-tax bps at `nowSec`. Linear decay 9900 → 0 over window. */
export function currentSnipeTaxBps(state: CurveState, nowSec: number): number {
  const dt = Math.max(0, nowSec - state.launchTimestamp);
  if (dt >= state.snipeTaxSeconds) return 0;
  const remaining = state.snipeTaxSeconds - dt;
  return Math.max(0, Math.round(state.snipeTaxStartBps * (remaining / state.snipeTaxSeconds)));
}

/** Cap opening tax so the buyer never keeps less than `minKeepBps` of input. */
export function cappedSnipeTaxBps(taxBps: number, minKeepBps = 100): number {
  return Math.min(taxBps, 10_000 - minKeepBps);
}

/**
 * Quote tokens out for a given ethIn on a fresh curve.
 * ethAfterFee = ethIn * (1 - baseFee - creatorTax - openingTax)
 * tokensOut = phantom * ethAfterFee / (phantom + ethAfterFee) * tokensPerEth
 * We reproduce the contract's integer order.
 */
export function quoteBuy(state: CurveState, ethIn: bigint, openingTaxBps: number): bigint {
  const cappedOpening = BigInt(cappedSnipeTaxBps(openingTaxBps));
  const totalFeeBps = BigInt(state.baseFeeBps + state.creatorTaxBps) + cappedOpening;
  const feeMul = BPS - totalFeeBps;
  if (feeMul <= 0n) return 0n;
  const ethAfter = (ethIn * feeMul) / BPS;

  const x0 = state.reserveEth + state.phantomReserveEth;
  const y0 = state.reserveTokens;
  const x1 = x0 + ethAfter;
  // constant product: x0 * y0 = x1 * y1 → y1 = x0*y0/x1
  const y1 = (x0 * y0) / x1;
  return y0 - y1;
}

/** Quote ethOut for tokensIn (sell). Symmetric fees. */
export function quoteSell(state: CurveState, tokensIn: bigint): bigint {
  const x0 = state.reserveEth + state.phantomReserveEth;
  const y0 = state.reserveTokens;
  const y1 = y0 + tokensIn;
  const x1 = (x0 * y0) / y1;
  const ethGross = x0 - x1;
  const totalFeeBps = BigInt(state.baseFeeBps + state.creatorTaxBps);
  return (ethGross * (BPS - totalFeeBps)) / BPS;
}

/**
 * Compute a safe minTokensOut given a quote and desired slippage bps.
 * Contract rounding is truncation, so we subtract slippage before comparing.
 */
export function withSlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / BPS;
}
