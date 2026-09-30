import "server-only";
import { z } from "zod";
import { db } from "../db";

/**
 * SMS delivery behind one interface (brief §0: real vendor adapter plus a
 * clearly labelled mock). Settings are read here, not in env.ts:
 *
 *   SMS_PROVIDER                  mock (default) | semaphore
 *   SEMAPHORE_API_KEY             required when SMS_PROVIDER=semaphore
 *   SEMAPHORE_SENDER_NAME         registered sender name (optional; Semaphore's default otherwise)
 *   ALLOW_MOCK_SMS_IN_PRODUCTION  "true" to allow the mock on a public deployment (demos only:
 *                                 the mock shows the code on screen)
 */

export interface SmsProvider {
  readonly name: "mock" | "semaphore";
  /** True when nothing reaches a real phone and the UI must say so. */
  readonly isTest: boolean;
  send(toE164: string, text: string): Promise<{ ref: string | null }>;
}

const settingsSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SMS_PROVIDER: z.enum(["mock", "semaphore"]).default("mock"),
    SEMAPHORE_API_KEY: z.string().min(8).optional(),
    SEMAPHORE_SENDER_NAME: z.string().min(1).max(11).optional(),
    ALLOW_MOCK_SMS_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
    BETTER_AUTH_URL: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.SMS_PROVIDER === "semaphore" && !s.SEMAPHORE_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["SEMAPHORE_API_KEY"], message: "Required when SMS_PROVIDER=semaphore" });
    }
    const isPublic = s.NODE_ENV === "production" && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(s.BETTER_AUTH_URL ?? "");
    if (isPublic && s.SMS_PROVIDER === "mock" && s.ALLOW_MOCK_SMS_IN_PRODUCTION !== "true") {
      ctx.addIssue({ code: "custom", path: ["SMS_PROVIDER"], message: "Mock SMS on a public deployment needs ALLOW_MOCK_SMS_IN_PRODUCTION=true" });
    }
  });

type SmsSettings = z.infer<typeof settingsSchema>;
let cached: SmsSettings | undefined;

export function smsSettings(): SmsSettings {
  if (!cached) {
    const parsed = settingsSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid SMS settings:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Writes the message to the dev outbox instead of sending it. */
class MockSmsProvider implements SmsProvider {
  readonly name = "mock" as const;
  readonly isTest = true;
  async send(toE164: string, text: string) {
    const row = await db.devOutbox.create({ data: { channel: "sms", to: toE164, text } });
    return { ref: row.id };
  }
}

/**
 * Semaphore (semaphore.co), the common PH SMS gateway. Uses the priority
 * route, which skips the bulk queue: a code that arrives after it expires is
 * no code at all. Numbers go out as 639XXXXXXXXX.
 */
class SemaphoreSmsProvider implements SmsProvider {
  readonly name = "semaphore" as const;
  readonly isTest = false;
  constructor(
    private readonly apiKey: string,
    private readonly senderName?: string,
  ) {}

  async send(toE164: string, text: string) {
    const body = new URLSearchParams({ apikey: this.apiKey, number: toE164.replace(/^\+/, ""), message: text });
    if (this.senderName) body.set("sendername", this.senderName);
    const res = await fetch("https://api.semaphore.co/api/v4/priority", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Semaphore rejected the message (HTTP ${res.status}).`);
    // Success is an array of message objects; validation errors come back as an object keyed by field.
    const first = Array.isArray(payload) ? (payload[0] as { message_id?: number | string; status?: string } | undefined) : undefined;
    if (!first) throw new Error("Semaphore did not accept the message.");
    if (first.status && /fail|refund/i.test(first.status)) throw new Error(`Semaphore reported the message as ${first.status}.`);
    return { ref: first.message_id != null ? String(first.message_id) : null };
  }
}

let provider: SmsProvider | undefined;

export function smsProvider(): SmsProvider {
  if (!provider) {
    const s = smsSettings();
    provider = s.SMS_PROVIDER === "semaphore" ? new SemaphoreSmsProvider(s.SEMAPHORE_API_KEY!, s.SEMAPHORE_SENDER_NAME) : new MockSmsProvider();
  }
  return provider;
}
