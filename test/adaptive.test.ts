import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAdaptiveTax } from '../src/util/adaptiveTax.js';

test('ceiling stays inside bounds', () => {
  const a = makeAdaptiveTax({ configuredMaxBps: 300, minCeilingBps: 50 });
  const c = a.ceilingBps();
  assert.ok(c >= 50 && c <= 300, `got ${c}`);
});

test('a run of low entries tightens the ceiling', () => {
  const a = makeAdaptiveTax({ configuredMaxBps: 300, minCeilingBps: 50 });
  const before = a.ceilingBps();
  for (let i = 0; i < 30; i++) a.recordEntry(15);
  const after = a.ceilingBps();
  assert.ok(after <= before, `expected tightening, ${before} → ${after}`);
});

test('a run of misses relaxes the ceiling', () => {
  const a = makeAdaptiveTax({ configuredMaxBps: 300, minCeilingBps: 50 });
  for (let i = 0; i < 30; i++) a.recordEntry(15);
  const tight = a.ceilingBps();
  for (let i = 0; i < 10; i++) a.recordMiss();
  const relaxed = a.ceilingBps();
  assert.ok(relaxed >= tight, `expected relaxing, tight=${tight} relaxed=${relaxed}`);
});
