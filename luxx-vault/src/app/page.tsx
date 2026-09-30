import Link from "next/link";
import { Monogram, Wordmark } from "@/components/brand/monogram";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

// Placeholder until the Phase 3 home page. Points reviewers at the Phase 1 work.
export default function Home() {
  return (
    <main className="surface-velvet grid min-h-svh place-items-center px-4">
      <div className="flex flex-col items-center text-center">
        <Monogram option="c" variant="metal" className="size-20" />
        <Wordmark className="mt-6 text-2xl" />
        <p className="mt-4 font-display text-xl text-gold">{brand.tagline.en}</p>
        <p className="mt-2 text-muted">Under construction. Phase 1 review:</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/design-system">Design board</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/design-system/hero">Hero prototype</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
