import "dotenv/config";
import { Client } from "pg";

/**
 * Each run signs up and signs in from the same address, so clear the
 * rate-limit counters first. Local databases only: never touches a remote one.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) return;
  const db = new Client({ connectionString: url });
  await db.connect();
  await db.query('DELETE FROM "rateLimit"');
  await db.end();
}
