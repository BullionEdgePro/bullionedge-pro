import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Numbered pages as plain links (crawlable, shareable, no JavaScript needed). */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const list = [...nums].sort((a, b) => a - b);
  const cell = "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-semibold tabular transition-colors";
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(cell, "text-muted hover:bg-surface hover:text-fg")} rel="prev">
          <ChevronLeft className="size-4" aria-hidden />
          <span className="sr-only">Previous page</span>
        </Link>
      ) : null}
      {list.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - list[i - 1]! > 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            className={cn(cell, n === page ? "bg-gold-tint text-champagne ring-1 ring-champagne/40" : "text-muted hover:bg-surface hover:text-fg")}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={cn(cell, "text-muted hover:bg-surface hover:text-fg")} rel="next">
          <ChevronRight className="size-4" aria-hidden />
          <span className="sr-only">Next page</span>
        </Link>
      ) : null}
    </nav>
  );
}
