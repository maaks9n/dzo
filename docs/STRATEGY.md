# Strategy: what the rules mean, where the numbers come from, how to test them

Everything below was measured on Robinhood Chain on 2026-09-03. Change the rules to fit your own reading of the chain; the defaults are a starting point, not advice. Every default in this doc is a line in `config/scoring.yaml` you can edit, then verify with `dzo replay`.

## The opening tax is the whole game

`snipeTaxStartBps() = 9900`, `snipeTaxSeconds() = 3` on the live factory. A buy in the first ~200ms hands 97% of the spend to the creator's fee bucket (the curve caps the tax so the buyer keeps at least 1%). At one second it is roughly a quarter, at two seconds a few percent, at three it is gone. The chain seals a block every ~100ms and orders transactions by arrival, so there is no gas auction to win. DZO reads `currentSnipeTaxBps(yourAddress)` every 150ms and releases under the ceiling.

Default ceiling `SNIPE_MAX_TAX_BPS=300` (3%). Measured dry-run entries: tax 0–0.31%, 188–1710ms after detection.

**Adaptive ceiling.** With `SNIPE_ADAPTIVE_TAX=on` (default), the engine tracks the EMA of realized tax on the last 50 successful entries. When the observed median holds steady near 0.19%, the effective ceiling tightens toward 200 bps; when a run of latency misses widens the median to 0.5%, ceiling relaxes back toward the configured max. This means a fast machine on a private RPC earns tighter entries automatically; a slow one on public RPC does not miss every launch.

## What the score rewards and punishes

Weights live in `config/scoring.yaml`. Defaults:

| Signal | Points | Why |
|---|---|---|
| dev buy 1–6% of supply | +15 | skin in the game without a bag that can flatten the curve; the builder launches that graduated this week sat at 3% |
| dev buy over 10% | −25 | a 12.5% dev buy killed a Grok Build clone at $5.9K while a 2.5% one reached $140K |
| no dev buy | −10 | nothing at stake |
| creator tax ≤ 2% | +10 | the creator earns on volume and has a reason to keep posting |
| creator tax > 5% | −25 | traders pay 6%+ per side; flow dies |
| fees routed to a third party | +5 and a flag | the builder/KOL deal pattern: the wallet that launched is not the wallet that gets paid |
| X link / website / telegram | +8 / +8 / +3 | a launch with nowhere to go has no one to bring flow |
| no socials | −15 | |
| exempt wallets 1–3 / 4+ | −5 / −20 | addresses declared exempt from the opening tax at launch are the declared bundle |
| fresh deployer | +5 | |
| deployer graduated ≥ 30% of recent launches | +15 | |
| serial deployer, ≥ 5 launches, none graduated | −25 | the feed shows deployers with 185 and 297 launches in 11 hours and zero graduations |
| cluster fingerprint 0.4–0.7 | −8 | possibly one arm of a farm |
| cluster fingerprint > 0.7 | −25 | one operator, multiple wallets, near-identical calldata, minutes apart |
| ≥ 10 distinct buyers in the first minute | +10 | organic flow (follow-ups only) |
| every early buy paid the opening tax | −10 | bots only |

**Verdicts:** FIRE ≥ 75, WATCH ≥ 45, SKIP below.

## The sniper's rules (on top of the score)

| Rule | Default | Flag |
|---|---|---|
| minimum score | 60 | `--min-score` |
| ETH-paired launches only | yes | `--allow-pairs` (stock-token and USDG pairs exist and are common) |
| dev share | ≤ 8% | `config/scoring.yaml → rules.maxDevShare` |
| creator tax | ≤ 3% | `config/scoring.yaml → rules.maxCreatorTax` |
| socials required | yes | `--no-socials-ok` |
| exempt wallets | ≤ 2 | `config/scoring.yaml → rules.maxExemptWallets` |
| keyword on name/symbol/description | none | `--keyword` |
| deployer allow-list | none | `--deployer` |
| max open positions | 3 | `--max-open` |
| cluster fingerprint | ≤ 0.7 | `config/scoring.yaml → rules.maxClusterScore` |
| ETH per shot | `SNIPE_ETH` = 0.01 | `--eth` |

