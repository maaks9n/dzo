/**
 * score.ts — rule-based 0–100 scoring with reasons.
 *
 * Weights are loaded from config/scoring.yaml (or defaults from util/config.ts).
 * Every rule contributes a signed number and a reason string. The verdict
 * follows from the total: FIRE ≥ 75, WATCH ≥ 45, SKIP below.
 *
 * A refusal by a hard rule (maxDevShare, maxCreatorTax, maxExemptWallets,
 * maxClusterScore, requireSocials) short-circuits to SKIP with the rule name.
 */

import { loadScoringConfig } from './util/config.js';
import type { ClusterResult } from './pons/fingerprint.js';
import type { DeployerStats } from './pons/deployerIndex.js';

export interface LaunchSignal {
  token: string;
  symbol: string;
  name: string;
  description: string;
  deployer: string;
  feeRecipient: string;
  creatorTaxBps: number;
  devBuyShare: number;             // 0..1
  hasX: boolean;
  hasWebsite: boolean;
  hasTelegram: boolean;
  exemptCount: number;
  deployerStats: DeployerStats;
  cluster: ClusterResult;
  earlyBuyersCount?: number;       // set by follow-ups
  earlyBuyersAllTaxed?: boolean;
  isEthPair: boolean;
}

export interface ScoreLine {
  points: number;
  reason: string;
}

export interface Verdict {
  score: number;
  verdict: 'FIRE' | 'WATCH' | 'SKIP';
  lines: ScoreLine[];
  refusedBy: string | null;        // hard-rule refusal
}

