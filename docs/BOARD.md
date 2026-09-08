# The board

`dzo board` opens a loopback HTTP server on `127.0.0.1:4663` and streams engine events to a single HTML page over Server-Sent Events. It has no external network binding, no auth, no cookies, and only four POST verbs into the engine.

## What you see

**Header.** The DZO wordmark, chain id, current block, RPC pool health (green/yellow/red per endpoint), signer address if `--live`, session budget bar.

**Feed.** One card per launch, newest on top, colored by verdict: green FIRE, yellow WATCH, gray SKIP. Card shows: symbol, contract, deployer, dev-buy %, tax %, exempt-wallet count, cluster fingerprint score, score total, top 3 rules that contributed. Click for the full drawer.

**Drawer.** Every rule with its contribution (+/−) and reason. Every link (pons, Axiom, FOMO, explorer). Description, socials. Full timeline (detected, enriched, scored, decided, fired/passed). If a position is open on this token: current mark, unrealized P&L, `close now` button.

**Controls (left panel).**
- Start / Stop demo (dry run) or Arm / Disarm live sniping
- Fire filter toggle (only show FIRE cards)
- Search (free text on name/symbol/deployer/contract)
- Five steppers: min score, max open positions, max tax bps, max dev share, max exempt wallets. Bounded per-rule; changes take effect on the next launch.

**Ticker (bottom).** Pulse every 10s so you can tell a quiet chain from a dead engine. Shows: seen launches / 60s, fires / 60s, passes / 60s, avg entry tax (last 20).

## Keyboard

- `p` — start/stop
- `f` — toggle fire filter
- `/` — focus search
- `esc` — close drawer
- `arrows` — navigate cards

## POST endpoints (four verbs, all loopback)

| Verb | Path | Body | What |
|---|---|---|---|
| `POST` | `/api/engine/pause` | — | pause firing |
| `POST` | `/api/engine/resume` | — | resume firing |
| `POST` | `/api/positions/close` | `{ token, pct? }` | sell a position at current quote |
| `POST` | `/api/rules/update` | `{ key, value }` | change one bounded rule |

There is no `POST /api/buy`. `--live` is a launch flag, not a button.

## Two things hidden in the page

1. **`R` twice** — reveals the raw stream (SSE events as JSON) in a monospace panel. Useful for debugging.
2. **`?debug=1`** in the URL — enables verbose logs in the browser console (RPC round-trip times, decision paths).

## Multi-user note

The board binds `127.0.0.1`. Anyone on your machine can open it and click the buttons. If you share the machine, use `--port` to move it, and remember they can still find it. There is no auth by design; adding one on loopback would be theatre.

## Design tokens

Colors and typography come from `docs/design-tokens.json`. Wordmark uses Berkeley Mono at 18px (or JetBrains Mono as fallback). Palette:

- background: `#0A0A0A`
- surface: `#141210`
- accent green: `#00FF88`
- text primary: `#F5F1E8`
- text muted: `#8B8680`
- fire: `#00FF88`
- watch: `#FFB347`
- skip: `#4A4A4A`
