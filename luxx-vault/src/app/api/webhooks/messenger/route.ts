import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { sendText } from "@/lib/server/channels/adapters";
import { channelConfig, channelMode } from "@/lib/server/channels/config";
import { completeLink, recordInbound } from "@/lib/server/channels/link";
import { isLinkCode, verifyMetaSignature } from "@/lib/server/channels/signature";

export const dynamic = "force-dynamic";

/**
 * Messenger Platform webhook for the Luxx4less Page.
 *
 * GET: Meta's subscription check (hub.verify_token must match MESSENGER_VERIFY_TOKEN).
 * POST: every delivery is signed with the app secret (X-Hub-Signature-256),
 * checked in constant time over the raw body before parsing.
 *
 * Linking: the "Connect Messenger" link is m.me/<page>?ref=<one-time code>.
 * Meta returns the ref as a `referral` (existing thread), inside a `postback`
 * (Get Started on a new thread) or as an `optin`. Any message, postback,
 * referral or opt-in from a person also opens Meta's 24-hour standard
 * messaging window, so we record when it happened (see deliver.ts).
 */
function sameSecret(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { MESSENGER_VERIFY_TOKEN } = channelConfig();
  if (url.searchParams.get("hub.mode") === "subscribe" && sameSecret(url.searchParams.get("hub.verify_token"), MESSENGER_VERIFY_TOKEN)) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

const refSchema = z.object({ ref: z.string().max(256).optional() }).partial();
const eventSchema = z.object({
  sender: z.object({ id: z.string().min(1).max(64) }),
  timestamp: z.number().optional(),
  message: z.object({ is_echo: z.boolean().optional() }).passthrough().optional(),
  postback: z.object({ referral: refSchema.optional() }).passthrough().optional(),
  referral: refSchema.optional(),
  optin: refSchema.optional(),
});
const bodySchema = z.object({
  object: z.string(),
  entry: z.array(z.object({ messaging: z.array(z.unknown()).optional() })).default([]),
});

export async function POST(request: Request) {
  if (channelMode("messenger") !== "live") return new Response("Not found", { status: 404 });
  const { MESSENGER_APP_SECRET } = channelConfig();

  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), MESSENGER_APP_SECRET!)) {
    return new Response("Bad signature", { status: 401 });
  }

  let body;
  try {
    body = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (!body.success || body.data.object !== "page") return new Response("EVENT_RECEIVED");

  for (const entry of body.data.entry) {
    for (const item of entry.messaging ?? []) {
      const parsed = eventSchema.safeParse(item);
      if (!parsed.success) continue;
      const e = parsed.data;
      if (e.message?.is_echo) continue; // our own outgoing messages
      const psid = e.sender.id;
      await recordInbound("messenger", psid, e.timestamp ? new Date(e.timestamp) : new Date());

      const ref = e.referral?.ref ?? e.postback?.referral?.ref ?? e.optin?.ref;
      if (isLinkCode(ref)) {
        const userId = await completeLink("messenger", ref, psid);
        await sendText(
          "messenger",
          psid,
          userId
            ? "Your Luxx4less account is connected. Price alerts will arrive here while this chat is active (Meta allows messages for 24 hours after you last write to us); otherwise we'll email you."
            : "That connect link has expired or was already used. Open Price alerts on Luxx4less and press “Connect Messenger” again.",
        );
      }
    }
  }
  // Meta expects a quick 200 for every delivery.
  return new Response("EVENT_RECEIVED");
}
