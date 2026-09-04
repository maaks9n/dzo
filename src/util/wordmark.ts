/**
 * wordmark.ts — DZO ASCII wordmark for the terminal.
 * Line drawing, single accent color. Renders once on startup.
 */

import { c } from './fmt.js';
import { env } from './env.js';

const MARK = [
  '  ╭─────╮  ╭─────╮  ╭─────╮ ',
  '  │  ╱  │  ╲     ╱  │  ○  │ ',
  '  │  ╲  │   ╲   ╱   │  ○  │ ',
  '  ╰─────╯    ╲─╱    ╰─────╯ ',
];

export function printWordmark(): void {
  for (const line of MARK) console.log(c.green(line));
  console.log(c.cream('  DZO   ') + c.dim('· Decay · Zero · Open ·  ') + c.gray('wait for zero'));
  const refs: string[] = [];
  if (env.REF_AXIOM) refs.push(`Axiom: axiom.trade/@${env.REF_AXIOM}`);
  if (env.REF_FOMO) refs.push(`FOMO: fomo.gg/@${env.REF_FOMO}`);
  if (refs.length) console.log(c.dim('  ' + refs.join('  ·  ')));
  console.log();
}
