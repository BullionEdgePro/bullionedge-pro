/**
 * Give an existing account a staff role — the bootstrap for the very first
 * owner account, before any admin exists to grant roles from /admin/customers.
 *
 *   DATABASE_URL=... npx tsx scripts/grant-role.ts --email owner@example.com --role super_admin --yes
 *
 * The person must already have signed up and confirmed their email. Staff
 * roles require two-step sign-in: the staff area asks them to turn it on.
 * Writes an audit-log entry. Never creates accounts or touches passwords.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const ALLOWED = ["support", "kyc_reviewer", "admin", "super_admin"] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const role = arg("role") as (typeof ALLOWED)[number] | undefined;
  if (!email || !role || !ALLOWED.includes(role)) {
    throw new Error(`Usage: --email <address> --role <${ALLOWED.join("|")}> --yes`);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  if (!process.argv.includes("--yes")) {
    console.log(`Would give ${email} the role ${role} on database host ${host}. Re-run with --yes to apply.`);
    return;
  }

  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const { rows } = await db.query<{ id: string; role: string | null; emailVerified: boolean }>(
      `SELECT id, role, "emailVerified" FROM "user" WHERE lower(email) = $1`,
      [email],
    );
    const user = rows[0];
    if (!user) throw new Error(`No account for ${email}. Sign up on the site first.`);
    if (!user.emailVerified) throw new Error(`${email} hasn't confirmed their email yet.`);
    const roles = new Set((user.role ?? "buyer").split(",").map((r) => r.trim()).filter(Boolean));
    if (roles.has(role)) {
      console.log(`${email} already has ${role}: ${[...roles].join(",")}`);
      return;
    }
    roles.add(role);
    const next = [...roles].join(",");
    await db.query(`UPDATE "user" SET role = $1, "updatedAt" = now() WHERE id = $2`, [next, user.id]);
    await db.query(
      `INSERT INTO audit_log (id, "actorId", action, "targetType", "targetId", meta, "createdAt")
       VALUES ($1, NULL, 'customer.role_granted', 'user', $2, $3, now())`,
      [randomUUID(), user.id, JSON.stringify({ role, via: "scripts/grant-role.ts" })],
    );
    console.log(`✓ ${email} now has roles: ${next} (database host ${host})`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
