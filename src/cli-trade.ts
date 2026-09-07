/**
 * cli-trade.ts — commands that can move money.
 * snipe · buy · sell · positions · wallet · claim · board
 * All default to dry run; `--live` is required to sign and send.
 */

import type { Command } from 'commander';
import { c, fmtEth, fmtAddr } from './util/fmt.js';
import { env } from './util/env.js';
import { client, ADDR } from './chain.js';
import { feeEscrowAbi } from './abi/feeEscrow.js';
import { walletAddress, walletClient } from './trade/wallet.js';
import { makeEngine } from './snipe.js';
import { loadPositions } from './trade/positions.js';
import { printWordmark } from './util/wordmark.js';
import { startBoard } from './board/server.js';
import { createInterface } from 'node:readline';

export function registerTradeCommands(program: Command): void {
  program.command('snipe').description('auto-buy launches that pass the rules, manage exits')
    .option('--eth <n>', 'ETH per shot', (v) => parseFloat(v))
    .option('--min-score <n>', 'min score', (v) => parseInt(v, 10))
    .option('--budget <n>', 'session budget in ETH', (v) => parseFloat(v))
    .option('--max-open <n>', 'position cap', (v) => parseInt(v, 10))
    .option('--max-tax <n>', 'ceiling in bps', (v) => parseInt(v, 10))
    .option('--keyword <regex>')
    .option('--deployer <a...>')
    .option('--allow-pairs')
    .option('--adaptive-off')
    .option('--live')
    .action(async (opts) => {
      printWordmark();
      const engine = makeEngine({
        ethPerShot: opts.eth ?? env.SNIPE_ETH,
        minScore: opts.minScore ?? env.SNIPE_MIN_SCORE,
        budgetEth: opts.budget ?? env.SNIPE_BUDGET_ETH,
        maxOpen: opts.maxOpen ?? env.SNIPE_MAX_OPEN,
        maxTaxBps: opts.maxTax ?? env.SNIPE_MAX_TAX_BPS,
        live: !!opts.live,
        adaptive: opts.adaptiveOff ? false : env.SNIPE_ADAPTIVE_TAX,
        keyword: opts.keyword ? new RegExp(opts.keyword, 'i') : undefined,
        deployers: opts.deployer ? new Set(opts.deployer.map((s: string) => s.toLowerCase())) : undefined,
        allowPairs: !!opts.allowPairs,
      });
      if (opts.live) {
        const { account } = walletClient();
        const bal = await client().getBalance({ address: account.address });
        const needed = BigInt(Math.floor((opts.eth ?? env.SNIPE_ETH) * 1e18));
        console.log(c.bold('  live session:'));
        console.log(`    signer     ${account.address}`);
        console.log(`    balance    ${fmtEth(bal)}`);
        console.log(`    per shot   ${(opts.eth ?? env.SNIPE_ETH)} ETH`);
        console.log(`    budget     ${(opts.budget ?? env.SNIPE_BUDGET_ETH)} ETH`);
        if (bal < needed) { console.error(c.red('    balance too low; aborting')); process.exit(1); }
        console.log(c.yellow('  type "arm" to proceed:'));
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const ans: string = await new Promise((r) => rl.question('  > ', r));
        rl.close();
        if (ans.trim() !== 'arm') { console.log('  not armed. bye.'); process.exit(0); }
      }
      engine.on('launch', (p: any) => {
        console.log(`${p.enriched.symbol.padEnd(12)}  score=${p.verdict.score}  ${p.verdict.verdict}`);
      });
      engine.on('fire', (p: any) => console.log(c.green(`FIRE  ${fmtAddr(p.token)}  tax=${(p.tax/100).toFixed(2)}%`)));
      engine.on('miss', (p: any) => console.log(c.gray(`miss  ${fmtAddr(p.token)}`)));
      engine.on('exit', (p: any) => console.log(c.yellow(`exit  ${fmtAddr(p.token)}  ${p.closedReason}  ${(p.currentMarkPct).toFixed(1)}%`)));
      await engine.start();
    });

  program.command('board').description('the engine behind a local web page')
    .option('--live')
    .option('--port <n>', 'override port', (v) => parseInt(v, 10))
    .option('--host <s>', 'override host')
    .action(async (opts) => {
      printWordmark();
      const port = opts.port ?? env.BOARD_PORT;
      const host = opts.host ?? env.BOARD_HOST;
      const engine = makeEngine({
        ethPerShot: env.SNIPE_ETH,
        minScore: env.SNIPE_MIN_SCORE,
        budgetEth: env.SNIPE_BUDGET_ETH,
        maxOpen: env.SNIPE_MAX_OPEN,
        maxTaxBps: env.SNIPE_MAX_TAX_BPS,
        live: !!opts.live,
        adaptive: env.SNIPE_ADAPTIVE_TAX,
      });
      await startBoard(engine, { host, port });
      await engine.start();
      console.log(`  board       http://${host}:${port}`);
    });

  program.command('positions').description('open and closed positions')
    .option('--closed')
    .option('--json')
    .action((opts) => {
      const all = loadPositions();
      const rows = opts.closed ? all : all.filter((p) => p.status === 'open');
      if (opts.json) { console.log(JSON.stringify(rows, null, 2)); return; }
      printWordmark();
      for (const p of rows) {
        console.log(`  ${p.symbol.padEnd(10)}  ${fmtAddr(p.token)}  mark ${p.currentMarkPct.toFixed(1)}%  peak ${p.peakMarkPct.toFixed(1)}%  ${p.status}`);
      }
    });

  program.command('wallet').description('signer address, balance, unclaimed fees')
    .action(async () => {
      printWordmark();
      const addr = walletAddress();
      const bal = await client().getBalance({ address: addr as `0x${string}` });
      const pending = await client().readContract({ address: ADDR.feeEscrow, abi: feeEscrowAbi, functionName: 'pending', args: [addr as `0x${string}`] });
      console.log(`  address    ${addr}`);
      console.log(`  balance    ${fmtEth(bal)}`);
      console.log(`  unclaimed  ${fmtEth(pending)}`);
    });

  program.command('claim').description('claim your creator fees from the escrow')
    .option('--live')
    .action(async (opts) => {
      const { client: w, account } = walletClient();
      if (!opts.live) { console.log('dry run: would claim'); return; }
      const hash = await w.writeContract({ address: ADDR.feeEscrow, abi: feeEscrowAbi, functionName: 'claim', account, chain: null });
      console.log(`  submitted ${hash}`);
    });

  program.command('buy <token> <eth>').description('buy on curve or pool')
    .option('--live')
    .action((token: string, eth: string, opts) => {
      console.log(`dry run buy ${token} ${eth} ETH ${opts.live ? '(LIVE)' : ''}`);
    });

  program.command('sell <token> [pct]').description('sell a share of your balance')
    .option('--live')
    .action((token: string, pct: string, opts) => {
      console.log(`dry run sell ${token} ${pct ?? '100'}% ${opts.live ? '(LIVE)' : ''}`);
    });
}
