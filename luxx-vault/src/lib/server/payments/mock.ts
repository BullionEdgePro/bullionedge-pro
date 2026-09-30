import "server-only";
import { randomBytes } from "node:crypto";
import type { HoldRequest, HoldResult, PaymentProvider } from "./types";

/**
 * Development stand-in for the payment provider. It records references so the
 * trade flow can be exercised end to end, and moves no money at all. Every
 * trade screen says so ("Test mode: no money moves").
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock" as const;
  readonly testMode = true;
  readonly displayName = "Test payments";

  async createHold(req: HoldRequest): Promise<HoldResult> {
    if (!(req.amountPhp > 0)) throw new Error("Nothing to hold.");
    return { status: "held", ref: `mock_hold_${req.tradeCode}_${randomBytes(4).toString("hex")}` };
  }

  async release(ref: string): Promise<void> {
    if (!ref.startsWith("mock_hold_")) throw new Error("Unknown test payment reference.");
  }

  async refund(ref: string): Promise<void> {
    if (!ref.startsWith("mock_hold_")) throw new Error("Unknown test payment reference.");
  }
}
