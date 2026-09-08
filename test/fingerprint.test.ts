import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterScore, type Fingerprintable } from '../src/pons/fingerprint.js';

const base: Fingerprintable = {
  timestamp: 1_000_000,
  devBuyWei: 10_000_000_000_000_000n, // 0.01 ETH
  creatorTaxBps: 100,
  links: ['https://x.com/dev'],
  description: 'ai companion for your terminal',
  exemptCount: 0,
  deployer: '0xa',
};

test('a lone launch has zero cluster score', () => {
  const r = clusterScore(base, []);
  assert.equal(r.score, 0);
});

test('two nearly-identical launches from different wallets cluster high', () => {
  const twin: Fingerprintable = { ...base, timestamp: base.timestamp + 60, deployer: '0xb' };
  const r = clusterScore(base, [twin]);
  assert.ok(r.score >= 0.7, `expected high cluster score, got ${r.score}`);
});

test('identical launch but same deployer does NOT count as cluster', () => {
  const same: Fingerprintable = { ...base, timestamp: base.timestamp + 60 };
  const r = clusterScore(base, [same]);
  assert.equal(r.score, 0);
});

test('randomized dev buy still catches the farm on other axes', () => {
  const varied: Fingerprintable = {
    ...base, timestamp: base.timestamp + 60, deployer: '0xb',
    devBuyWei: 12_000_000_000_000_000n, // 20% higher
  };
  const r = clusterScore(base, [varied]);
  assert.ok(r.score >= 0.5, `expected mid-high cluster score, got ${r.score}`);
});
