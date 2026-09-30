import { SiteHeader } from "@/components/site/site-header";
import { getSession } from "@/lib/server/session";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="min-h-svh">
      <SiteHeader signedIn={!!session} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 [&_h2]:mt-10 [&_h2]:text-2xl [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </main>
    </div>
  );
}
