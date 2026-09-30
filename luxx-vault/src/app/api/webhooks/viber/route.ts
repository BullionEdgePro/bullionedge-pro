import { z } from "zod";
import { channelConfig, channelMode } from "@/lib/server/channels/config";
import { completeLink, recordInbound, unlinkByExternalId } from "@/lib/server/channels/link";
import { isLinkCode, verifyViberSignature } from "@/lib/server/channels/signature";

export const dynamic = "force-dynamic";

/**
 * Viber bot webhook (register it with set_webhook pointing here).
 *
 * Every request is signed: X-Viber-Content-Signature is the hex HMAC-SHA256
 * of the raw body keyed with the bot token, checked in constant time before
 * anything is parsed. Linking: the "Connect Viber" deep link carries a one-time
 * code as `context`, which Viber hands back on conversation_started.
 */
const eventSchema = z.object({
  event: z.string(),
  timestamp: z.number().optional(),
  context: z.string().optional(),
  user: z.object({ id: z.string().min(1).max(128) }).partial().optional(),
  sender: z.object({ id: z.string().min(1).max(128) }).partial().optional(),
  user_id: z.string().min(1).max(128).optional(),
});

export async function POST(request: Request) {
  if (channelMode("viber") !== "live") return new Response("Not found", { status: 404 });
  const { VIBER_BOT_TOKEN, VIBER_SENDER_NAME } = channelConfig();

  const raw = await request.text();
  if (!verifyViberSignature(raw, request.headers.get("x-viber-content-signature"), VIBER_BOT_TOKEN!)) {
    return new Response("Bad signature", { status: 401 });
  }

  let parsed;
  try {
    parsed = eventSchema.safeParse(JSON.parse(raw));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (!parsed.success) return Response.json({ status: 0 });
  const e = parsed.data;
  const at = e.timestamp ? new Date(e.timestamp) : new Date();

  switch (e.event) {
    case "conversation_started": {
      const id = e.user?.id;
      if (!id) break;
      const userId = isLinkCode(e.context) ? await completeLink("viber", e.context, id) : null;
      // The reply to conversation_started is Viber's one allowed "welcome message".
      return Response.json({
        sender: { name: VIBER_SENDER_NAME },
        type: "text",
        text: userId
          ? "Your Luxx4less account is connected. Send any message (for example “Hi”) to subscribe, and your price alerts will arrive here."
          : "Welcome to Luxx4less. To get price alerts here, press “Connect Viber” on your Price alerts page at Luxx4less, signed in.",
      });
    }
    case "subscribed": {
      const id = e.user?.id;
      if (id && isLinkCode(e.context)) await completeLink("viber", e.context, id);
      if (id) await recordInbound("viber", id, at);
      break;
    }
    case "message": {
      if (e.sender?.id) await recordInbound("viber", e.sender.id, at);
      break;
    }
    case "unsubscribed": {
      if (e.user_id) await unlinkByExternalId("viber", e.user_id, "unsubscribed in Viber");
      break;
    }
    // "webhook" (the set_webhook check), "delivered", "seen", "failed": acknowledge only.
  }
  return Response.json({ status: 0 });
}
