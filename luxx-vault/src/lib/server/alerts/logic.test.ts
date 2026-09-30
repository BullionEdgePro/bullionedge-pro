import { describe, expect, it } from "vitest";
import { ALERT_COOLDOWN_MS, alertMessage, alertPurity, distanceToTarget, evaluateAlert, priceAtPurity, type AlertState } from "./logic";
import { createAlertSchema } from "./schema";

const t0 = new Date("2026-09-30T00:00:00Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

function alert(over: Partial<AlertState> = {}): AlertState {
  return { direction: "above", target: 8000, createdAt: t0, lastTriggeredAt: null, ...over };
}

describe("evaluateAlert", () => {
  it("fires when the price crosses up through an 'above' target", () => {
    expect(evaluateAlert(alert(), { price: 7990, at: at(5) }, { price: 8001, at: at(6) }, at(6))).toEqual({ fire: true });
  });

  it("treats landing exactly on the target as crossing it", () => {
    expect(evaluateAlert(alert(), { price: 7999.99, at: at(5) }, { price: 8000, at: at(6) }, at(6)).fire).toBe(true);
  });

  it("fires when the price crosses down through a 'below' target", () => {
    const a = alert({ direction: "below", target: 7500 });
    expect(evaluateAlert(a, { price: 7510, at: at(5) }, { price: 7490, at: at(6) }, at(6)).fire).toBe(true);
  });

  it("does not fire while the price stays past the target (no crossing)", () => {
    expect(evaluateAlert(alert(), { price: 8100, at: at(5) }, { price: 8200, at: at(6) }, at(6))).toEqual({ fire: false, reason: "no-crossing" });
  });

  it("does not fire when the target is not met", () => {
    expect(evaluateAlert(alert(), { price: 7000, at: at(5) }, { price: 7999, at: at(6) }, at(6))).toEqual({ fire: false, reason: "not-met" });
  });

  it("does not fire moving the wrong way through the target", () => {
    expect(evaluateAlert(alert(), { price: 8100, at: at(5) }, { price: 7900, at: at(6) }, at(6)).fire).toBe(false);
  });

  it("needs a previous price to know a crossing happened", () => {
    expect(evaluateAlert(alert(), null, { price: 8100, at: at(6) }, at(6))).toEqual({ fire: false, reason: "no-previous" });
  });

  it("ignores a crossing that happened before the alert was created", () => {
    const a = alert({ createdAt: at(10) });
    expect(evaluateAlert(a, { price: 7990, at: at(5) }, { price: 8010, at: at(6) }, at(11))).toEqual({ fire: false, reason: "stale" });
  });

  it("never fires twice for the same pair of prices", () => {
    const a = alert({ lastTriggeredAt: at(7) });
    const later = new Date(at(7).getTime() + ALERT_COOLDOWN_MS + 1);
    expect(evaluateAlert(a, { price: 7990, at: at(5) }, { price: 8010, at: at(6) }, later)).toEqual({ fire: false, reason: "already-seen" });
  });

  it("rests for 12 hours after firing, even on a fresh crossing", () => {
    const a = alert({ lastTriggeredAt: at(0) });
    const within = at(11 * 60);
    expect(evaluateAlert(a, { price: 7990, at: at(11 * 60 - 1) }, { price: 8010, at: within }, within)).toEqual({ fire: false, reason: "cooldown" });
  });

  it("re-arms after the cooldown when the price comes back across", () => {
    const a = alert({ lastTriggeredAt: at(0) });
    const after = at(12 * 60 + 1);
    expect(evaluateAlert(a, { price: 7990, at: at(12 * 60) }, { price: 8010, at: after }, after).fire).toBe(true);
  });
});

describe("purity", () => {
  it("follows the market fineness table for gold karats", () => {
    expect(alertPurity("gold", 24)).toBe(0.999);
    expect(alertPurity("gold", 18)).toBe(0.75);
    expect(alertPurity("gold", 6)).toBe(0.25);
    expect(priceAtPurity(8000, "gold", 22)).toBeCloseTo(7328);
  });

  it("uses the pure-metal price when no karat is given, and for other metals", () => {
    expect(alertPurity("gold", null)).toBe(1);
    expect(alertPurity("silver", 18)).toBe(1);
  });
});

describe("distanceToTarget", () => {
  it("is signed: positive when the target is above the price", () => {
    expect(distanceToTarget(8000, 8400)).toEqual({ php: 400, pct: 5 });
    expect(distanceToTarget(8000, 7600)).toEqual({ php: -400, pct: -5 });
  });
});

describe("alertMessage", () => {
  it("names the karat, the direction and both prices", () => {
    const m = alertMessage({ metal: "gold", karat: 18, direction: "below", target: 5000, price: 4990.5 });
    expect(m.title).toBe("18K gold fell below ₱5,000.00/g");
    expect(m.body).toContain("₱4,990.50 per gram");
  });
});

describe("createAlertSchema", () => {
  const base = { metal: "gold", karat: "18", direction: "above", target: "₱5,250.50", channels: ["email"] };

  it("parses a gold karat alert and always includes the in-app channel", () => {
    expect(createAlertSchema.parse(base)).toEqual({ metal: "gold", karat: 18, direction: "above", target: 5250.5, channels: ["in_app", "email"] });
  });

  it("accepts pure metal", () => {
    expect(createAlertSchema.parse({ ...base, metal: "silver", karat: "pure" }).karat).toBeNull();
  });

  it("rejects a karat on a metal other than gold, and unknown karats", () => {
    expect(createAlertSchema.safeParse({ ...base, metal: "silver" }).success).toBe(false);
    expect(createAlertSchema.safeParse({ ...base, karat: "23" }).success).toBe(false);
  });

  it("rejects non-positive, absurd or over-precise targets and unknown channels", () => {
    expect(createAlertSchema.safeParse({ ...base, target: "0" }).success).toBe(false);
    expect(createAlertSchema.safeParse({ ...base, target: "abc" }).success).toBe(false);
    expect(createAlertSchema.safeParse({ ...base, target: "99999999" }).success).toBe(false);
    expect(createAlertSchema.safeParse({ ...base, target: "10.001" }).success).toBe(false);
    expect(createAlertSchema.safeParse({ ...base, channels: ["sms"] }).success).toBe(false);
  });
});
