import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteBuy, quoteSell, currentSnipeTaxBps, cappedSnipeTaxBps, withSlippage, type CurveState } from '../src/pons/curve.js';

const freshState: CurveState = {
  reserveEth: 0n,
  reserveTokens: 1_000_000_000n * 10n ** 18n,
  phantomReserveEth: 1_680_000_000_000_000_000n,   // 1.68 ETH
  creatorTaxBps: 100,
  baseFeeBps: 100,
  snipeTaxStartBps: 9900,
  snipeTaxSeconds: 3,
  launchTimestamp: 1_000,
};

test('opening tax decay is linear over 3s', () => {
  assert.equal(currentSnipeTaxBps(freshState, 1_000), 9900);
  assert.ok(currentSnipeTaxBps(freshState, 1_001) < 9900);
  assert.equal(currentSnipeTaxBps(freshState, 1_003), 0);
  assert.equal(currentSnipeTaxBps(freshState, 1_010), 0);
});

test('opening tax is capped so buyer keeps at least 1%', () => {
  assert.equal(cappedSnipeTaxBps(9950), 9900);
  assert.equal(cappedSnipeTaxBps(9900), 9900);
  assert.equal(cappedSnipeTaxBps(5000), 5000);
});

test('a small buy on a fresh curve returns non-zero tokens', () => {
  const q = quoteBuy(freshState, BigInt(5.35e16), 0);   // 0.0535 ETH, tax paid off
  assert.ok(q > 0n);
});

test('round trip loses more than the base fee', () => {
  const ethIn = BigInt(1e17);   // 0.1 ETH
  const tokens = quoteBuy(freshState, ethIn, 0);
  const advanced: CurveState = { ...freshState, reserveEth: (ethIn * 98n) / 100n, reserveTokens: freshState.reserveTokens - tokens };
  const ethOut = quoteSell(advanced, tokens);
  assert.ok(ethOut < ethIn);
});

test('withSlippage subtracts the requested bps', () => {
  const q = 1000n;
  assert.equal(withSlippage(q, 100), 990n);
  assert.equal(withSlippage(q, 500), 950n);
});
