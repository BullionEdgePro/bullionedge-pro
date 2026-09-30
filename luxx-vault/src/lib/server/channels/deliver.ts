import "server-only";
import { render } from "@react-email/components";
import { createElement } from "react";
import { db } from "../db";
import { emailProvider } from "../email/provider";
import { PriceAlertEmail } from "../email/templates/price-alert";
import { env } from "../env";
import type { NotifyInput } from "../notify";
import { channelMode, type ExternalChannel } from "./config";
import { sendText } from "./adapters";
import { lastInboundAt } from "./link";
import { withinMessengerWindow } from "./signature";

type Channel = "email" | "viber" | "messenger";

/**
 * External delivery (email, Viber, Messenger) for notifications. Called by
 * notify(); returns the channels that actually delivered.
 *
 * - Email goes through the site's email provider (Resend, or the test mailbox).
 * - Viber and Messenger go to the person's linked account (or, in mock mode,
 *   to the DevOutbox table shown at /dev/outbox).
 * - Messenger is only used inside Meta's 24-hour standard-messaging window
 *   (24 h since the person last wrote to the Page). Outside it we don't send on
 *   Messenger at all: price alerts fit none of Meta's message tags.
 * - If a requested Viber or Messenger message can't go out (not linked, outside
 *   the window, or the platform refused it), the message falls back to email,
 *   so the person still hears about it. At most one email is sent.
 *
 * Every channel is tried independently; a failure never throws.
 */
export async function deliverExternal(userId: string, input: NotifyInput, channels: Channel[]): Promise<string[]> {
  const wanted = new Set(channels);
  const delivered: string[] = [];
  let needEmail = wanted.has("email");

  for (const kind of ["viber", "messenger"] as const) {
    if (!wanted.has(kind)) continue;
    const ok = await tryChannel(userId, kind, input).catch((err) => {
      console.warn(`[channels] ${kind} delivery error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    });
    if (ok) delivered.push(kind);
    else needEmail = true;
  }

  if (needEmail) {
    const ok = await sendEmail(userId, input).catch((err) => {
      console.warn(`[channels] email delivery error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    });
    if (ok) delivered.push("email");
  }
  return delivered;
}

function textFor(input: NotifyInput): string {
  const base = env().BETTER_AUTH_URL.replace(/\/$/, "");
  const link = input.href ? `${base}${input.href}` : base;
  return `${input.title}\n\n${input.body}\n\n${link}`;
}

async function tryChannel(userId: string, kind: ExternalChannel, input: NotifyInput): Promise<boolean> {
  const row = await db.notificationChannel.findUnique({ where: { userId_kind: { userId, kind } } });
  if (!row?.externalId || !row.linkedAt) return false;
  if (kind === "messenger" && channelMode("messenger") === "live") {
    if (!withinMessengerWindow(await lastInboundAt("messenger", row.externalId))) return false;
  }
  return sendText(kind, row.externalId, textFor(input));
}

async function sendEmail(userId: string, input: NotifyInput): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, emailVerified: true } });
  if (!user?.emailVerified) return false;
  const baseUrl = env().BETTER_AUTH_URL.replace(/\/$/, "");
  const isAlert = input.kind === "price_alert";
  // createElement rather than JSX keeps this file a .ts module (notify.ts imports it by that name).
  const element = createElement(PriceAlertEmail, {
    name: user.name.split(" ")[0] || user.name,
    title: input.title,
    body: input.body,
    href: input.href,
    baseUrl,
    kicker: isAlert ? "Price alert" : "Luxx4less",
    footnote: isAlert ? undefined : "You're receiving this because of activity on your Luxx4less account. Manage notifications in your account.",
  });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  await emailProvider().send({ to: user.email, subject: input.title, html, text });
  return true;
}
