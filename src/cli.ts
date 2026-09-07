#!/usr/bin/env node
/**
 * cli.ts — read-only commands: doctor, hunt, watch, scan, fees, dev, replay, tune, positions.
 * Live-only commands live in cli-trade.ts and are re-exported here for a single binary.
 */

import { Command } from 'commander';
import { client, ADDR, CONSTANTS, CHAIN_ID, gate } from './chain.js';
import { factoryAbi } from './abi/factory.js';
import { printWordmark } from './util/wordmark.js';
import { openIndex, statsFor, launchesByDeployer } from './pons/deployerIndex.js';
import { feeReport } from './pons/fees.js';
import { replay as replayFn } from './pons/replay.js';
import { makeDetector } from './pons/launches.js';
import { enrichLaunch } from './pons/enrich.js';
import { clusterScore, type Fingerprintable } from './pons/fingerprint.js';
import { score } from './score.js';
import { launchCard } from './view.js';
import { c, fmtEth, fmtAddr } from './util/fmt.js';
import { registerTradeCommands } from './cli-trade.js';

const program = new Command();
program.name('dzo').description('DZO — wait for zero').version('0.1.0');

program.command('doctor').description('verify environment')
  .option('--probe', 'also probe the v4 quoter')
  .action(async (opts) => {
    printWordmark();
    console.log(c.bold('doctor'));
    const c1 = client();
    const chainId = await c1.getChainId();
    console.log(`  chain id     ${chainId === CHAIN_ID ? c.green(String(chainId)) : c.red(String(chainId))}  ${c.gray(`(expected ${CHAIN_ID})`)}`);
    const block = await c1.getBlockNumber();
    console.log(`  block        ${c.green(String(block))}`);
    const start = await c1.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: 'snipeTaxStartBps' });
    const sec = await c1.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: 'snipeTaxSeconds' });
    const fee = await c1.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: 'launchFee' });
    console.log(`  opening tax  ${c.green(String(start))} bps over ${c.green(String(sec))} s`);
    console.log(`  launch fee   ${c.green(fmtEth(fee as bigint, 4))}`);
    console.log(`  RPC pool:`);
    for (const ep of gate.health()) {
      console.log(`    ${ep.name.padEnd(12)} score=${ep.score.toFixed(0).padStart(6)}  p95=${ep.latencyP95}ms  refusals=${ep.refusals}  ${ep.penaltyMs ? c.red('penalized') : c.green('ok')}`);
    }
    if (opts.probe) {
      console.log(c.gray('  v4 quoter probe not implemented for arbitrary tokens; passes if factory responds.'));
    }
  });

program.command('hunt').description('live feed of launches, scored with reasons')
  .option('--fire-only', 'only FIRE verdicts')
  .option('--min-score <n>', 'override minimum score for display', (v) => parseInt(v, 10))
  .option('--json', 'JSON lines')
  .option('--no-follow', 'no follow-up lines')
  .option('--for <sec>', 'stop after N seconds', (v) => parseInt(v, 10))
  .option('--keyword <regex>', 'regex on name/symbol/description')
  .option('--deployer <a...>', 'filter to these deployers')
  .action(async (opts) => {
    if (!opts.json) printWordmark();
    openIndex();
    const recent: Fingerprintable[] = [];
    const det = makeDetector();
    det.on('launch', async (ev) => {
      try {
        const en = await enrichLaunch(ev);
        const fp: Fingerprintable = {
          timestamp: ev.timestamp, devBuyWei: en.devBuyWei, creatorTaxBps: en.creatorTaxBps,
          links: [en.links.x, en.links.website, en.links.telegram].filter(Boolean) as string[],
          description: en.description, exemptCount: en.exemptWallets.length, deployer: ev.deployer,
        };
        const cluster = clusterScore(fp, recent);
        recent.push(fp);
        if (recent.length > 500) recent.shift();
        const stats = statsFor(ev.deployer);
        const v = score({
          token: ev.token, symbol: en.symbol, name: en.name, description: en.description,
          deployer: ev.deployer, feeRecipient: en.feeRecipient, creatorTaxBps: en.creatorTaxBps,
          devBuyShare: en.devBuyShare,
          hasX: !!en.links.x, hasWebsite: !!en.links.website, hasTelegram: !!en.links.telegram,
          exemptCount: en.exemptWallets.length, deployerStats: stats, cluster, isEthPair: en.isEthPair,
        });
        if (opts.fireOnly && v.verdict !== 'FIRE') return;
        if (opts.minScore && v.score < opts.minScore) return;
        if (opts.keyword && !new RegExp(opts.keyword, 'i').test(`${en.name} ${en.symbol} ${en.description}`)) return;
        if (opts.deployer && !opts.deployer.map((s: string) => s.toLowerCase()).includes(ev.deployer)) return;

        if (opts.json) {
          console.log(JSON.stringify({ ev, en, verdict: v }));
        } else {
          console.log(launchCard(en, v));
          console.log();
        }
      } catch (e) { /* skip unreadable launches */ }
    });
    await det.start();
    if (opts.for) setTimeout(() => process.exit(0), opts.for * 1000);
  });

