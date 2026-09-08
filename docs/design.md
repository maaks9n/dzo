# Design

## Principle

The tool renders in a terminal or a monospace HTML page. Design serves reading, not display. Every choice below optimizes for reading a stream of high-density numeric information at a glance.

## Layouts

### Terminal card (hunt, snipe, watch)

```
──────────────────────────────────────────────────────────────
 EXAMPLE  0x0da7…45ac                                  FIRE 82
──────────────────────────────────────────────────────────────
 dev buy  3.1%   tax  1.5%   exempt  0   cluster  0.12
 socials  x · web · tg           deployer  0xbBa6…AD4c (2/7)
 curve    0.31 / 4.20 ETH        FDV  15.4 ETH  ($34,880)
 opening tax now  0.19%  → ready
──────────────────────────────────────────────────────────────
 + dev buy 3.1% in 1–6%           +15
 + creator tax 1.5% ≤ 2%          +10
 + socials: x, web, tg            +19
 + deployer 2/7 graduated ≥ 30%   +15
 + cluster 0.12 clean             +8
 − exempt-wallets check           +0
 + fresh 12h                      +5
──────────────────────────────────────────────────────────────
 open: pons · axiom · fomo · explorer
```

Rules:
- 64 columns wide, wraps predictably
- Horizontal rules made from `─` (U+2500), never `-` or `=`
- Right-aligned verdict badge always at column 63
- Score total in the verdict badge, colored by verdict
- Contribution lines aligned on the sign column and points column

### Terminal follow-up line

```
 +15s  buyers 4  taxed 1  mark −8%   +60s  buyers 11  mark +12%
```

Single line, no break, right-aligned in the same column as the card's contract.

### Board card (HTML)

Same fields, same order, same emphasis. Cards stack, 480px wide, 12px gap. Drawer opens to 720px on the right, full height, scroll.

### Charts

The only chart is the decay curve in the drawer:

- x-axis: seconds since launch (0..3)
- y-axis: current tax in bps (0..9900)
- one thin electric-green line
- a dashed horizontal line at the current ceiling
- one dot at the moment of firing (if fired)

No candles. No volume bars. Marks are text in the position line.

## Motion

- Streaming feed: new cards fade in over 200ms from the top
- Verdict badge: no animation
- Ticker pulse (bottom of board): a single-pixel dot appears every 10s, no color change
- Position mark update: number swaps in place, no flash

Reduced-motion respected via `prefers-reduced-motion`.

## Type scale

| Slot | Size | Line | Weight |
|---|---|---|---|
| Wordmark | 24px | 24 | 700 |
| H1 | 20px | 28 | 600 |
| H2 | 16px | 24 | 600 |
| Body | 14px | 22 | 400 |
| Mono readouts | 13px | 20 | 500 |
| Caption | 12px | 18 | 400 |

## Grid

- Root font size 14px
- Vertical rhythm 4px (all margins are multiples of 4)
- Card padding 12px (12 = 3 × 4)
- Drawer padding 16px (4 × 4)
- Focus outline 2px solid `accent`, 2px offset

## Terminal palette (16-color safe)

If the terminal cannot render RGB, DZO falls back to:

- bright green → verdict FIRE and accents
- yellow → verdict WATCH
- gray → verdict SKIP
- red → errors and stop-loss

Nothing else uses color.

## OG image spec

- 1200×630
- black background `#0A0A0A`
- centered wordmark `DZO`, 200px, Berkeley Mono 700, `#00FF88`
- below in 32px cream: `wait for zero`
- bottom-right in 18px muted: `github.com/Dezo/dzo`
- decay curve schematic in top-left corner at 40% opacity

## Favicon spec

- 512×512 SVG
- black square, rounded corners 12px
- centered `O` in `#00FF88`, 3px stroke, crosshair inside
- alt text: `DZO — wait for zero`
