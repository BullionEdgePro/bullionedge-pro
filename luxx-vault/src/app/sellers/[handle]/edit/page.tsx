import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ShowroomEditor } from "@/components/marketplace/showroom-editor";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { mediaUrl } from "@/lib/server/media";
import { loadShowroom } from "@/lib/server/marketplace/showroom";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Edit showroom", robots: { index: false } };

export default async function EditShowroomPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await requireViewer(`/sellers/${handle}/edit`);
  const data = await loadShowroom(handle);
  if (!data) notFound();
  if (data.profile.userId !== viewer.userId) redirect(`/sellers/${data.profile.handle}`);
  const p = data.profile;

  return (
    <>
      <SiteHeader signedIn />
      <main className="surface-velvet">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8 lg:py-14">
          <Link href={`/sellers/${p.handle}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-champagne">
            <ChevronLeft className="size-4" aria-hidden /> Back to my showroom
          </Link>
          <h1 className="mt-4 text-4xl text-pearl">Edit showroom</h1>
          <p className="mt-2 text-muted">
            Your name, bio, city, specialisations and tools come from{" "}
            <Link href="/account/profile" className="font-semibold text-champagne underline-offset-4 hover:underline">
              your profile
            </Link>
            .
          </p>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-8">
            <ShowroomEditor tagline={p.showroomTagline ?? ""} cover={p.coverMediaId ? { id: p.coverMediaId, url: mediaUrl(p.coverMediaId) } : null} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
