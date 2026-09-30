# Luxx Vault by Luxx4less

Precious-metals storefront and verified marketplace for Luxx4less Golds and Diamonds. The full brief is in `PROMPT.md`.

Current phase: **1, design system — awaiting owner review.** See `DECISIONS.md` and `TODO.md`; screenshots are in `docs/screenshots/phase-1/`. Phase 0 audit: `AUDIT.md`, `PARITY.md`, `FEATURES.md`.

## Run it

```powershell
cd "C:\CLIENT FILES\LUXXE4LESS\luxx-vault"
npm install
npm run dev
```

Then open http://localhost:3000/design-system (design board) and http://localhost:3000/design-system/hero (hero prototype).

## Useful commands

| Command | What it does |
|---|---|
| `npm run images` | Process photos in `brand-assets/` (strips GPS/EXIF, makes AVIF/WebP) |
| `npm run brand:logo` | Rebuild the Luxx4less logo geometry |
| `npm run brand:icons` | Rebuild favicon, app icons and the logo files in `public/brand/` |
| `npm run preview:build` | Build the self-contained review preview in `preview/` |
| `npm run brand:peso` | Rebuild the ₱ glyph that pairs with Cinzel |
| `npm test` / `npm run lint` / `npm run typecheck` | Checks |
| `npm run screenshots` | Review screenshots + hero still image (needs `npm run build && npm start` running) |

## Run the reference audit (Windows)

```powershell
cd "C:\CLIENT FILES\LUXXE4LESS\luxx-vault"
npm install
npx playwright install chromium
npm run audit:reference
```

Output goes to `audit/`. Commit it so the audit can be completed.
