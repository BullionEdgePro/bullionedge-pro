/**
 * The protected payment hold for marketplace trades (brief §9).
 *
 * Luxx4less never holds anyone's money. A real adapter uses the payment
 * provider's marketplace / split-payment product, where the provider keeps the
 * buyer's funds and pays the seller out on our release instruction:
 *   - PayMongo: a Payment Intent to the platform account, then a transfer to
 *     the seller's connected (child) account on release.
 *     `[CONFIRM with lawyer and PayMongo: BSP licensing for held funds]`
 *   - Xendit: xenPlatform with a sub-account per seller; hold via the invoice
 *     and release with a transfer, or refund the invoice.
 * Those adapters would return a checkout URL from createHold and confirm the
 * hold later from a signed webhook; the mock confirms immediately.
 */
export type PaymentProviderId = "mock" | "paymongo" | "xendit";

export type HoldRequest = {
  tradeId: string;
  tradeCode: string;
  amountPhp: number;
  buyerId: string;
  sellerId: string;
};

export type HoldResult =
  | { status: "held"; ref: string }
  /** A real provider sends the buyer to pay; the hold is confirmed by webhook. */
  | { status: "redirect"; ref: string; checkoutUrl: string };

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** True when no real money can move (shown to people as "Test mode: no money moves"). */
  readonly testMode: boolean;
  readonly displayName: string;
  createHold(req: HoldRequest): Promise<HoldResult>;
  /** Pay the held amount out to the seller. */
  release(ref: string, amountPhp: number): Promise<void>;
  /** Return the held amount to the buyer. */
  refund(ref: string, amountPhp: number): Promise<void>;
}
