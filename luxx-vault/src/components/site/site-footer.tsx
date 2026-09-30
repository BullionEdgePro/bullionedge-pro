import Link from "next/link";
import { Lockup } from "@/components/brand/logo";
import { brand } from "@/config/brand";

/** Closes every public page. The full storefront footer arrives with Phase 3. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-surface-sunk">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <Lockup layout="stacked" emblemClassName="size-12" />
          <p className="mt-4 text-sm text-muted">{brand.packagingTagline}</p>
        </div>

        <nav aria-label="Footer">
          <h2 className="font-display text-xs uppercase tracking-[0.28em] text-gold">Pages</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/about" className="text-muted hover:text-gold">
                Behind the counter
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-muted hover:text-gold">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-muted hover:text-gold">
                Privacy
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="font-display text-xs uppercase tracking-[0.28em] text-gold">Find us</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a
                href={brand.social.facebookUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted hover:text-gold"
              >
                Facebook
              </a>
            </li>
            {brand.branches
              .filter((b) => !("confirm" in b && b.confirm))
              .map((b) => (
                <li key={b.name} className="text-muted">
                  {b.name}
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-6">
          © {year} {brand.legalName}. Established {brand.established}.
        </p>
      </div>
    </footer>
  );
}
