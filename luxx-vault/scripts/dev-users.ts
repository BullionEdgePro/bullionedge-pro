/**
 * Local test accounts, one per verification tier, for development and QA.
 * `npm run dev:users` — safe to re-run (resets them to the stated tier).
 *
 * LOCAL DATABASES ONLY: refuses to run unless DATABASE_URL points at
 * localhost. These accounts and this password must never exist in production.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { Client } from "pg";

/** Shared password for every dev account below (local only). */
export const DEV_PASSWORD = "Luxx-Dev-Vault-2026!";

const ACCOUNTS = [
  { email: "tier1@luxx.test", name: "Tala Tier-One", handle: "tala-t1", tier: 1, role: "buyer" },
  { email: "tier2@luxx.test", name: "Paolo Tier-Two", handle: "paolo-t2", tier: 2, role: "buyer" },
  { email: "tier3@luxx.test", name: "Bea Tier-Three", handle: "bea-t3", tier: 3, role: "buyer" },
  { email: "seller@luxx.test", name: "Migs Seller", handle: "migs-gold", tier: 4, role: "buyer,seller" },
  { email: "seller2@luxx.test", name: "Rina Seller", handle: "rina-jewels", tier: 4, role: "buyer,seller" },
  { email: "admin@luxx.test", name: "Ana Admin", handle: "ana-admin", tier: 3, role: "buyer,kyc_reviewer,admin" },
] as const;

const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error("Refusing to create dev accounts: DATABASE_URL is not a local database.");
  }
  const db = new Client({ connectionString: url });
  await db.connect();
  const passwordHash = await hash(DEV_PASSWORD, ARGON);
  const now = new Date();

  for (const a of ACCOUNTS) {
    const id = `dev_${a.handle.replace(/[^a-z0-9]/g, "_")}`;
    await db.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, $5, $5)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, "emailVerified" = true, role = EXCLUDED.role, "updatedAt" = EXCLUDED."updatedAt"`,
      [id, a.name, a.email, a.role, now],
    );
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [a.email]);
    const userId = rows[0]!.id;
    await db.query(`DELETE FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`, [userId]);
    await db.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
      [`${id}_cred`, userId, passwordHash, now],
    );
    await db.query(
      `INSERT INTO profile ("userId", handle, "displayName", phone, "phoneVerifiedAt", "regionCode", "provinceCode", "cityCode",
         "identityVerifiedAt", "sellerVerifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, '040000000', '045800000', '045802000', $6, $7, $8, $8)
       ON CONFLICT ("userId") DO UPDATE SET handle = EXCLUDED.handle, "displayName" = EXCLUDED."displayName", phone = EXCLUDED.phone,
         "phoneVerifiedAt" = EXCLUDED."phoneVerifiedAt", "identityVerifiedAt" = EXCLUDED."identityVerifiedAt",
         "sellerVerifiedAt" = EXCLUDED."sellerVerifiedAt", "updatedAt" = EXCLUDED."updatedAt"`,
      [
        userId,
        a.handle,
        a.name,
        a.tier >= 2 ? "+639170000000" : null,
        a.tier >= 2 ? now : null,
        a.tier >= 3 ? now : null,
        a.tier >= 4 ? now : null,
        now,
      ],
    );
    console.log(`✓ ${a.email.padEnd(20)} tier ${a.tier}  roles ${a.role}`);
  }
  await db.query('DELETE FROM "rateLimit"');
  await db.end();
  console.log("\nPassword for all: see DEV_PASSWORD in scripts/dev-users.ts (local only).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
