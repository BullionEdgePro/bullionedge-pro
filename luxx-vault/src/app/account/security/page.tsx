import type { Metadata } from "next";
import { headers } from "next/headers";
import { FormAlert } from "@/components/ui/field";
import { auth } from "@/lib/server/auth";
import { requireSession } from "@/lib/server/session";
import { PasskeysSection, PasswordSection, SessionsSection, TwoFactorSection } from "./sections";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { user, session } = await requireSession("/account/security");
  const h = await headers();
  const [sessions, passkeys] = await Promise.all([auth.api.listSessions({ headers: h }), auth.api.listPasskeys({ headers: h })]);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Security</h1>
        <p className="mt-2 text-muted">Protect your account and the gold in it. We email you whenever something here changes.</p>
      </div>
      {params.require2fa && <FormAlert tone="info">Your role needs two-step sign-in. Turn it on below to continue.</FormAlert>}
      <TwoFactorSection enabled={!!user.twoFactorEnabled} />
      <PasskeysSection items={passkeys.map((p) => ({ id: p.id, name: p.name ?? null, createdAt: p.createdAt ?? null }))} />
      <SessionsSection
        currentToken={session.token}
        items={sessions
          .map((s) => ({ id: s.id, token: s.token, userAgent: s.userAgent ?? null, ipAddress: s.ipAddress ?? null, updatedAt: s.updatedAt }))
          .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))}
      />
      <PasswordSection />
    </div>
  );
}
