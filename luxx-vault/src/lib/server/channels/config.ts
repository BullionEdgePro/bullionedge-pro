import "server-only";
import { z } from "zod";

/**
 * Viber and Messenger settings, validated once with zod. Kept here rather than
 * in lib/server/env.ts so the channel adapters own their configuration.
 *
 * Each channel runs "live" only when every setting it needs is present and
 * CHANNELS_MODE isn't forced to "mock". Otherwise it runs in mock mode: the
 * "Connect" button links instantly to a test id, and messages are written to
 * the DevOutbox table (/dev/outbox) instead of being sent.
 */
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  /** auto (default): live where configured, mock elsewhere. mock: never send for real. */
  CHANNELS_MODE: z.enum(["auto", "mock"]).default("auto"),
  /** Viber bot authentication token (Viber Admin Panel → bot → token). Also the webhook signing key. */
  VIBER_BOT_TOKEN: optional,
  /** The bot's public URI, used in viber://pa?chatURI=… deep links. */
  VIBER_BOT_URI: optional,
  /** Sender name shown on Viber messages (max 28 characters). */
  VIBER_SENDER_NAME: z.string().trim().max(28).default("Luxx4less"),
  /** Facebook Page access token with pages_messaging. */
  MESSENGER_PAGE_TOKEN: optional,
  /** Meta app secret: verifies X-Hub-Signature-256 on webhook POSTs. */
  MESSENGER_APP_SECRET: optional,
  /** Any string you choose; Meta echoes it when you subscribe the webhook. */
  MESSENGER_VERIFY_TOKEN: optional,
  /** The Page's username, used in https://m.me/<username>?ref=… links. */
  MESSENGER_PAGE_USERNAME: optional,
  /** Graph API version for the Send API. */
  MESSENGER_GRAPH_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v23.0"),
});

export type ChannelConfig = z.infer<typeof schema>;

let cached: ChannelConfig | undefined;

export function channelConfig(): ChannelConfig {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid channel settings:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export type ExternalChannel = "viber" | "messenger";

/** "live" sends through the platform; "mock" writes to the test outbox. */
export function channelMode(kind: ExternalChannel): "live" | "mock" {
  const c = channelConfig();
  if (c.CHANNELS_MODE === "mock") return "mock";
  if (kind === "viber") return c.VIBER_BOT_TOKEN && c.VIBER_BOT_URI ? "live" : "mock";
  return c.MESSENGER_PAGE_TOKEN && c.MESSENGER_APP_SECRET && c.MESSENGER_PAGE_USERNAME ? "live" : "mock";
}

export function anyChannelMocked(): boolean {
  return channelMode("viber") === "mock" || channelMode("messenger") === "mock";
}
