# Contributing to DZO

DZO is a small tool with a clear scope. Contributions that stay inside that scope are welcome; drift is not.

## Scope

DZO is:

- a local, non-custodial CLI + loopback board
- for reading pons v2 launches on Robinhood Chain
- and firing a rule-based buy after the opening tax decays
- with a historical backtest so the rules are defensible

DZO is not:

- a hosted bot
- a copy-trading service
- a bundler
- an MEV tool (the chain has no auction to win)
- a launchpad, a token, or a fund

## Ground rules

1. **Dry run is the default.** Any command that could send a transaction must default to dry run and require `--live`.
2. **`PRIVATE_KEY` is only ever read in `src/trade/wallet.ts`.** No other file touches it.
3. **Reasons are non-negotiable.** Every refusal must say which rule refused. Every FIRE must show every scoring line.
4. **The RPC gate is the only network path for reads.** No direct `fetch` outside `util/rpcGate.ts` and the alerts modules.
5. **No new external dependencies without discussion.** DZO ships with 5 runtime deps.
6. **Tests must pass on Node 20.** No network in tests.

## Style

- TypeScript strict mode on
- Prettier defaults (2-space indent, single quotes, semicolons)
- Comments explain *why*, not *what*
- File headers document the purpose in ≤ 5 lines

## PR checklist

- [ ] `npm run typecheck` clean
- [ ] `npm test` green
- [ ] `docs/` updated if behavior changed
- [ ] `.env.example` updated if a new variable was added
- [ ] `docs/CREDITS.md` updated if new prior art was borrowed
- [ ] No new file writes outside `data/` or the working directory

## Reporting issues

Use GitHub issues. For anything that could be a security concern (RPC leakage, key handling, unsigned transactions in dry run) please open a private security advisory instead of a public issue.

## Not welcome

- Pull requests that add copy trading, bundling, or MEV-style features
- Pull requests that add a hosted mode
- Cosmetic churn that touches unrelated files
- "Refactors" that remove reasons from refusals
