# Commands — every flag and env

## Global flags

| Flag | Env | Default | Description |
|---|---|---|---|
| `--rpc-url <url>` | `RPC_URL` | (public) | Primary RPC endpoint |
| `--rpc-ws <url>` | `RPC_WS_URL` | (publicnode) | Websocket for subscriptions. `off` to disable |
| `--json` | — | off | JSON-lines output for machine consumption |
| `--no-color` | — | off | Disable ANSI colors |
| `--help` | — | — | Print help |

## `dzo doctor [--probe]`

Verifies environment. Prints:
- Node version and platform
- Chain id (must be 4663)
- RPC endpoints in the pool and their capabilities
- Live pons factory parameters: `snipeTaxStartBps`, `snipeTaxSeconds`, `launchFee`, `graduationThreshold`
- Whether the signer is configured (address, balance) — only if `PRIVATE_KEY` is set
- `--probe`: additionally calls `V4Quoter` on a known pool to verify pool routing works

Exits non-zero on any failure. Safe in scripts.

## `dzo hunt`

Live launch feed. Prints one card per launch, follow-ups at +15s and +60s.

| Flag | Description |
|---|---|
| `--fire-only` | only FIRE verdicts |
| `--min-score N` | override minimum score for display |
| `--json` | JSON lines |
| `--no-follow` | disable follow-up lines |
| `--for SECONDS` | stop after N seconds |
| `--keyword STR` | regex filter on name/symbol/description |
| `--deployer 0x…` | one or more deployer addresses to show only |

## `dzo board [--live]`

Loopback HTTP + SSE + one HTML page.

| Flag | Description |
|---|---|
| `--port N` | override `BOARD_PORT` (default 4663) |
| `--host STR` | override `BOARD_HOST` (default 127.0.0.1) |
| `--live` | arm live sniping (still requires `arm` button in the UI) |

## `dzo snipe`

The engine.

| Flag | Env | Default | Description |
|---|---|---|---|
| `--eth N` | `SNIPE_ETH` | 0.01 | ETH per shot |
| `--min-score N` | `SNIPE_MIN_SCORE` | 60 | minimum score to fire |
| `--budget N` | `SNIPE_BUDGET_ETH` | 0.05 | session budget cap |
| `--max-open N` | `SNIPE_MAX_OPEN` | 3 | position cap |
| `--max-tax N` | `SNIPE_MAX_TAX_BPS` | 300 | tax ceiling in bps |
| `--keyword STR` | — | none | regex on name/symbol/description |
| `--deployer 0x…` | — | none | one or more deployer allow-list |
| `--allow-pairs` | — | off | permit USDG and stock-token pairs |
| `--adaptive-off` | `SNIPE_ADAPTIVE_TAX` | on | disable adaptive ceiling |
| `--wallets NAMES` | — | (single) | multi-wallet mode, comma-separated names from `config/wallets.yaml` |
| `--live` | — | off | sign and send |

## `dzo replay <range>`

Historical replay.

| Flag | Description |
|---|---|
| `--from BLOCK` / `--to BLOCK` | explicit block range |
| `--last DURATION` | e.g. `24h`, `6h`, `3d` |
| `--rules FILE` | alternative `scoring.yaml` |
| `--csv FILE` | write every decision as CSV |
| `--json` | JSON lines |
| `--verbose` | show every enriched launch |

## `dzo tune <range>`

Grid search over score weights.

| Flag | Description |
|---|---|
| `--last DURATION` | historical window |
| `--iter N` | number of samples (default 200) |
| `--seed N` | RNG seed for reproducibility |
| `--top N` | number of top configs to print (default 5) |
| `--write FILE` | write best config to a YAML file |

## `dzo watch <token>`

Follow one token. Prints a line every 5s.

## `dzo scan <token>`

Everything on-chain about one token, printed once.

## `dzo fees <token>`

Fee recipient, accrued from curve and pool, every claim with timestamp and tx hash.

## `dzo dev <address>`

Every launch by one deployer with its phase, served from local SQLite.

| Flag | Description |
|---|---|
| `--window BLOCKS` | how far back to search (default 400000) |
| `--json` | JSON lines |

## `dzo buy <token> <eth>`

Buy on the curve or the pool depending on phase. Dry run unless `--live`.

## `dzo sell <token> [pct]`

Sell a share of your balance (default 100%). Route by phase.

| Flag | Description |
|---|---|
| `--live` | required to send |

## `dzo positions`

Open and closed positions marked live.

| Flag | Description |
|---|---|
| `--closed` | include closed |
| `--json` | JSON lines |

## `dzo wallet`

Signer address, ETH balance, unclaimed creator fees.

## `dzo claim`

Claim creator fees. `--live` to send.

## Environment variables (full list)

All defaults are in `.env.example`. Any variable set in `.env` overrides its default.

| Variable | Purpose |
|---|---|
| `RPC_URL` | primary RPC |
| `RPC_URL_EXTRA` | comma-separated additional readers |
| `RPC_WS_URL` | subscription endpoint. `off` to poll |
| `RPC_IN_FLIGHT` | max concurrent requests through the gate |
| `RPC_SPACING_MS` | min spacing between requests |
| `RPC_LOGS_SPACING_MS` | min spacing between `eth_getLogs` |
| `RPC_COOLDOWN_MS` | cooldown after a 429 |
| `PRIVATE_KEY` | signer, live only |
| `SNIPE_ETH` | ETH per shot |
| `SNIPE_MAX_TAX_BPS` | tax ceiling |
| `SNIPE_BUDGET_ETH` | session budget |
| `SNIPE_MAX_OPEN` | position cap |
| `SNIPE_MIN_SCORE` | minimum score |
| `SNIPE_ADAPTIVE_TAX` | `on`/`off` |
| `TAKE_PROFIT_PCT` / `STOP_LOSS_PCT` / `TRAILING_PCT` / `MAX_HOLD_MIN` | exits |
| `BOARD_PORT` / `BOARD_HOST` | board binding |
| `SCORING_CONFIG` | path to `scoring.yaml` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` / `TELEGRAM_TWO_WAY` | Telegram alerts |
| `DISCORD_WEBHOOK_URL` | Discord alerts |
| `REF_AXIOM` / `REF_FOMO` | referral handles for the wordmark line |
