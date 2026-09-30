import "server-only";
import { METAL_VALUES, type Metal } from "@/config/catalog";
import { db } from "../db";
import { notify } from "../notify";
import { ALERT_COOLDOWN_MS, alertMessage, evaluateAlert, priceAtPurity, type AlertDirection } from "./logic";

let running: Promise<number> | null = null;

/**
 * Compare every active alert with the two most recent price snapshots of its
 * metal and notify on a crossing (rules in logic.ts). Runs after each price
 * refresh (see register.ts). Returns how many alerts fired.
 *
 * Firing is claimed atomically (lastTriggeredAt is only set if it is still
 * outside the cooldown), so two servers checking at once can't both send.
 */
export function checkPriceAlerts(): Promise<number> {
  // One pass at a time per process; a refresh that lands mid-pass is covered by the next one.
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<number> {
  const pairs = new Map<Metal, { previous: { price: number; at: Date } | null; current: { price: number; at: Date } }>();
  await Promise.all(
    METAL_VALUES.map(async (metal) => {
      const [current, previous] = await db.priceSnapshot.findMany({
        where: { metal },
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { phpPerGram: true, createdAt: true },
      });
      if (!current) return;
      pairs.set(metal, {
        current: { price: Number(current.phpPerGram), at: current.createdAt },
        previous: previous ? { price: Number(previous.phpPerGram), at: previous.createdAt } : null,
      });
    }),
  );
  if (!pairs.size) return 0;

  const alerts = await db.priceAlert.findMany({ where: { active: true, metal: { in: [...pairs.keys()] } } });
  const now = new Date();
  let fired = 0;

  for (const a of alerts) {
    const pair = pairs.get(a.metal as Metal);
    if (!pair) continue;
    const direction = a.direction as AlertDirection;
    const target = Number(a.targetPhpPerGram);
    const current = { price: priceAtPurity(pair.current.price, a.metal, a.karat), at: pair.current.at };
    const previous = pair.previous && { price: priceAtPurity(pair.previous.price, a.metal, a.karat), at: pair.previous.at };
    const verdict = evaluateAlert({ direction, target, createdAt: a.createdAt, lastTriggeredAt: a.lastTriggeredAt }, previous, current, now);
    if (!verdict.fire) continue;

    const claimed = await db.priceAlert.updateMany({
      where: {
        id: a.id,
        active: true,
        OR: [{ lastTriggeredAt: null }, { lastTriggeredAt: { lt: new Date(now.getTime() - ALERT_COOLDOWN_MS) } }],
      },
      data: { lastTriggeredAt: now },
    });
    if (claimed.count !== 1) continue;

    const message = alertMessage({ metal: a.metal, karat: a.karat, direction, target, price: current.price });
    const channels = a.channels.filter((c): c is "email" | "viber" | "messenger" => c === "email" || c === "viber" || c === "messenger");
    try {
      await notify(a.userId, { kind: "price_alert", title: message.title, body: message.body, href: "/prices", channels });
      fired++;
    } catch (err) {
      console.error(`[alerts] notify failed for alert ${a.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (fired) console.info(`[alerts] ${fired} price alert${fired === 1 ? "" : "s"} fired`);
  return fired;
}
