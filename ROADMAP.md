# Roadmap

Public plan. Order is intent, not commitment.

## 0.1 — Now

- [x] Detection + enrichment
- [x] Score + reasons
- [x] SQLite deployer index
- [x] Cluster fingerprint 2.0
- [x] Curve trades (buy/sell)
- [x] v4 quotes + swaps
- [x] Exit rules
- [x] Board (loopback + SSE + HTML)
- [x] Adaptive tax ceiling
- [x] Docs set
- [ ] `dzo tune` grid search — CLI shape only, implementation in 0.2

## 0.2 — Next

- [ ] `dzo tune` — full grid search with deterministic seed
- [ ] Multi-wallet planner test suite against `dzo replay`
- [ ] Two-way Telegram bridge finished (currently: send + basic receive)
- [ ] Rich terminal UI (`blessed`) as a `dzo tui` command
- [ ] `dzo watch` graduation-detection line
- [ ] `dzo scan` output as a printable card

## 0.3 — Later

- [ ] Historical price series for `watch` and `positions --closed`
- [ ] Web dashboard with graduation-rate heatmap
- [ ] Signed release binaries (Windows / macOS / Linux)
- [ ] Optional `pnpm` install path

## Explicitly out of scope forever

- Copy trading of anonymous whales
- Bundling
- MEV-style priority auctions (chain has no auction)
- Hosted / SaaS mode
- Token-gated features paid in $DZO or anything else
