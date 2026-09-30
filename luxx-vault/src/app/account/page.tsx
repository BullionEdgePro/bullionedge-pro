import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, Smartphone, UserRoundCheck } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { Badge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { parseRoles, verificationTier } from "@/config/roles";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Your account" };

const NEXT_STEPS = [
  { tier: 2, icon: Smartphone, title: "Verify your mobile number", body: "Unlocks checkout and messaging. Coming with ID verification.", done: false },
  { tier: 3, icon: UserRoundCheck, title: "Verify your identity", body: "A government ID and a quick selfie. Required to buy or sell on the marketplace.", done: false },
];

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  // A bad or expired email link lands here with ?error=… from the auth server.
  if (params.error) redirect(`/verify-email?error=${encodeURIComponent(params.error)}`);
  const { user } = await requireSession("/account");
  const tier = verificationTier({ signedIn: true, emailVerified: user.emailVerified });
  const roles = parseRoles(user.role);

  return (
    <div className="grid gap-6">
      {params.welcome && (
        <Card className="surface-velvet overflow-hidden">
          <CardBody className="flex flex-col items-center gap-4 py-10 text-center sm:flex-row sm:text-left">
            <Emblem animate title="" className="size-24 shrink-0" />
            <div>
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-success sm:justify-start">
                <CheckCircle2 className="size-4" aria-hidden /> Email confirmed
              </p>
              <h1 className="mt-1 text-3xl">Welcome to Luxx4less, {user.name.split(" ")[0]}</h1>
              <p className="mt-2 text-muted">Your account is ready. Real gold, verified people.</p>
            </div>
          </CardBody>
        </Card>
      )}

      {!params.welcome && <h1 className="text-3xl">Your account</h1>}

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="truncate text-muted">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <TierBadge tier={tier} />
              {roles.map((r) => (
                <Badge key={r} tone={r === "buyer" ? "neutral" : "gold"}>
                  {r.replace("_", " ")}
                </Badge>
              ))}
              {user.twoFactorEnabled ? (
                <Badge tone="success" icon={<ShieldCheck aria-hidden />}>
                  Two-step sign-in on
                </Badge>
              ) : (
                <Badge tone="warning">Two-step sign-in off</Badge>
              )}
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href="/account/security">Security settings</Link>
          </Button>
        </CardBody>
      </Card>

      <section aria-labelledby="next-title" className="grid gap-3">
        <h2 id="next-title" className="font-sans text-lg font-semibold">
          Next verification steps
        </h2>
        <p className="text-sm text-muted">Each step unlocks more of Luxx4less. Identity checks arrive in a later update.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {NEXT_STEPS.map((s) => (
            <Card key={s.tier}>
              <CardBody className="flex gap-4">
                <s.icon className="size-6 shrink-0 text-ice-deep dark:text-ice" aria-hidden />
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