Five of these (min score, max open, tax ceiling, dev share, exempt wallets) can be changed while the engine runs, from the board.

A launch with four wallets exempt from the opening tax is refused by the defaults even when everything else looks good. That is the point of showing reasons: you decide which rule to relax, on purpose.

## The multi-wallet planner (opt-in)

`--wallets strict,loose` runs two signers in one session, each with its own thresholds and budget. Example `config/wallets.yaml`:

```yaml
wallets:
  strict:
    keyfile: .keys/strict.key
    minScore: 85
    maxDevShare: 0.05
    budget: 0.03      # ETH per session
    ethPerShot: 0.01
  loose:
    keyfile: .keys/loose.key
    minScore: 60
    maxDevShare: 0.08
    budget: 0.02
    ethPerShot: 0.005
```

A launch that scores 82 fires from `loose` only. One that scores 90 fires from `strict`. Never both. The session budget is per wallet.

## Exits

| Rule | Default | Env |
|---|---|---|
| take profit | +80% | `TAKE_PROFIT_PCT` |
| stop loss | −35% | `STOP_LOSS_PCT` |
| trailing stop | 25% below the peak | `TRAILING_PCT` |
| max hold | 45 min | `MAX_HOLD_MIN` |

Marks come from a real quote (curve `quoteSell` or `V4Quoter`), so a mark already includes the 1% fee, the creator tax and price impact of selling the whole position. A fresh 0.01 ETH entry marks around −10% immediately; that is the round trip, not a loss yet.

## Backtest — the honest defense

```bash
dzo replay --last 24h                      # yesterday, current rules
dzo replay --from 52526287 --to 53396287   # any block range
dzo replay --rules experimental.yaml       # a different rule set
```

Replay walks the historical `TokenLaunched` logs in the range, enriches each launch as if it were live, decides with the current rules, and — for every FIRE — computes a hypothetical entry at the block where the ceiling would first have released, then marks it against the actual curve or pool state 45 minutes later (or at the closer of TP / SL / trailing / graduation). Output:

- fires: 148
- wins: 41 (+34.2% avg)
- losses: 107 (−22.1% avg)
- net P&L: +0.187 ETH over 148 fires × 0.01 ETH
- hit-rate: 27.7%
- entry tax median: 0.21%, p95 0.44%
- confusion matrix: `FIRE→grad 41 / FIRE→dump 107 / SKIP→grad 518 / SKIP→dump 23,796`

A net-negative replay means the defaults would have lost on yesterday. Adjust before going live.

## Tune — where new weights come from

```bash
dzo tune --last 24h --iter 200 --seed 42
```

Grid search over score weights within safe bounds (each weight moves ±30% from default across 200 samples) against the last labeled window. Prints top 5 sets by net P&L and top 5 by hit-rate. Copy one into `config/scoring.yaml` and rerun `replay` to confirm.

`tune` is not machine learning; it is deterministic search with a seed. Reproducible.

## Graduation

The curve closes when 4.2 ETH of real quote is in (config 0). The factory sweeps it and creates a full-range, permanently locked Uniswap v4 position. Between sweep and pool there is a gap of seconds to minutes when nothing can trade; `sellAnywhere` refuses during that gap instead of guessing. On 2026-09-02/03: 24,462 launches, 559 graduations, so about one launch in 44 graduates.

## Known blind spots

- **Fingerprint is only as good as the axes.** Cluster 2.0 catches wide farms (randomized dev-buy, rotated links). A farm that varies description, dev-buy, tax *and* rotates fee recipient still slips. `--keyword` and `--deployer` narrow the feed further.
- **Fee recipient identity.** "Third party" tells you the fees leave the deployer; it cannot tell you who receives them.
- **Stock-token pairs.** FDV in NVDA or MSFT units is shown without a USD figure; the board and the feed do not price stock tokens.
- **Replay is not a live test.** It uses historical state; live latency, RPC quirks and slippage may differ. Replay green is necessary, not sufficient.
- **One engine per `data/` directory.** `snipe` and `board` both write `data/positions.json`; run one of them at a time.

## What the strategy does not do

It does not chase the first block. It does not bundle. It does not add priority fees (they do not reorder anything here). It does not sell into the graduation sweep. It does not promise anything.
