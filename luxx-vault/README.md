# Luxx4less

Precious-metals storefront and verified marketplace for Luxx4less Golds and Diamonds. The full brief is in `PROMPT.md`.

Current phase: **2, accounts and security — awaiting owner review.** Put it online with **`DEPLOY.md`**. See `DECISIONS.md` and `TODO.md`; screenshots in `docs/screenshots/phase-2/` and `phase-1/`. Phase 0 audit: `AUDIT.md`, `PARITY.md`, `FEATURES.md`.

## Run it

```powershell
cd "C:\CLIENT FILES\LUXXE4LESS\luxx-vault"
npm install
copy .env.example .env      # then fill in DATABASE_URL and BETTER_AUTH_SECRET
npx prisma migrate dev
npm run dev
```

Needs Node.js 22+ and PostgreSQL. Then open http://localhost:3000/design-system (design board) and http://localhost:3000/design-system/hero (hero prototype).

## Useful commands

| Command | What it does |
|---|---|
| `npm run images` | Process photos in `brand-assets/` (strips GPS/EXIF, makes AVIF/WebP) |
| `npm run brand:logo` | Rebuild the Luxx4less logo geometry |
| `npm run brand:icons` | Rebuild favicon, app icons and the logo files in `public/brand/` |
| `npm run test:e2e` | Browser tests of the account flow (dev server running) |
| `npm run db:migrate` | Apply database schema changes locally |
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
