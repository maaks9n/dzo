# Changelog

All notable changes to DZO will be documented here. Format loosely follows Keep a Changelog; SemVer 0.x.

## [Unreleased]

### Added
- Deployer index persisted to SQLite (`data/deployers.db`), incremental catch-up
- Cluster fingerprint 2.0 — similarity across dev-buy proximity, tax equality, links Jaccard, description n-grams, exempt-count equality, temporal density
- `dzo replay <range>` — historical backtest against the current rules; P&L, confusion matrix, entry-tax distribution
- `dzo tune <range>` — grid search over score weights (CLI stub in 0.1.0; implementation in 0.2.0)
- Adaptive tax ceiling — EMA of realized entries; `SNIPE_ADAPTIVE_TAX=on` by default
- Health-scored RPC pool — per-method routing over N endpoints, p95 latency + refuse rate over rolling window
- `config/scoring.yaml` — every weight is data, no rebuild required
- Multi-wallet planner (opt-in via `--wallets`)
- Two-way Telegram commands (opt-in via `TELEGRAM_TWO_WAY=on`)
- Windows `.cmd` launchers: `start-hunt`, `start-snipe`, `start-board`, `start-replay`
- Full docs set: ARCHITECTURE, STRATEGY, SAFETY, COMMANDS, BOARD, BRAND, design, CREDITS

## [0.1.0] — 2026-XX-XX

Initial release.
