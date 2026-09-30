/**
 * Price-alert rules, kept free of I/O so they can be tested on their own.
 *
 * An alert fires on a *crossing*, never on a level: the price has to move from
 * the far side of the target to the near side between two consecutive price
 * checks. An alert whose target is already met when it is created stays quiet
 * until the price leaves and comes back. After it fires, it rests for twelve
 * hours, so a price that hovers around the target doesn't send a message every
 * minute.
 */
import { purityFromKarat } from "@/lib/market";
import { GOLD_KARATS, METAL_VALUES, type Metal } from "@/config/catalog";

export const ALERT_COOLDOWN_MS = 12 * 3600_000;
export const MAX_ALERTS_PER_USER = 20;
export const ALERT_DIRECTIONS = ["above", "below"] as const;
export type AlertDirection = (typeof ALERT_DIRECTIONS)[number];
export const ALERT_CHANNELS = ["in_app", "email", "viber", "messenger"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];
export const ALERT_KARATS = GOLD_KARATS.map((k) => k.karat);
export { METAL_VALUES };

/**
 * Fraction of the pure-metal price an alert follows. Gold alerts name a karat
 * (24K is quoted at .999, as on /prices); `null` means the pure-metal spot price.
 */
export function alertPurity(metal: Metal | string, karat: number | null): number {
  if (metal === "gold" && karat != null) return purityFromKarat(karat);
  return 1;
}

/** ₱ per gram at the alert's purity, from the pure-metal ₱ per gram. */
export function priceAtPurity(purePhpPerGram: number, metal: Metal | string, karat: number | null): number {
  return purePhpPerGram * alertPurity(metal, karat);
}

/** True when `price` satisfies the alert (at or past the target). */
export function isOnTargetSide(direction: AlertDirection, price: number, target: number): boolean {
  return direction === "above" ? price >= target : price <= target;
}

export type AlertState = {
  direction: AlertDirection;
  target: number;
  createdAt: Date;
  lastTriggeredAt: Date | null;
};

export type PricePoint = { price: number; at: Date };

export type Evaluation =
  | { fire: true }
  | { fire: false; reason: "no-previous" | "not-met" | "no-crossing" | "stale" | "cooldown" | "already-seen" };

/**
 * Should this alert fire for the move from `previous` to `current`?
 *
 * - `current` must meet the target and `previous` must not: a crossing.
 * - `current` must be newer than the alert (a crossing before it existed
 *   isn't news) and newer than its last firing (the same pair of prices is
 *   re-checked when another metal refreshes; it must not fire twice).
 * - Twelve hours must have passed since it last fired.
 */
export function evaluateAlert(alert: AlertState, previous: PricePoint | null, current: PricePoint, now: Date = new Date()): Evaluation {
  if (!isOnTargetSide(alert.direction, current.price, alert.target)) return { fire: false, reason: "not-met" };
  if (!previous) return { fire: false, reason: "no-previous" };
  if (isOnTargetSide(alert.direction, previous.price, alert.target)) return { fire: false, reason: "no-crossing" };
  if (current.at.getTime() <= alert.createdAt.getTime()) return { fire: false, reason: "stale" };
  if (alert.lastTriggeredAt) {
    if (current.at.getTime() <= alert.lastTriggeredAt.getTime()) return { fire: false, reason: "already-seen" };
    if (now.getTime() - alert.lastTriggeredAt.getTime() < ALERT_COOLDOWN_MS) return { fire: false, reason: "cooldown" };
  }
  return { fire: true };
}

/** Signed distance from the current price to the target, as ₱ and % of the current price. */
export function distanceToTarget(current: number, target: number): { php: number; pct: number } {
  const php = target - current;
  return { php, pct: current > 0 ? (php / current) * 100 : 0 };
}

const METAL_NAMES: Record<string, string> = { gold: "Gold", silver: "Silver", platinum: "Platinum", palladium: "Palladium" };

/** "18K gold", "Pure silver". */
export function alertLabel(metal: string, karat: number | null): string {
  const name = METAL_NAMES[metal] ?? metal;
  if (metal === "gold" && karat != null) return `${karat}K gold`;
  return `Pure ${name.toLowerCase()}`;
}

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The message every channel carries when an alert fires. Plain text: it goes to Viber and Messenger as-is. */
export function alertMessage(input: { metal: string; karat: number | null; direction: AlertDirection; target: number; price: number }) {
  const label = alertLabel(input.metal, input.karat);
  const verb = input.direction === "above" ? "rose above" : "fell below";
  return {
    title: `${label} ${verb} ${peso.format(input.target)}/g`,
    body: [
      `${label} is now ${peso.format(input.price)} per gram, past your target of ${peso.format(input.target)}.`,
      "Spot-based melt price at this purity, before any dealer spread. Prices move; check the live board before you buy or sell.",
    ].join("\n"),
  };
}
