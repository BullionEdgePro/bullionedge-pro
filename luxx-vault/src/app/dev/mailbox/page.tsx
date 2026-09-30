import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { Emblem } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";

export const metadata: Metadata = { title: "Test mailbox", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function keyMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The main action link of an email (confirm / reset), so testers can click straight through. */
function actionLink(html: string): string | null {
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
  return links.find((l) => /verify-email|reset-password|\/account/.test(l)) ?? null;
}

/**
 * Test-mode inbox. Exists only while EMAIL_PROVIDER=mock. On a public
 * deployment it also needs ?key=<MAILBOX_KEY>, because it shows every
 * user's confirmation and reset links.
 */
export default async function MailboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const e = env();
  if (e.EMAIL_PROVIDER !== "mock") notFound();
  const params = await searchParams;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(e.BETTER_AUTH_URL);
  if (!local && !keyMatches(params.key, e.MAILBOX_KEY)) notFound();

  const to = params.to?.trim().toLowerCase();
  const emails = await db.devEmail.findMany({ where: to ? { to } : undefined, orderBy: { createdAt: "desc" }, take: 30 });

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-10">
      <div className="flex items-center gap-4">
        <Emblem title="" className="size-12" />
        <div>
          <h1 className="text-3xl">Test mailbox</h1>
          <p className="text-sm text-muted">Emails the site would have sent. Real delivery starts once a Resend key is added.</p>
        </div>
        <Badge tone="warning" className="ml-auto">Test email mode</Badge>
      </div>
      <form className="flex gap-2" action="">
        {params.key && <input type="hidden" name="key" value={params.key} />}
        <label htmlFor="to" className="sr-only">Filter by recipient</label>
        <input id="to" name="to" defaultValue={to} placeholder="Filter by email address" className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
        <button className="rounded-lg border border-line px-4 text-sm font-semibold">Filter</button>
      </form>
      {emails.length === 0 && <p className="text-muted">No emails yet.</p>}
      <ul className="grid gap-4">
        {emails.map((m) => {
          const link = actionLink(m.html);
          return (
            <li key={m.id}>
              <Card>
                <CardBody className="grid gap-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold" data-testid="mail-subject">{m.subject}</p>
                    <p className="text-xs text-muted">{m.createdAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
                  </div>
                  <p className="text-sm text-muted">To: <span data-testid="mail-to">{m.to}</span></p>
                  {link && (
                    <a href={link} data-testid="mail-action" className="w-fit rounded-lg bg-gold-metal px-4 py-2 text-sm font-semibold text-velvet">
                      Open the link in this email
                    </a>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-gold">Show the email</summary>
                    <iframe title={m.subject} srcDoc={m.html} sandbox="" className="mt-3 h-[640px] w-full rounded-lg border border-line bg-white" />
                  </details>
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
