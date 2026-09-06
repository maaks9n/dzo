/**
 * view.ts — shared terminal rendering. Cards, tables, headers.
 */

import { c, fmtAddr, fmtBps, fmtEth, link, rule, verdictColor } from './util/fmt.js';
import type { EnrichedLaunch } from './pons/enrich.js';
import type { Verdict } from './score.js';

export function launchCard(en: EnrichedLaunch, v: Verdict): string {
  const width = 64;
  const badge = `${v.verdict} ${v.score}`;
  const paint = verdictColor(v.verdict);
  const symbolLink = link(en.symbol || '???', `https://axiom.trade/${en.event.token}`);
  const contractLink = link(fmtAddr(en.event.token), `https://fomo.gg/${en.event.token}`);
  const headTail = ' '.repeat(Math.max(1, width - 2 - (en.symbol?.length ?? 3) - 1 - 11 - badge.length)) + paint(badge);

  const lines: string[] = [];
  lines.push(c.gray(rule(width)));
  lines.push(` ${c.bold(symbolLink)}  ${c.gray(contractLink)}${headTail}`);
  lines.push(c.gray(rule(width)));
  lines.push(` dev buy  ${(en.devBuyShare * 100).toFixed(1)}%   tax  ${fmtBps(en.creatorTaxBps)}   exempt  ${en.exemptWallets.length}`);
  const socials: string[] = [];
  if (en.links.x) socials.push('x');
  if (en.links.website) socials.push('web');
  if (en.links.telegram) socials.push('tg');
  lines.push(` socials  ${socials.length ? socials.join(' · ') : c.gray('none')}         deployer  ${c.gray(fmtAddr(en.event.deployer))}`);
  lines.push(` curve    ${fmtEth(en.reserveEth, 3)} / 4.2 ETH`);
  lines.push(c.gray(rule(width)));
  for (const line of v.lines) {
    const sign = line.points >= 0 ? '+' : '−';
    const painter = line.points >= 0 ? c.green : c.red;
    lines.push(` ${painter(sign)} ${line.reason.padEnd(38)} ${painter(String(Math.abs(line.points)).padStart(3))}`);
  }
  if (v.refusedBy) {
    lines.push(c.gray(rule(width)));
    lines.push(c.red(` refused: ${v.refusedBy}`));
  }
  lines.push(c.gray(rule(width)));
  lines.push(c.gray(` open: `) + link('pons', `https://pons.family/${en.event.token}`) + c.gray(' · ') +
    link('axiom', `https://axiom.trade/${en.event.token}`) + c.gray(' · ') +
    link('fomo', `https://fomo.gg/${en.event.token}`) + c.gray(' · ') +
    link('explorer', `https://explorer.robinhood.com/chain/token/${en.event.token}`));
  return lines.join('\n');
}
