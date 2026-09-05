/**
 * adaptiveTax.ts — EMA-based tax ceiling.
 *
 * When SNIPE_ADAPTIVE_TAX=on, this module tracks the realized tax bps on
 * the last N successful entries and returns a ceiling that is:
 *   - tightened toward the observed median when misses are low
 *   - relaxed back to the configured max when misses accumulate
 *
 * The effective ceiling stays inside [minCeiling, configuredMax].
 */

export interface AdaptiveTaxOptions {
  configuredMaxBps: number;
  minCeilingBps: number;     // never tighter than this
  window: number;            // history length (default 50)
  alpha: number;             // EMA smoothing (default 0.15)
  missTolerance: number;     // consecutive misses before relax (default 3)
}

export interface AdaptiveTax {
  ceilingBps(): number;
  recordEntry(realizedBps: number): void;
  recordMiss(): void;
  state(): { emaBps: number; misses: number; entries: number; ceiling: number };
}

export function makeAdaptiveTax(opts: Partial<AdaptiveTaxOptions> & { configuredMaxBps: number }): AdaptiveTax {
  const o: AdaptiveTaxOptions = {
    minCeilingBps: 50,
    window: 50,
    alpha: 0.15,
    missTolerance: 3,
    ...opts,
  };

  const history: number[] = [];
  let ema = o.configuredMaxBps * 0.5; // start centered
  let missStreak = 0;
  let currentCeiling = o.configuredMaxBps;

  function recompute() {
    // headroom above EMA scales with recent miss streak.
    const headroom = Math.max(0.4, 1.0 - Math.max(0, o.missTolerance - missStreak) * 0.15);
    const target = ema + o.configuredMaxBps * headroom * 0.3;
    currentCeiling = Math.max(o.minCeilingBps, Math.min(o.configuredMaxBps, Math.round(target)));
  }

  return {
    ceilingBps() {
      return currentCeiling;
    },
    recordEntry(realizedBps: number) {
      history.push(realizedBps);
      if (history.length > o.window) history.shift();
      ema = ema * (1 - o.alpha) + realizedBps * o.alpha;
      missStreak = 0;
      recompute();
    },
    recordMiss() {
      missStreak++;
      recompute();
    },
    state() {
      return {
        emaBps: Math.round(ema),
        misses: missStreak,
        entries: history.length,
        ceiling: currentCeiling,
      };
    },
  };
}
