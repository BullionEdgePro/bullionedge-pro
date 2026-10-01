import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { InlineAction } from "@/components/marketplace/inline-action";
import { MediaImage } from "@/components/marketplace/media-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import { ADMIN_ROLES } from "@/config/roles";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/pricing";
import { db } from "@/lib/server/db";
import { mediaUrl } from "@/lib/server/media";
import { getSpot } from "@/lib/server/marketplace/context";
import { gramsLabel, purityLabel } from "@/lib/server/marketplace/describe";
import { setProductStatus } from "@/lib/server/shop/admin-actions";
import { productValuation } from "@/lib/server/shop/products";
import { getShopSettings } from "@/lib/server/shop/settings";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Official shop" };

const VIEWS = [
  { key: "active", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "soldout", label: "Sold out" },
  { key: "archived", label: "Archived" },
] as const;

export default async function AdminShopPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(ADMIN_ROLES, "/admin/shop");
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.key === sp.view)?.key ?? "active";
  const [rows, { spot }, settings, counts] = await Promise.all([
    db.product.findMany({
      where: view === "soldout" ? { status: "active", stock: { lte: 0 } } : { status: view },
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
      take: 200,
      include: { images: { orderBy: { position: "asc" }, take: 1, select: { mediaId: true } }, _count: { select: { orderItems: true } } },
    }),
    getSpot(),
    getShopSettings(),
    db.product.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Official shop</h1>
          <p className="mt-1 text-sm text-muted">
            Pieces Luxx4less sells itself, at <Link href="/shop" className="text-champagne hover:underline">/shop</Link>. {count("active")} published, {count("draft")} drafts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/shop/settings">
              <Settings aria-hidden /> Shop settings
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/shop/new">
              <Plus aria-hidden /> Add a piece
            </Link>
          </Button>
        </div>
      </div>

      {sp.saved && <FormAlert tone="success">Saved {sp.saved}.</FormAlert>}
      {!settings.paymentInstructions?.trim() && (
        <FormAlert tone="info">
          GCash and bank transfer stay switched off until you add your payment details in{" "}
          <Link href="/admin/shop/settings" className="font-semibold underline underline-offset-4">
            Shop settings
          </Link>
          . Pay in store and cash on delivery work already.
        </FormAlert>
      )}

      <nav className="flex flex-wrap gap-1 rounded-2xl border border-line p-1 sm:w-fit sm:rounded-full" aria-label="Views">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/admin/shop?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", view === v.key ? "bg-gold-tint text-champagne" : "text-muted hover:text-fg")}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          {view === "active" ? "Nothing published yet. Add your first piece." : "Nothing here."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((p) => {
            const v = productValuation(p, spot);
            return (
              <li key={p.id} className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center">
                <MediaImage src={p.images[0] ? mediaUrl(p.images[0].mediaId) : null} alt={p.title} isPrivate={p.status === "draft"} sizes="80px" className="aspect-square w-20 rounded-xl" />
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/shop/${p.code}`} className="font-display text-xs tracking-[0.2em] text-champagne tabular hover:underline">
                      {p.code}
                    </Link>
                    <Badge tone={p.status === "active" ? "success" : p.status === "draft" ? "neutral" : "warning"}>{p.status === "active" ? "Published" : p.status === "draft" ? "Draft" : "Archived"}</Badge>
                    {p.featured && <Badge tone="gold">Featured</Badge>}
                    {p.stock <= 0 && <Badge tone="danger">Sold out</Badge>}
                  </div>
                  <p className="truncate font-semibold">{p.title}</p>
                  <p className="text-sm text-muted tabular">
                    {[purityLabel(p), gramsLabel(Number(p.weightGrams)), v.pricePhp !== null ? formatPeso(v.pricePhp) : "no live price", `${p.stock} in stock`, p._count.orderItems ? `${p._count.orderItems} ordered` : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/admin/shop/${p.code}`}>Edit</Link>
                  </Button>
                  {p.status !== "active" && (
                    <InlineAction action={setProductStatus} fields={{ productId: p.id, status: "active" }}>
                      Publish
                    </InlineAction>
                  )}
                  {p.status === "active" && (
                    <InlineAction action={setProductStatus} fields={{ productId: p.id, status: "draft" }} confirm="Unpublish this piece? It leaves the shop and anyone's bag.">
                      Unpublish
                    </InlineAction>
                  )}
                  {p.status !== "archived" && (
                    <InlineAction action={setProductStatus} fields={{ productId: p.id, status: "archived" }} confirm="Archive this piece? It stops being sold.">
                      Archive
                    </InlineAction>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
