/**
 * snipe.ts — the engine.
 *
 * Loop:
 *   detect → enrich → cluster fingerprint → score → decide →
 *   wait at full draw (poll currentSnipeTaxBps until under ceiling) →
 *   buy → mark every 5s → exit
 *
 * Dry run by default. Live requires --live and a session `arm`.
 * Emits events consumed by the board and by alerts.
 */

import EventEmitter from 'node:events';
import { makeDetector, type LaunchEvent } from './pons/launches.js';
import { enrichLaunch, type EnrichedLaunch } from './pons/enrich.js';
import { clusterScore, type Fingerprintable } from './pons/fingerprint.js';
import { openIndex, upsertLaunch, statsFor } from './pons/deployerIndex.js';
import { score, type Verdict } from './score.js';
import { client, ADDR, CONSTANTS } from './chain.js';
import { factoryAbi } from './abi/factory.js';
import { buyOnCurve, sellOnCurve } from './trade/curveTrade.js';
import { makeAdaptiveTax } from './util/adaptiveTax.js';
import { loadPositions, savePositions, shouldExit, type Position, type ExitRules } from './trade/positions.js';
import { quoteSell, type CurveState } from './pons/curve.js';
import { env } from './util/env.js';

export interface SnipeOptions {
  ethPerShot: number;
  minScore: number;
  maxOpen: number;
  maxTaxBps: number;
  budgetEth: number;
  live: boolean;
  keyword?: RegExp;
  deployers?: Set<string>;
  allowPairs?: boolean;
  adaptive?: boolean;
}

export interface Engine extends EventEmitter {
  start(): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  closePosition(token: string, pct?: number): Promise<void>;
  updateRule(key: string, value: number): void;
  state(): { paused: boolean; open: number; spent: number; ceilingBps: number };
}

