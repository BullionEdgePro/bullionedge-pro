import "server-only";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type { PaymentProvider, PaymentProviderId, HoldRequest, HoldResult } from "./types";

let provider: PaymentProvider | null = null;

/**
 * The active payment provider. Only the mock exists today; a PayMongo or
 * Xendit adapter (see types.ts) plugs in here, chosen by an env setting such
 * as PAYMENTS_PROVIDER, with its keys in the environment.
 */
export function payments(): PaymentProvider {
  provider ??= new MockPaymentProvider();
  return provider;
}

/** Providers by id, for releasing or refunding a trade opened under a given provider. */
export function paymentsFor(id: string): PaymentProvider {
  const p = payments();
  if (p.id !== id) throw new Error(`Payment provider "${id}" is not configured.`);
  return p;
}
