/**
 * config.ts — loads config/scoring.yaml with schema validation.
 * Missing file falls back to hardcoded defaults from src/score.ts.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { env } from './env.js';

export interface ScoringConfig {
  weights: {
    devBuyInBand: number;
    devBuyHeavy: number;
    devBuyNone: number;
    creatorTaxLow: number;
    creatorTaxHigh: number;
    feesThirdParty: number;
    hasX: number;
    hasWebsite: number;
    hasTelegram: number;
    noSocials: number;
    exemptFew: number;
    exemptMany: number;
    deployerFresh: number;
    deployerGraduator: number;
    deployerSerialDump: number;
    clusterMid: number;
    clusterHigh: number;
    organicBuyers: number;
    botOnlyBuyers: number;
  };
  bands: {
    devBuyMin: number;
    devBuyMax: number;
    devBuyHeavyMin: number;
    creatorTaxLowMax: number;
    creatorTaxHighMin: number;
    exemptFewMax: number;
    exemptManyMin: number;
    deployerGraduationMin: number;
    deployerSerialMin: number;
    clusterMidMin: number;
    clusterHighMin: number;
    organicBuyersMin: number;
  };
  rules: {
    minScore: number;
    maxDevShare: number;
    maxCreatorTax: number;
    maxExemptWallets: number;
    maxClusterScore: number;
    requireSocials: boolean;
    allowNonEthPairs: boolean;
  };
  verdicts: {
    fire: number;
    watch: number;
  };
}

const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    devBuyInBand: 15,
    devBuyHeavy: -25,
    devBuyNone: -10,
    creatorTaxLow: 10,
    creatorTaxHigh: -25,
    feesThirdParty: 5,
    hasX: 8,
    hasWebsite: 8,
    hasTelegram: 3,
    noSocials: -15,
    exemptFew: -5,
    exemptMany: -20,
    deployerFresh: 5,
    deployerGraduator: 15,
    deployerSerialDump: -25,
    clusterMid: -8,
    clusterHigh: -25,
    organicBuyers: 10,
    botOnlyBuyers: -10,
  },
  bands: {
    devBuyMin: 0.01,
    devBuyMax: 0.06,
    devBuyHeavyMin: 0.10,
    creatorTaxLowMax: 0.02,
    creatorTaxHighMin: 0.05,
    exemptFewMax: 3,
    exemptManyMin: 4,
    deployerGraduationMin: 0.30,
    deployerSerialMin: 5,
    clusterMidMin: 0.4,
    clusterHighMin: 0.7,
    organicBuyersMin: 10,
  },
  rules: {
    minScore: 60,
    maxDevShare: 0.08,
    maxCreatorTax: 0.03,
    maxExemptWallets: 2,
    maxClusterScore: 0.7,
    requireSocials: true,
    allowNonEthPairs: false,
  },
  verdicts: {
    fire: 75,
    watch: 45,
  },
};

let cached: ScoringConfig | null = null;

export function loadScoringConfig(pathOverride?: string): ScoringConfig {
  if (cached && !pathOverride) return cached;
  const path = pathOverride || env.SCORING_CONFIG || join(process.cwd(), 'config', 'scoring.yaml');
  if (!existsSync(path)) {
    cached = DEFAULT_CONFIG;
    return cached;
  }
  const raw = readFileSync(path, 'utf8');
  const parsed = yaml.load(raw) as Partial<ScoringConfig>;
  cached = mergeDeep(DEFAULT_CONFIG, parsed) as ScoringConfig;
  return cached;
}

function mergeDeep<T>(base: T, override: any): T {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return override ?? base;
  if (typeof override !== 'object' || override === null) return base;
  const out: any = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = mergeDeep((base as any)[k], override[k]);
  }
  return out;
}
