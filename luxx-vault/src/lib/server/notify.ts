import "server-only";
import { db } from "./db";
import { deliverExternal } from "./channels/deliver";

export type NotificationKind =
  | "offer_received"
  | "offer_accepted"
  | "offer_declined"
  | "message"
  | "trade_update"
  | "price_alert"
  | "kyc_update"
  | "review"
  | "request_match";

export type NotifyInput = {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Site-relative link, e.g. /account/offers. */
  href?: string;
  /** External channels to try in addition to the in-app feed. Defaults to none. */
  channels?: ("email" | "viber" | "messenger")[];
};

/**
 * Tell someone something happened. Always lands in the in-app feed (bell);
 * email, Viber and Messenger are attempted when asked for and linked. A failed
 * external delivery never fails the action that caused it.
 */
export async function notify(userId: string, input: NotifyInput): Promise<void> {
  const deliveredVia = ["in_app"];
  if (input.channels?.length) {
    try {
      deliveredVia.push(...(await deliverExternal(userId, input, input.channels)));
    } catch {
      // logged by the channel adapters; the in-app notice still goes out
    }
  }
  await db.notification.create({
    data: { userId, kind: input.kind, title: input.title, body: input.body, href: input.href, deliveredVia },
  });
}
