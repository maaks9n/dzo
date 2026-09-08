#!/usr/bin/env node
// dzo — entry point. tsx runs the TS source directly in dev; production uses dist.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, '..', 'dist', 'cli.js');
const srcEntry = join(here, '..', 'src', 'cli.ts');

if (existsSync(distEntry)) {
  await import(distEntry);
} else if (existsSync(srcEntry)) {
  // dev fallback: spawn tsx with the source. inherit stdio.
  const child = spawn(process.execPath, ['--import', 'tsx', srcEntry, ...process.argv.slice(2)], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  console.error('dzo: no entry point found. Run `npm install` and `npm run build`.');
  process.exit(1);
}
