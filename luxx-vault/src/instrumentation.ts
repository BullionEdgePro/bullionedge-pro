/**
 * Runs once when a Next.js server instance starts (see
 * node_modules/next/dist/docs/01-app/02-guides/instrumentation.md).
 *
 * Price alerts: the checker hooks onto the price engine so it runs after every
 * refresh. Node.js runtime only: the engine uses Prisma and node:crypto, which
 * the Edge runtime doesn't have. The import sits inside register() so nothing
 * loads for the Edge build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/server/alerts/register");
  }
}
