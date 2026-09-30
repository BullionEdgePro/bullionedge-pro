import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Globe } from "lucide-react";
import { ProfileForm } from "@/components/profile/profile-form";
import { TierBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { suggestHandle } from "@/lib/server/profile";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Profile" };

const PUBLIC_FIELDS = ["Handle and display name", "Bio", "City and province", "Business name", "Specialisations and testing tools", "Years of experience", "Verification tier badge"];
const PRIVATE_FIELDS = ["Mobile number", "Email address", "ID details and selfie check", "Payout account", "Street address"];

export default async function ProfilePage() {
  const viewer = await requireViewer("/account/profile");
  const p = viewer.profile;
  // No profile yet: suggest a handle without creating anything; saving creates it.
  const initial = {
    handle: p?.handle ?? (await suggestHandle(viewer.name, viewer.userId)),
    displayName: p?.displayName ?? viewer.name,
    bio: p?.bio ?? "",
    regionCode: p?.regionCode ?? "",
    provinceCode: p?.provinceCode ?? "",
    cityCode: p?.cityCode ?? "",
    businessName: p?.businessName ?? "",
    specializations: p?.specializations ?? [],
    tools: p?.tools ?? [],
    yearsExperience: p?.yearsExperience ?? null,
  };

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl sm:text-4xl">Profile</h1>
        <p className="measure text-muted">How other members see you on Luxx4less. A clear, honest profile is the first thing a careful buyer looks for.</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <TierBadge tier={viewer.tier} />
          {p && (
            <Link href={`/sellers/${p.handle}`} className="text-sm text-gold underline-offset-4 hover:underline">
              View your showroom
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
        <Card>
          <CardBody className="sm:p-8">
            <ProfileForm initial={initial} isNew={!p} />
          </CardBody>
        </Card>

        <aside className="grid gap-4 xl:sticky xl:top-28">
          <Card className="surface-velvet">
            <CardBody className="grid gap-4">
              <p className="flex items-center gap-2 font-display text-lg text-champagne">
                <Globe className="size-4" aria-hidden /> Public
              </p>
              <p className="text-sm text-muted">
                Shown on your showroom at <span className="tabular text-fg">/sellers/{p?.handle ?? initial.handle}</span>, beside your listings and in chats.
              </p>
              <ul className="grid gap-1.5 text-sm">
                {PUBLIC_FIELDS.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-champagne" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="grid gap-4">
              <p className="flex items-center gap-2 font-display text-lg">
                <EyeOff className="size-4 text-muted" aria-hidden /> Never public
              </p>
              <ul className="grid gap-1.5 text-sm text-muted">
                {PRIVATE_FIELDS.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Your phone number is seen only by you and our staff. Verification details are handled under the Data Privacy Act; see{" "}
                <Link href="/account/verification" className="text-gold underline-offset-4 hover:underline">
                  Verification
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