program.command('scan <token>').description('everything on chain about one token')
  .action(async (token: string) => {
    printWordmark();
    const c1 = client();
    const info = await c1.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: 'launchInfo', args: [token as `0x${string}`] });
    console.log(`  token       ${c.bold(token)}`);
    console.log(`  info        ${JSON.stringify(info, replacer, 2)}`);
    const fees = await feeReport(token);
    console.log(`  recipient   ${c.bold(fees.recipient)}`);
    console.log(`  accrued     curve ${fmtEth(fees.accruedFromCurve)} · pool ${fmtEth(fees.accruedFromPool)}`);
    console.log(`  pending     ${fmtEth(fees.pending)}`);
    console.log(`  claims      ${fees.claims.length}`);
  });

program.command('watch <token>').description('follow one token every 5s')
  .action(async (token: string) => {
    printWordmark();
    const c1 = client();
    setInterval(async () => {
      try {
        const info = await c1.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: 'launchInfo', args: [token as `0x${string}`] }) as any;
        const tax = await c1.readContract({ address: ADDR.factory, abi: factoryAbi, functionName: 'currentSnipeTaxBps', args: [token as `0x${string}`, '0x0000000000000000000000000000000000000001'] });
        console.log(`${new Date().toISOString()}  phase=${info.phase}  taxNow=${(Number(tax)/100).toFixed(2)}%`);
      } catch { /* ignore */ }
    }, 5_000);
  });

program.command('fees <token>').description('who is paid and every claim')
  .action(async (token: string) => {
    printWordmark();
    const r = await feeReport(token);
    console.log(`  token       ${c.bold(token)}`);
    console.log(`  recipient   ${c.bold(fmtAddr(r.recipient))}`);
    console.log(`  accrued     curve ${fmtEth(r.accruedFromCurve)}  ·  pool ${fmtEth(r.accruedFromPool)}`);
    console.log(`  pending     ${fmtEth(r.pending)}`);
    for (const cl of r.claims) {
      console.log(`  claim       ${fmtEth(cl.amount)}  @${new Date(cl.timestamp * 1000).toISOString()}  ${cl.txHash}`);
    }
  });

program.command('dev <address>').description('every launch by one deployer')
  .option('--window <n>', 'blocks back', (v) => parseInt(v, 10), 400_000)
  .option('--json', 'JSON lines')
  .action(async (address: string, opts) => {
    openIndex();
    const stats = statsFor(address);
    const rows = launchesByDeployer(address);
    if (opts.json) {
      console.log(JSON.stringify({ stats, rows }));
      return;
    }
    printWordmark();
    console.log(`  deployer    ${c.bold(address)}`);
    console.log(`  launches    ${stats.launches}   graduated  ${stats.graduated}  (${(stats.graduationRate*100).toFixed(1)}%)`);
    for (const r of rows.slice(0, 40)) {
      console.log(`  ${new Date(r.timestamp * 1000).toISOString().slice(0,16)}  ${r.token}  ${r.graduated ? c.green('GRAD') : c.gray('— — —')}`);
    }
  });

program.command('replay').description('rerun a historical block range through the current rules')
  .option('--from <block>', 'start block', (v) => BigInt(v))
  .option('--to <block>', 'end block', (v) => BigInt(v))
  .option('--last <dur>', 'e.g. 24h, 6h, 3d')
  .option('--csv <file>', 'write every decision as CSV')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    printWordmark();
    let from = opts.from;
    let to = opts.to;
    if (opts.last) {
      const c1 = client();
      const latest = await c1.getBlockNumber();
      const secs = parseDur(opts.last);
      const blocks = BigInt(Math.floor(secs / (100 / 1000))); // ~100ms blocks
      from = latest - blocks;
      to = latest;
    }
    if (!from || !to) { console.error('need --from + --to or --last'); process.exit(1); }
    console.log(`  replay      ${from} → ${to}`);
    const r = await replayFn(from, to);
    if (opts.json) { console.log(JSON.stringify(r, null, 2)); return; }
    console.log(`  fires       ${r.fires}`);
    console.log(`  wins/losses ${c.green(String(r.wins))} / ${c.red(String(r.losses))}`);
    console.log(`  hit-rate    ${(r.hitRate*100).toFixed(1)}%`);
    console.log(`  net PnL     ${r.netPnLEth >= 0 ? c.green : c.red}${r.netPnLEth.toFixed(4)} ETH`);
    console.log(`  entry tax   median ${r.entryTaxMedianBps} bps  ·  p95 ${r.entryTaxP95Bps} bps`);
    console.log(`  confusion   FIRE→grad ${r.confusion.fireGraduated}  FIRE→dump ${r.confusion.fireDumped}  SKIP→grad ${r.confusion.skipGraduated}  SKIP→dump ${r.confusion.skipDumped}`);
  });

program.command('tune').description('grid search over score weights on a historical window')
  .option('--last <dur>', 'e.g. 24h')
  .option('--iter <n>', 'samples', (v) => parseInt(v, 10), 200)
  .option('--seed <n>', 'RNG seed', (v) => parseInt(v, 10), 42)
  .option('--top <n>', 'top N to print', (v) => parseInt(v, 10), 5)
  .action(async (opts) => {
    printWordmark();
    console.log(`  tune        iterations=${opts.iter} seed=${opts.seed}`);
    console.log(c.gray('  (grid search implementation ships in next release; the CLI shape is stable.)'));
  });

registerTradeCommands(program);

program.parse();

function replacer(_k: string, v: unknown): unknown { return typeof v === 'bigint' ? v.toString() : v; }
function parseDur(s: string): number {
  const m = s.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`bad duration: ${s}`);
  const n = parseInt(m[1]!, 10);
  return { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd']! * n;
}
