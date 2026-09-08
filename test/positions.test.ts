import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldExit, type Position, type ExitRules } from '../src/trade/positions.js';

const rules: ExitRules = { takeProfitPct: 80, stopLossPct: -35, trailingPct: 25, maxHoldMin: 45 };

function pos(over: Partial<Position>): Position {
  return {
    token: '0x1', symbol: 'T', entryBlock: 1, entryTimestamp: 1_000_000,
    entryEthSpent: '10000000000000000', entryTokens: '100',
    peakMarkPct: 0, currentMarkPct: 0, status: 'open', ...over,
  };
}

test('take-profit fires at +80%', () => {
  const d = shouldExit(pos({ currentMarkPct: 80, peakMarkPct: 80 }), 1_000_060, rules);
  assert.deepEqual(d, { close: true, reason: 'take-profit' });
});

test('stop-loss fires at -35%', () => {
  const d = shouldExit(pos({ currentMarkPct: -40, peakMarkPct: -20 }), 1_000_060, rules);
  assert.deepEqual(d, { close: true, reason: 'stop-loss' });
});

test('trailing fires when 25 below peak', () => {
  const d = shouldExit(pos({ peakMarkPct: 60, currentMarkPct: 30 }), 1_000_060, rules);
  assert.deepEqual(d, { close: true, reason: 'trailing' });
});

test('max-hold fires at 45 minutes', () => {
  const d = shouldExit(pos({ currentMarkPct: 5, peakMarkPct: 20 }), 1_000_000 + 46 * 60, rules);
  assert.deepEqual(d, { close: true, reason: 'max-hold' });
});

test('no exit when in-band', () => {
  const d = shouldExit(pos({ currentMarkPct: 5, peakMarkPct: 10 }), 1_000_060, rules);
  assert.equal(d.close, false);
});
