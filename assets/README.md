# assets/

Put the following files here before publishing the repo. All are optional but the OG image and favicon are used by GitHub's card renderer.

- `logo.svg` — DZO wordmark, `#00FF88` on `#0A0A0A`, 512×512
- `favicon.svg` — the O with a crosshair, 512×512
- `og.png` — Open Graph card, 1200×630, matches `docs/design.md` § "OG image spec"
- `hero.png` — README hero banner, 1500×500
- `mascot.png` — 8-bit pixel-art stopwatch, 32×32 (upscaled to 128×128 for display)

Prompts for generating each of these live in `docs/BRAND.md` and can be pasted into any diffusion model. Palette and typography constraints are enforced by `docs/design-tokens.json`.
