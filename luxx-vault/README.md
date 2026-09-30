# Luxx Vault by Luxx4less

Precious-metals storefront and verified marketplace for Luxx4less Golds and Diamonds. The full brief is in `PROMPT.md`.

Current phase: **0, reference audit** (see `AUDIT.md`, `PARITY.md`, `TODO.md`, `DECISIONS.md`).

## Run the reference audit (Windows)

```powershell
cd "C:\CLIENT FILES\LUXXE4LESS\luxx-vault"
npm install
npx playwright install chromium
npm run audit:reference
```

Output goes to `audit/`. Commit it so the audit can be completed.
