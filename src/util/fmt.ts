/**
 * fmt.ts — formatting, colors, terminal links.
 * No external dependency; ANSI escapes hand-rolled.
 */

const isTTY = process.stdout.isTTY;
const noColor = process.env.NO_COLOR !== undefined || process.argv.includes('--no-color');
const paint = (code: string) => (s: string) => (isTTY && !noColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  green:  paint('32;1'),
  yellow: paint('33;1'),
  red:    paint('31;1'),
  gray:   paint('90'),
  cream:  paint('37'),
  bold:   paint('1'),
  dim:    paint('2'),
};

export function fmtEth(wei: bigint, digits = 4): string {
  const s = (Number(wei) / 1e18).toFixed(digits);
  return `${s} ETH`;
}

export function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function fmtAddr(a: string): string {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** OSC-8 hyperlink; renders as text on terminals that don't support it. */
export function link(text: string, url: string): string {
  if (!isTTY || noColor) return text;
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

export function rule(width = 64): string {
  return '─'.repeat(width);
}

export function verdictColor(verdict: 'FIRE' | 'WATCH' | 'SKIP'): (s: string) => string {
  return verdict === 'FIRE' ? c.green : verdict === 'WATCH' ? c.yellow : c.gray;
}
