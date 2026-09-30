import "server-only";
import { Resend } from "resend";
import { db } from "../db";
import { env } from "../env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: "resend" | "mock";
  send(message: EmailMessage): Promise<void>;
}

/** Real delivery through Resend. */
class ResendProvider implements EmailProvider {
  readonly name = "resend" as const;
  private client: Resend;
  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.client = new Resend(apiKey);
  }
  async send(m: EmailMessage) {
    const { error } = await this.client.emails.send({ from: this.from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    if (error) throw new Error(`Email delivery failed: ${error.message}`);
  }
}

/** Development and demos: stores mail for the on-site mailbox instead of sending. */
class MockProvider implements EmailProvider {
  readonly name = "mock" as const;
  async send(m: EmailMessage) {
    await db.devEmail.create({ data: m });
  }
}

let provider: EmailProvider | undefined;

export function emailProvider(): EmailProvider {
  if (!provider) {
    const e = env();
    provider = e.EMAIL_PROVIDER === "resend" ? new ResendProvider(e.RESEND_API_KEY!, e.EMAIL_FROM) : new MockProvider();
  }
  return provider;
}

export function isMockEmail(): boolean {
  return env().EMAIL_PROVIDER === "mock";
}
