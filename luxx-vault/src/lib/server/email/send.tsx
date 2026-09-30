import "server-only";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { env } from "../env";
import { emailProvider } from "./provider";
import { ResetPassword } from "./templates/reset-password";
import { SecurityAlert } from "./templates/security-alert";
import { VerifyEmail } from "./templates/verify-email";

async function deliver(to: string, subject: string, element: ReactElement) {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  await emailProvider().send({ to, subject, html, text });
}

const base = () => env().BETTER_AUTH_URL.replace(/\/$/, "");

export function sendVerificationEmail(to: string, name: string, url: string) {
  return deliver(to, "Confirm your email for Luxx4less", <VerifyEmail name={name} url={url} baseUrl={base()} />);
}

export function sendPasswordResetEmail(to: string, name: string, url: string) {
  return deliver(to, "Reset your Luxx4less password", <ResetPassword name={name} url={url} baseUrl={base()} />);
}

export function sendSecurityAlert(to: string, name: string, title: string, lines: string[]) {
  return deliver(to, title, <SecurityAlert name={name} title={title} lines={lines} baseUrl={base()} />);
}
