import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";

/** The shared opening of a tool page: breadcrumb, title and one short paragraph. */
export function ToolIntro({ title, children, crumb }: { title: string; children: ReactNode; crumb: string }) {
  return (
    <Reveal>
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/tools" className="hover:text-gold">
              Tools
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-fg/80">
            {crumb}
          </li>
        </ol>
      </nav>
      <h1 className="mt-4 max-w-3xl text-3xl text-pearl sm:text-5xl">{title}</h1>
      <div className="measure mt-5 text-muted">{children}</div>
    </Reveal>
  );
}

/** Wraps a page's JSON-LD safely (JSON-LD guide: escape `<`). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
