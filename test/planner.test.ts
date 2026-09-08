import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWallet, type WalletProfile } from '../src/trade/planner.js';

const strict: WalletProfile = { name: 'strict', keyfile: '', minScore: 85, maxDevShare: 0.05, ethPerShot: 0.01, budget: 0.03, spent: 0 };
const loose:  WalletProfile = { name: 'loose',  keyfile: '', minScore: 60, maxDevShare: 0.08, ethPerShot: 0.005, budget: 0.02, spent: 0 };

test('a 90-score fires from strict', () => {
  assert.equal(pickWallet([strict, loose], 90, 0.03)?.name, 'strict');
});

test('an 82-score fires from loose only', () => {
  assert.equal(pickWallet([strict, loose], 82, 0.03)?.name, 'loose');
});

test('exhausted budget disqualifies a wallet', () => {
  const spentStrict = { ...strict, spent: 0.03 };
  assert.equal(pickWallet([spentStrict, loose], 90, 0.03)?.name, 'loose');
});