export function score(sig: LaunchSignal): Verdict {
  const cfg = loadScoringConfig();
  const lines: ScoreLine[] = [];
  let refusedBy: string | null = null;

  // Hard-rule refusals (short-circuit).
  if (sig.devBuyShare > cfg.rules.maxDevShare) {
    refusedBy = `dev buy ${(sig.devBuyShare * 100).toFixed(1)}% > maxDevShare ${(cfg.rules.maxDevShare * 100).toFixed(0)}%`;
  } else if (sig.creatorTaxBps / 10_000 > cfg.rules.maxCreatorTax) {
    refusedBy = `creator tax ${(sig.creatorTaxBps / 100).toFixed(2)}% > maxCreatorTax ${(cfg.rules.maxCreatorTax * 100).toFixed(1)}%`;
  } else if (sig.exemptCount > cfg.rules.maxExemptWallets) {
    refusedBy = `exempt wallets ${sig.exemptCount} > maxExemptWallets ${cfg.rules.maxExemptWallets}`;
  } else if (sig.cluster.score > cfg.rules.maxClusterScore) {
    refusedBy = `cluster ${sig.cluster.score.toFixed(2)} > maxClusterScore ${cfg.rules.maxClusterScore.toFixed(2)}`;
  } else if (cfg.rules.requireSocials && !sig.hasX && !sig.hasWebsite && !sig.hasTelegram) {
    refusedBy = 'requireSocials: none present';
  } else if (!cfg.rules.allowNonEthPairs && !sig.isEthPair) {
    refusedBy = 'non-ETH pair (allowNonEthPairs=false)';
  }

  // Score contribution lines (always computed, even on refusal, for reasons).
  if (sig.devBuyShare === 0) {
    lines.push({ points: cfg.weights.devBuyNone, reason: 'no dev buy' });
  } else if (sig.devBuyShare >= cfg.bands.devBuyHeavyMin) {
    lines.push({ points: cfg.weights.devBuyHeavy, reason: `dev buy heavy ${(sig.devBuyShare * 100).toFixed(1)}%` });
  } else if (sig.devBuyShare >= cfg.bands.devBuyMin && sig.devBuyShare <= cfg.bands.devBuyMax) {
    lines.push({ points: cfg.weights.devBuyInBand, reason: `dev buy in band ${(sig.devBuyShare * 100).toFixed(1)}%` });
  }

  const taxPct = sig.creatorTaxBps / 10_000;
  if (taxPct <= cfg.bands.creatorTaxLowMax) {
    lines.push({ points: cfg.weights.creatorTaxLow, reason: `creator tax ${(taxPct * 100).toFixed(1)}%` });
  } else if (taxPct >= cfg.bands.creatorTaxHighMin) {
    lines.push({ points: cfg.weights.creatorTaxHigh, reason: `creator tax high ${(taxPct * 100).toFixed(1)}%` });
  }

  if (sig.deployer.toLowerCase() !== sig.feeRecipient.toLowerCase()) {
    lines.push({ points: cfg.weights.feesThirdParty, reason: 'fees routed to third party' });
  }

  const socialLines: ScoreLine[] = [];
  if (sig.hasX) socialLines.push({ points: cfg.weights.hasX, reason: 'X link' });
  if (sig.hasWebsite) socialLines.push({ points: cfg.weights.hasWebsite, reason: 'website' });
  if (sig.hasTelegram) socialLines.push({ points: cfg.weights.hasTelegram, reason: 'telegram' });
  if (socialLines.length === 0) {
    lines.push({ points: cfg.weights.noSocials, reason: 'no socials' });
  } else {
    lines.push(...socialLines);
  }

  if (sig.exemptCount >= 1 && sig.exemptCount <= cfg.bands.exemptFewMax) {
    lines.push({ points: cfg.weights.exemptFew, reason: `${sig.exemptCount} exempt wallets` });
  } else if (sig.exemptCount >= cfg.bands.exemptManyMin) {
    lines.push({ points: cfg.weights.exemptMany, reason: `${sig.exemptCount} exempt wallets (bundle)` });
  }

  if (sig.deployerStats.launches === 0) {
    lines.push({ points: cfg.weights.deployerFresh, reason: 'fresh deployer' });
  } else if (sig.deployerStats.graduationRate >= cfg.bands.deployerGraduationMin) {
    lines.push({
      points: cfg.weights.deployerGraduator,
      reason: `deployer ${sig.deployerStats.graduated}/${sig.deployerStats.launches} graduated`,
    });
  } else if (sig.deployerStats.launches >= cfg.bands.deployerSerialMin && sig.deployerStats.graduated === 0) {
    lines.push({
      points: cfg.weights.deployerSerialDump,
      reason: `serial deployer ${sig.deployerStats.launches} launches / 0 graduated`,
    });
  }

  if (sig.cluster.score >= cfg.bands.clusterHighMin) {
    lines.push({ points: cfg.weights.clusterHigh, reason: `cluster ${sig.cluster.score.toFixed(2)} (${sig.cluster.reasons.join(', ')})` });
  } else if (sig.cluster.score >= cfg.bands.clusterMidMin) {
    lines.push({ points: cfg.weights.clusterMid, reason: `cluster ${sig.cluster.score.toFixed(2)}` });
  }

  if (sig.earlyBuyersCount !== undefined) {
    if (sig.earlyBuyersCount >= cfg.bands.organicBuyersMin) {
      lines.push({ points: cfg.weights.organicBuyers, reason: `${sig.earlyBuyersCount} distinct early buyers` });
    }
    if (sig.earlyBuyersAllTaxed) {
      lines.push({ points: cfg.weights.botOnlyBuyers, reason: 'every early buy paid opening tax' });
    }
  }

  const total = lines.reduce((s, l) => s + l.points, 0);
  const clamped = Math.max(0, Math.min(100, total));
  let verdict: Verdict['verdict'] = 'SKIP';
  if (refusedBy) verdict = 'SKIP';
  else if (clamped >= cfg.verdicts.fire) verdict = 'FIRE';
  else if (clamped >= cfg.verdicts.watch) verdict = 'WATCH';

  return { score: clamped, verdict, lines, refusedBy };
}
