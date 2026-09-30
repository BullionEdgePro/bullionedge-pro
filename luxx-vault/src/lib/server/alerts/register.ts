import "server-only";
import { onPricesRefreshed } from "../prices/engine";
import { checkPriceAlerts } from "./check";

/**
 * Wires the alert checker up. Imported from src/instrumentation.ts (Node.js
 * runtime only) and, as a safety net, from the alerts page.
 *
 * Two triggers, because neither is enough alone:
 *
 * 1. A hook on the price engine, so a refresh that stores new prices is
 *    checked at once. The engine keeps its hooks in module scope, and Next.js
 *    can load instrumentation and the routes as separate module instances
 *    (observed in `next dev`: a refresh made by /api/prices never reached a
 *    hook registered elsewhere). So each engine instance that imports this
 *    file gets exactly one hook, keyed on its own `onPricesRefreshed`.
 * 2. A once-a-minute sweep per server process (kept on globalThis, so it is
 *    started once however many module instances load this file). The rules
 *    compare the two newest snapshots in the database, so it doesn't matter
 *    which instance stored them. On serverless hosts the sweep only runs
 *    while an instance is warm; the hook and the daily cron cover the rest.
 *
 * Double sends are impossible either way: firing is claimed atomically in the
 * database (see check.ts) and the same pair of prices never fires twice.
 */
const g = globalThis as { __luxxAlertHooks?: WeakSet<object>; __luxxAlertSweep?: ReturnType<typeof setInterval> };
const hooked = (g.__luxxAlertHooks ??= new WeakSet<object>());

const SWEEP_MS = 60_000;

function run() {
  checkPriceAlerts().catch((err) => console.error(`[alerts] check failed: ${err instanceof Error ? err.message : String(err)}`));
}

export function registerPriceAlerts(): void {
  if (!hooked.has(onPricesRefreshed)) {
    hooked.add(onPricesRefreshed);
    onPricesRefreshed(async () => run());
  }
  if (!g.__luxxAlertSweep) {
    g.__luxxAlertSweep = setInterval(run, SWEEP_MS);
    // Never keep a process alive just for this.
    g.__luxxAlertSweep.unref?.();
    console.info("[alerts] price-alert checker started");
  }
}

registerPriceAlerts();
