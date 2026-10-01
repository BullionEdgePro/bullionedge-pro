import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
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
  readonly name: "resend" | "smtp" | "mock";
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

/**
 * Real delivery through an SMTP account: Gmail with an app password today
 * (info.luxx4lessph@gmail.com, owner's choice, 1 Oct 2026). Gmail sends as the
 * signed-in account, so EMAIL_FROM must use that address. Free Gmail allows
 * about 500 messages a day; move to Resend with the shop's own domain past that.
 */
class SmtpProvider implements EmailProvider {
  readonly name = "smtp" as const;
  private transport: Transporter;
  constructor(
    opts: { host: string; port: number; user: string; pass: string },
    private from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.port === 465,
      auth: { user: opts.user, pass: opts.pass },
    });
  }
  async send(m: EmailMessage) {
    try {
      await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    } catch (err) {
      throw new Error(`Email delivery failed: ${err instanceof Error ? err.message : String(err)}`);
    }
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
    provider =
      e.EMAIL_PROVIDER === "resend"
        ? new ResendProvider(e.RESEND_API_KEY!, e.EMAIL_FROM)
        : e.EMAIL_PROVIDER === "smtp"
          ? new SmtpProvider({ host: e.SMTP_HOST, port: e.SMTP_PORT, user: e.SMTP_USER!, pass: e.SMTP_PASSWORD! }, e.EMAIL_FROM)
          : new MockProvider();
  }
  return provider;
}

export function isMockEmail(): boolean {
  return env().EMAIL_PROVIDER === "mock";
}
