import "server-only";
import { db } from "../db";
import { channelConfig, channelMode, type ExternalChannel } from "./config";

/**
 * Send one plain-text message to a linked Viber user or Messenger PSID.
 * Live mode calls the platform; mock mode writes the message to DevOutbox
 * (viewable at /dev/outbox) and reports success. Returns true only when the
 * platform (or the outbox) accepted it.
 */
export async function sendText(kind: ExternalChannel, to: string, text: string): Promise<boolean> {
  if (channelMode(kind) === "mock") {
    await db.devOutbox.create({ data: { channel: kind, to, text } });
    return true;
  }
  return kind === "viber" ? sendViber(to, text) : sendMessenger(to, text);
}

const TIMEOUT_MS = 8_000;

/** Viber REST bot API. Status 0 is success; 6 means the person hasn't subscribed (or has left). */
async function sendViber(receiver: string, text: string): Promise<boolean> {
  const c = channelConfig();
  try {
    const res = await fetch("https://chatapi.viber.com/pa/send_message", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": c.VIBER_BOT_TOKEN! },
      body: JSON.stringify({ receiver, min_api_version: 1, sender: { name: c.VIBER_SENDER_NAME }, type: "text", text: text.slice(0, 7000) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as { status?: number; status_message?: string } | null;
    if (!res.ok || json?.status !== 0) {
      console.warn(`[channels] Viber send failed: ${res.status} ${json?.status ?? "?"} ${json?.status_message ?? ""}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[channels] Viber send error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Messenger Send API, standard messaging (messaging_type RESPONSE). Only valid
 * within 24 hours of the person's last message to the Page; the caller checks
 * the window first (see deliver.ts) and never sends outside it.
 */
async function sendMessenger(psid: string, text: string): Promise<boolean> {
  const c = channelConfig();
  try {
    const res = await fetch(`https://graph.facebook.com/${c.MESSENGER_GRAPH_VERSION}/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.MESSENGER_PAGE_TOKEN!}` },
      body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: { text: text.slice(0, 2000) } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
      console.warn(`[channels] Messenger send failed: ${res.status} ${json?.error?.code ?? "?"} ${json?.error?.message ?? ""}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[channels] Messenger send error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
