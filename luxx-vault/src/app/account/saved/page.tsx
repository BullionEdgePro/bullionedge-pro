import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/marketplace/empty-state";
import { ListingCard } from "@/components/marketplace/listing-card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/server/db";
import { listingCardSelect, sweepExpired, toCards } from "@/lib/server/marketplace/listings";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const viewer = await requireViewer("/account/saved");
  await sweepExpired();
  const saved = await db.savedListing.findMany({
    where: { userId: viewer.userId, listing: { status: { not: "removed" } } },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: { listing: { select: listingCardSelect } },
  });
  const cards = await toCards(saved.map((s) => s.listing));
  const available = cards.filter((c) => c.status === "active");
  const gone = cards.filter((c) => c.status !== "active");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Saved</h1>
        <p className="mt-1 text-sm text-muted">Pieces you&rsquo;re watching, priced live against today&rsquo;s spot.</p>
      </div>
      {cards.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on any listing to keep it here. Spot-pegged prices update as the market moves."
          actions={
            <Button asChild variant="secondary" className="rounded-full">
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      ) : (
        <>
          {available.length > 0 && (
            <ul className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 xl:grid-cols-3">
              {available.map((c) => (
                <li key={c.id}>
                  <ListingCard card={c} saved signedIn />
                </li>
              ))}
            </ul>
          )}
          {gone.length > 0 && (
            <section className="grid gap-3">
              <h2 className="font-display text-sm tracking-[0.2em] text-muted uppercase">No longer available</h2>
              <ul className="grid grid-cols-1 gap-5 opacity-70 min-[480px]:grid-cols-2 xl:grid-cols-3">
                {gone.map((c) => (
                  <li key={c.id}>
                    <ListingCard card={c} saved signedIn />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
