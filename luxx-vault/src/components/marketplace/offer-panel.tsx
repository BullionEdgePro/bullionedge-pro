"use client";

import { HandCoins, MessagesSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { makeListingOffer } from "@/lib/server/marketplace/actions/offers";
import { startConversation } from "@/lib/server/marketplace/actions/messages";
import { formatPeso } from "@/lib/pricing";
import { ActionForm, SubmitButton } from "./action-form";

/**
 * The buying controls on a listing: request it at the asking price, make an
 * offer (when the seller takes offers), or open a chat. Gated by tier; the
 * server re-checks every rule and prices the item itself.
 */
export function OfferPanel({
  listingId,
  code,
  askingPrice,
  openToOffers,
  live,
  viewer,
  available,
}: {
  listingId: string;
  code: string;
  askingPrice: number | null;
  openToOffers: boolean;
  live: boolean;
  viewer: { signedIn: boolean; tier: number; isOwner: boolean };
  available: boolean;
}) {
  const [mode, setMode] = useState<"asking" | "offer" | null>(null);
  const returnTo = `/marketplace/${code}`;

  if (viewer.isOwner) {
    return (
      <div className="grid gap-3 rounded-2xl border border-champagne/30 bg-gold-tint/40 p-5">
        <p className="text-sm font-semibold text-fg">This is your listing.</p>
        <p className="text-sm text-muted">Offers and questions arrive in your account. You can edit, renew or take it down there.</p>
        <Button asChild variant="secondary" size="sm" className="w-fit">
          <Link href="/account/listings">Manage my listings</Link>
        </Button>
      </div>
    );
  }
  if (!available) {
    return <p className="rounded-2xl border border-line bg-surface-sunk p-5 text-sm text-muted">This item isn&rsquo;t available right now.</p>;
  }
  if (!viewer.signedIn) {
    return (
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Sign in and verify your identity to buy, make offers and message the seller.</p>
        <Button asChild>
          <Link href={`/sign-in?next=${encodeURIComponent(returnTo)}`}>Sign in to buy</Link>
        </Button>
      </div>
    );
  }
  if (viewer.tier < 3) {
    return (
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-fg">
          <ShieldCheck className="size-4 text-ice" aria-hidden /> ID verification required
        </p>
        <p className="text-sm text-muted">
          Both sides of every trade are ID-verified. It takes about three minutes, and then you can buy, make offers and chat.
        </p>
        <Button asChild>
          <Link href={`/account/verification?next=${encodeURIComponent(returnTo)}`}>Verify my identity</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {mode === null && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => setMode("asking")} disabled={askingPrice === null}>
            <HandCoins aria-hidden /> Buy at {askingPrice !== null ? formatPeso(askingPrice) : "asking price"}
          </Button>
          {openToOffers ? (
            <Button size="lg" variant="secondary" onClick={() => setMode("offer")}>
              Make an offer
            </Button>
          ) : (
            <ChatButton listingId={listingId} returnTo={returnTo} />
          )}
        </div>
      )}

      {mode !== null && (
        <ActionForm action={makeListingOffer} hidden={{ listingId, mode }} className="grid gap-4 rounded-2xl border border-champagne/30 bg-surface p-5">
          {({ fieldErrors, state }) =>
            state?.ok ? (
              <p className="text-sm text-muted">
                You&rsquo;ll find it under{" "}
                <Link href="/account/offers?tab=sent" className="font-semibold text-champagne underline-offset-4 hover:underline">
                  Offers › Sent
                </Link>
                .
              </p>
            ) : (
              <>
                <div>
                  <p className="font-semibold text-fg">{mode === "asking" ? "Request to buy at the asking price" : "Make an offer"}</p>
                  <p className="mt-1 text-sm text-muted">
                    {mode === "asking"
                      ? `The seller confirms within 48 hours. ${live ? "The price follows spot, so it is fixed at today's figure when you send this." : ""} Nothing is charged until you pay into the protected hold.`
                      : "The seller can accept, counter or decline within 48 hours. Nothing is charged until an offer is accepted and you pay into the protected hold."}
                  </p>
                </div>
                {mode === "offer" && (
                  <Field label="Your offer (₱)" error={fieldErrors.amount}>
                    {(p) => <Input {...p} name="amount" inputMode="numeric" placeholder={askingPrice ? String(Math.round(askingPrice * 0.95)) : ""} className="tabular" required />}
                  </Field>
                )}
                <Field label="Note to the seller (optional)" hint="Questions about the item are best asked in the chat." error={fieldErrors.message}>
                  {(p) => <Textarea {...p} name="message" rows={2} maxLength={500} className="min-h-0" />}
                </Field>
                <div className="flex flex-wrap gap-2">
                  <SubmitButton pendingLabel="Sending…">{mode === "asking" ? `Send request · ${askingPrice !== null ? formatPeso(askingPrice) : ""}` : "Send offer"}</SubmitButton>
                  <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                    Cancel
                  </Button>
                </div>
              </>
            )
          }
        </ActionForm>
      )}

      {openToOffers && <ChatButton listingId={listingId} returnTo={returnTo} quiet />}
    </div>
  );
}

function ChatButton({ listingId, returnTo, quiet = false }: { listingId: string; returnTo: string; quiet?: boolean }) {
  return (
    <form action={startConversation}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <SubmitButton size={quiet ? "md" : "lg"} variant={quiet ? "ghost" : "secondary"} className="w-full" pendingLabel="Opening chat…">
        <MessagesSquare aria-hidden /> Chat with seller
      </SubmitButton>
    </form>
  );
}
