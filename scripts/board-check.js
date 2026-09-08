#!/usr/bin/env node
/**
 * board-check.js — smoke test that the board page renders and its SSE endpoint
 * responds. Runs as part of `npm test` in CI. Requires nothing but Node.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'board'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, BOARD_PORT: '4700' },
});
let failed = false;
try {
  await sleep(2500);
  const r = await fetch('http://127.0.0.1:4700');
  if (!r.ok) { failed = true; console.error(`board GET / returned ${r.status}`); }
  const html = await r.text();
  if (!html.includes('DZO — wait for zero')) { failed = true; console.error('board HTML did not contain title'); }
  // SSE HEAD
  const r2 = await fetch('http://127.0.0.1:4700/events');
  if (r2.headers.get('content-type') !== 'text/event-stream') { failed = true; console.error('board /events wrong content-type'); }
  r2.body?.cancel();
  console.log(failed ? 'FAIL' : 'ok');
} finally {
  child.kill();
}
process.exit(failed ? 1 : 0);
