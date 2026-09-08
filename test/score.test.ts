import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score, type LaunchSignal } from '../src/score.js';

const builder: LaunchSignal = {
  token: '0x1', symbol: 'BUILD', name: 'Builder', description: 'a launch',
  deployer: '0xa', feeRecipient: '0xa', creatorTaxBps: 150, devBuyShare: 0.03,
  hasX: true, hasWebsite: true, hasTelegram: true, exemptCount: 0,
  deployerStats: { address: '0xa', launches: 7, graduated: 2, graduationRate: 2/7, firstSeen: 0, lastSeen: 0 },
  cluster: { score: 0.12, peers: 0, reasons: [] },
  isEthPair: true,
};

test('a builder-shaped launch scores FIRE', () => {
  const v = score(builder);
  assert.equal(v.verdict, 'FIRE');
  assert.ok(v.score >= 75);
  assert.equal(v.refusedBy, null);
});

test('heavy dev buy is refused by hard rule', () => {
  const heavy = { ...builder, devBuyShare: 0.15 };
  const v = score(heavy);
  assert.equal(v.verdict, 'SKIP');
  assert.match(v.refusedBy || '', /maxDevShare/);
});

test('serial deployer without graduations tanks the score', () => {
  const serial: LaunchSignal = {
    ...builder,
    deployerStats: { address: '0xa', launches: 20, graduated: 0, graduationRate: 0, firstSeen: 0, lastSeen: 0 },
  };
  const v = score(serial);
  assert.ok(v.score < 75, `expected < 75, got ${v.score}`);
});

test('high cluster fingerprint refuses', () => {
  const clustered = { ...builder, cluster: { score: 0.85, peers: 3, reasons: ['dev-buy proximity 0.95'] } };
  const v = score(clustered);
  assert.equal(v.verdict, 'SKIP');
  assert.match(v.refusedBy || '', /cluster/);
});

test('no socials refuses', () => {
  const bare = { ...builder, hasX: false, hasWebsite: false, hasTelegram: false };
  const v = score(bare);
  assert.equal(v.verdict, 'SKIP');
});
