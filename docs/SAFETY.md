# Safety

## Custody

- The only secret is `PRIVATE_KEY` in your own `.env`. It is read by `src/trade/wallet.ts` and used to sign transactions sent to the RPC you configured. It is never printed, logged, written to `data/`, or sent anywhere else.
- Use a fresh wallet with only what you are willing to lose in a session. DZO never asks for more than one buy at a time.
- `.env` is git-ignored. `data/positions.json` contains token addresses and amounts, not keys. `data/deployers.db` contains only chain data.
- Multi-wallet mode reads each signer from a separate keyfile referenced in `config/wallets.yaml`. The same custody rules apply per wallet.

## Dry run is the default

`snipe`, `buy`, `sell`, `claim` and `board` quote and log without sending unless you pass `--live`. A dry run reads the same chain state and prints the same decision, so you can watch the engine for an hour before it is allowed to spend anything. The board goes one step further: even in dry run it opens as a feed and fires nothing until you press start.

`replay` and `tune` are read-only by definition — they only touch historical chain state.

## Four walls around a live session

1. **The confirmation.** `--live` prints the signer's address, its balance, the size per buy, the position cap and the session budget, refuses if the balance does not cover one buy, and waits for you to type `arm`. On the board the same session needs the button too.
2. **The buy size** (`--eth`, `SNIPE_ETH`): what one entry costs. Default 0.01 ETH.
3. **The position cap** (`--max-open`): how many entries can be open at once. Default 3.
4. **The session budget** (`--budget`, `SNIPE_BUDGET_ETH`): the total ETH entries may consume in one run. Default 0.05 ETH. When reached every further launch is refused with `session budget reached`, whatever its score. A wallet that holds only the budget cannot lose more than the budget.

In multi-wallet mode each wallet has its own budget wall. Blowing one wallet's budget does not spill into the other.

Start with a fresh wallet holding the budget and nothing else. Raise the numbers after you have watched the exits work for a session and `replay` shows green.

## What can still go wrong with `--live`

| Risk | What DZO does | What it cannot do |
|---|---|---|
| the curve graduates between quote and send | `minTokensOut` bounds the rate; a clamped fill at that rate settles, a worse one reverts | recover gas spent on a revert |
| a launch is a honeypot on the pool side | the curve itself is protocol code; the pons v4 hook is the same singleton for every launch | guarantee a token's *pool* behaves if the protocol changes |
| a public RPC rate-limits or challenges the client | health-scored pool: multiple endpoints, capability-routed per method, bounded concurrency, spacing, cooldown after a 429, penalty box, retries that wait; detection over websocket needs no polling | make a public endpoint faster; set `RPC_URL` / `RPC_WS_URL` / `RPC_URL_EXTRA` to your own providers |
| the sequencer's compliance filter voids a transaction | none; it is protocol-level | anything |
| stop-loss fires into a thin curve | marks are real quotes for the full position size, so the exit price is what the mark showed | avoid slippage on an illiquid curve |
| a launch farm passes every per-launch rule | cluster fingerprint 2.0 catches farms with randomized numbers; two-axis exact + three-axis similarity clears the 0.7 bar | catch a farm that varies every axis independently |
| your `replay` said green, live is red | adaptive ceiling logs realized tax after each entry; deviation flags in the terminal | guarantee live matches historical latency |
| you relax `maxExemptWallets` | prints the exact number of exempt wallets and their addresses in `scan` and the drawer | tell you who they are |

## What the board can and cannot do

It listens on 127.0.0.1 only. It can pause and resume firing, close an open position at the current quote, and change five numeric rules inside fixed bounds. It cannot buy on demand and cannot switch a dry run to live: `--live` is decided when you start it. Anyone on your machine can open it; nobody outside can. If several people share the machine, start it with a different `--port` and assume they can click.

## What Telegram two-way can and cannot do

Off by default. With `TELEGRAM_TWO_WAY=on` and your `TELEGRAM_CHAT_ID` set, the engine will accept these replies from that chat:

- `close 0xabc…` — sell the named position at the current quote
- `pause` — stop firing
- `resume` — start firing again
- `status` — print open positions

It will not accept `buy`, `arm`, or anything that opens a position. It will not accept commands from other chats. It will not accept anything with `--live` off. Two-way is a convenience for closing on your phone, not a remote control.

## Fees and taxes you pay on every trade

- Curve: 1% base fee plus the creator tax (0–10%, shown per launch) on the input of a buy and the output of a sell.
- Pool: the pons hook takes 1% plus the creator tax from the unspecified currency of each swap; the pool's own LP fee is 0.
- Opening tax: 99% decaying to 0 over 3s on buys only. DZO waits it out; if you call `buy` by hand in the first second, you pay it.

## Not investment advice

DZO reads state and executes rules you configured. It has no opinion about any token. The `replay` command tells you what your rules would have done on historical chain state; it does not predict what they will do next. Neither does this repository.