export function makeEngine(opts: SnipeOptions): Engine {
  const emitter = new EventEmitter() as Engine;
  const recent: Fingerprintable[] = [];
  const open: Position[] = loadPositions().filter((p) => p.status === 'open');
  const closed: Position[] = loadPositions().filter((p) => p.status === 'closed');
  let paused = false;
  let spent = 0;
  const adaptive = makeAdaptiveTax({ configuredMaxBps: opts.maxTaxBps });
  const detector = makeDetector();

  const exitRules: ExitRules = {
    takeProfitPct: env.TAKE_PROFIT_PCT,
    stopLossPct: env.STOP_LOSS_PCT,
    trailingPct: env.TRAILING_PCT,
    maxHoldMin: env.MAX_HOLD_MIN,
  };

  async function handleLaunch(ev: LaunchEvent) {
    try {
      const enriched = await enrichLaunch(ev);

      upsertLaunch({
        token: ev.token, deployer: ev.deployer, block: Number(ev.launchBlock), timestamp: ev.timestamp,
        curve: ev.curve, pair: ev.pair, graduated: 0, graduatedBlock: null,
      });
      const stats = statsFor(ev.deployer);

      const fp: Fingerprintable = {
        timestamp: ev.timestamp, devBuyWei: enriched.devBuyWei, creatorTaxBps: enriched.creatorTaxBps,
        links: [enriched.links.x, enriched.links.website, enriched.links.telegram].filter(Boolean) as string[],
        description: enriched.description, exemptCount: enriched.exemptWallets.length, deployer: ev.deployer,
      };
      const cluster = clusterScore(fp, recent);
      recent.push(fp);
      if (recent.length > 500) recent.shift();

      const v = score({
        token: ev.token, symbol: enriched.symbol, name: enriched.name, description: enriched.description,
        deployer: ev.deployer, feeRecipient: enriched.feeRecipient, creatorTaxBps: enriched.creatorTaxBps,
        devBuyShare: enriched.devBuyShare,
        hasX: !!enriched.links.x, hasWebsite: !!enriched.links.website, hasTelegram: !!enriched.links.telegram,
        exemptCount: enriched.exemptWallets.length, deployerStats: stats, cluster,
        isEthPair: enriched.isEthPair,
      });

      emitter.emit('launch', { enriched, verdict: v });

      if (paused || v.verdict !== 'FIRE' || v.score < opts.minScore) return;
      if (v.refusedBy) return;
      if (opts.keyword && !opts.keyword.test(`${enriched.name} ${enriched.symbol} ${enriched.description}`)) return;
      if (opts.deployers && !opts.deployers.has(ev.deployer)) return;
      if (!opts.allowPairs && !enriched.isEthPair) return;

      if (open.length >= opts.maxOpen) {
        emitter.emit('pass', { token: ev.token, reason: `max open ${opts.maxOpen} reached` });
        return;
      }
      if (spent + opts.ethPerShot > opts.budgetEth) {
        emitter.emit('pass', { token: ev.token, reason: 'session budget reached' });
        return;
      }

      await waitAndBuy(enriched);
    } catch (e) {
      emitter.emit('error', e);
    }
  }

  async function waitAndBuy(en: EnrichedLaunch) {
    const c = client();
    const start = Date.now();
    const ceiling = opts.adaptive === false ? opts.maxTaxBps : adaptive.ceilingBps();
    while (Date.now() - start < 12_000) {
      try {
        const tax = await c.readContract({
          address: ADDR.factory, abi: factoryAbi, functionName: 'currentSnipeTaxBps',
          args: [en.event.token as `0x${string}`, '0x0000000000000000000000000000000000000001'],
        });
        if (Number(tax) <= ceiling) {
          const state: CurveState = {
            reserveEth: en.reserveEth, reserveTokens: en.reserveTokens,
            phantomReserveEth: BigInt(Math.floor(CONSTANTS.phantomReserveEth * 1e18)),
            creatorTaxBps: en.creatorTaxBps, baseFeeBps: 100,
            snipeTaxStartBps: CONSTANTS.snipeTaxStartBps, snipeTaxSeconds: CONSTANTS.snipeTaxWindowSec,
            launchTimestamp: en.event.timestamp,
          };
          const ethIn = BigInt(Math.floor(opts.ethPerShot * 1e18));
          const result = await buyOnCurve({ curve: en.event.curve, ethIn, state, currentTaxBps: Number(tax), live: opts.live });
          const pos: Position = {
            token: en.event.token, symbol: en.symbol,
            entryBlock: Number(en.event.launchBlock), entryTimestamp: Math.floor(Date.now() / 1000),
            entryEthSpent: ethIn.toString(), entryTokens: result.tokensReceived.toString(),
            peakMarkPct: 0, currentMarkPct: 0, status: 'open',
          };
          open.push(pos);
          savePositions([...open, ...closed]);
          spent += opts.ethPerShot;
          adaptive.recordEntry(Number(tax));
          emitter.emit('fire', { token: en.event.token, tax: Number(tax), result });
          return;
        }
      } catch (e) {
        emitter.emit('error', e);
      }
      await sleep(150);
    }
    adaptive.recordMiss();
    emitter.emit('miss', { token: en.event.token });
  }

  async function markLoop() {
    setInterval(async () => {
      const c = client();
      for (const pos of [...open]) {
        try {
          const state: CurveState = {
            reserveEth: 0n, reserveTokens: 0n,
            phantomReserveEth: BigInt(Math.floor(CONSTANTS.phantomReserveEth * 1e18)),
            creatorTaxBps: 0, baseFeeBps: 100,
            snipeTaxStartBps: CONSTANTS.snipeTaxStartBps, snipeTaxSeconds: CONSTANTS.snipeTaxWindowSec,
            launchTimestamp: pos.entryTimestamp,
          };
          const entryEth = BigInt(pos.entryEthSpent);
          const tokensIn = BigInt(pos.entryTokens);
          const ethBack = quoteSell(state, tokensIn);
          const pct = entryEth > 0n ? Number(((ethBack - entryEth) * 10_000n) / entryEth) / 100 : 0;
          pos.currentMarkPct = pct;
          if (pct > pos.peakMarkPct) pos.peakMarkPct = pct;
          const decision = shouldExit(pos, Math.floor(Date.now() / 1000), exitRules);
          if (decision.close) {
            const sold = await sellOnCurve({
              curve: pos.token, tokensIn, state, live: opts.live,
            });
            pos.status = 'closed';
            pos.closedAt = Math.floor(Date.now() / 1000);
            pos.closedReason = decision.reason;
            pos.closedEthOut = sold.ethOut.toString();
            closed.push(pos);
            open.splice(open.indexOf(pos), 1);
            emitter.emit('exit', pos);
          }
          savePositions([...open, ...closed]);
        } catch { /* skip this mark */ }
      }
    }, 5_000).unref?.();
  }

  emitter.start = async () => {
    openIndex();
    detector.on('launch', handleLaunch);
    detector.on('error', (e) => emitter.emit('error', e));
    await detector.start();
    markLoop();
  };
  emitter.stop = () => detector.stop();
  emitter.pause = () => { paused = true; };
  emitter.resume = () => { paused = false; };
  emitter.closePosition = async (token: string, pct = 100) => {
    const pos = open.find((p) => p.token.toLowerCase() === token.toLowerCase());
    if (!pos) return;
    const state: CurveState = {
      reserveEth: 0n, reserveTokens: 0n,
      phantomReserveEth: BigInt(Math.floor(CONSTANTS.phantomReserveEth * 1e18)),
      creatorTaxBps: 0, baseFeeBps: 100,
      snipeTaxStartBps: CONSTANTS.snipeTaxStartBps, snipeTaxSeconds: CONSTANTS.snipeTaxWindowSec,
      launchTimestamp: pos.entryTimestamp,
    };
    const tokensIn = BigInt(pos.entryTokens) * BigInt(pct) / 100n;
    await sellOnCurve({ curve: pos.token, tokensIn, state, live: opts.live });
    pos.status = 'closed';
    pos.closedReason = 'manual';
    pos.closedAt = Math.floor(Date.now() / 1000);
    open.splice(open.indexOf(pos), 1);
    closed.push(pos);
    savePositions([...open, ...closed]);
    emitter.emit('exit', pos);
  };
  emitter.updateRule = (key, value) => {
    if (key === 'minScore') opts.minScore = value;
    else if (key === 'maxOpen') opts.maxOpen = value;
    else if (key === 'maxTaxBps') opts.maxTaxBps = value;
    else if (key === 'ethPerShot') opts.ethPerShot = value;
  };
  emitter.state = () => ({ paused, open: open.length, spent, ceilingBps: adaptive.ceilingBps() });
  return emitter;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
