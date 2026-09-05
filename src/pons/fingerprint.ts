/**
 * fingerprint.ts — cluster fingerprint 2.0.
 *
 * Exact-match fingerprints (dev-buy wei + tax + links) miss farms that
 * randomize any of these. This module scores similarity across multiple
 * axes and flags anything above 0.7.
 *
 * Axes (each returns 0..1):
 *   - devBuyProximity: 1 if within ±5% of another launch's dev-buy wei
 *   - taxEqual: 1 if creatorTaxBps identical
 *   - linksJaccard: Jaccard similarity of link sets
 *   - descNgrams: Jaccard on 3-grams of the description
 *   - exemptCountEqual: 1 if exempt-wallet count identical
 *   - temporalDensity: 1 if 3+ launches in a 5-min window share ≥2 other axes
 *
 * Weighted sum → cluster score; keep the max over the last 30-minute window.
 */

const WEIGHTS = {
  devBuy: 0.25,
  tax: 0.15,
  links: 0.15,
  desc: 0.15,
  exempt: 0.10,
  temporal: 0.20,
} as const;

export interface Fingerprintable {
  timestamp: number;             // seconds
  devBuyWei: bigint;
  creatorTaxBps: number;
  links: string[];               // X, website, telegram
  description: string;
  exemptCount: number;
  deployer: string;              // lowercased 0x
}

export interface ClusterResult {
  score: number;                 // 0..1
  peers: number;                 // how many other launches contributed
  reasons: string[];             // human-readable
}

/**
 * Compare one launch against a rolling buffer of recent launches (last 30 min).
 * Returns the max cluster score across all pairwise comparisons.
 */
export function clusterScore(subject: Fingerprintable, peers: Fingerprintable[]): ClusterResult {
  const window = 30 * 60;
  const recent = peers.filter((p) => Math.abs(p.timestamp - subject.timestamp) < window && p.deployer !== subject.deployer);
  if (recent.length === 0) return { score: 0, peers: 0, reasons: [] };

  let best = 0;
  let bestReasons: string[] = [];
  let contributingPeers = 0;

  for (const peer of recent) {
    const dev = devBuyProximity(subject.devBuyWei, peer.devBuyWei);
    const tax = subject.creatorTaxBps === peer.creatorTaxBps ? 1 : 0;
    const links = jaccard(new Set(subject.links), new Set(peer.links));
    const desc = jaccard(ngrams(subject.description, 3), ngrams(peer.description, 3));
    const exempt = subject.exemptCount === peer.exemptCount ? 1 : 0;
    const temporal = Math.max(0, 1 - Math.abs(subject.timestamp - peer.timestamp) / window);

    const score =
      dev * WEIGHTS.devBuy +
      tax * WEIGHTS.tax +
      links * WEIGHTS.links +
      desc * WEIGHTS.desc +
      exempt * WEIGHTS.exempt +
      temporal * WEIGHTS.temporal;

    if (score > best) {
      best = score;
      bestReasons = describe({ dev, tax, links, desc, exempt, temporal });
      contributingPeers = 1;
    } else if (score >= 0.4) {
      contributingPeers++;
    }
  }

  return { score: Math.min(1, best), peers: contributingPeers, reasons: bestReasons };
}

function devBuyProximity(a: bigint, b: bigint): number {
  if (a === 0n || b === 0n) return a === b ? 1 : 0;
  const big = a > b ? a : b;
  const small = a > b ? b : a;
  const rel = Number((big - small) * 1000n / big) / 1000; // 0..1 relative diff
  if (rel < 0.05) return 1;
  if (rel < 0.15) return 0.5;
  return 0;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function ngrams(s: string, n: number): Set<string> {
  const cleaned = (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (cleaned.length < n) return new Set();
  const out = new Set<string>();
  for (let i = 0; i <= cleaned.length - n; i++) out.add(cleaned.slice(i, i + n));
  return out;
}

function describe(axes: { dev: number; tax: number; links: number; desc: number; exempt: number; temporal: number }): string[] {
  const r: string[] = [];
  if (axes.dev >= 0.5) r.push(`dev-buy proximity ${axes.dev.toFixed(2)}`);
  if (axes.tax >= 0.5) r.push('creator tax identical');
  if (axes.links >= 0.5) r.push(`links Jaccard ${axes.links.toFixed(2)}`);
  if (axes.desc >= 0.5) r.push(`description n-grams ${axes.desc.toFixed(2)}`);
  if (axes.exempt >= 0.5) r.push('exempt count identical');
  if (axes.temporal >= 0.7) r.push(`within ${((1 - axes.temporal) * 30).toFixed(0)} min`);
  return r;
}
