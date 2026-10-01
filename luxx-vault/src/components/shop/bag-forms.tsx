"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/marketplace/action-form";
import { cn } from "@/lib/cn";
import { addToBag, setBagQuantity } from "@/lib/server/shop/actions";

/** Product page: choose a quantity (when there is more than one) and add to the bag. */
export function AddToBag({ productId, stock }: { productId: string; stock: number }) {
  const [qty, setQty] = useState(1);
  return (
    <ActionForm action={addToBag} hidden={{ productId }} className="grid gap-3">
      {({ state }) => (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {stock > 1 && (
              <div className="flex h-14 items-center rounded-xl border border-line" role="group" aria-label="Quantity">
                <button type="button" aria-label="One less" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-12 place-items-center text-muted hover:text-fg disabled:opacity-40">
                  <Minus className="size-4" aria-hidden />
                </button>
                <input type="hidden" name="quantity" value={qty} />
                <span className="w-8 text-center font-semibold tabular" aria-live="polite">
                  {qty}
                </span>
                <button type="button" aria-label="One more" disabled={qty >= stock} onClick={() => setQty((q) => Math.min(stock, q + 1))} className="grid size-12 place-items-center text-muted hover:text-fg disabled:opacity-40">
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            )}
            <SubmitButton size="lg" className="flex-1 sm:flex-none" pendingLabel="Adding…">
              <ShoppingBag aria-hidden /> Add to bag
            </SubmitButton>
          </div>
          {state?.ok && (
            <Link href="/shop/bag" className="w-fit text-sm font-semibold text-champagne underline-offset-4 hover:underline">
              View your bag and check out →
            </Link>
          )}
        </>
      )}
    </ActionForm>
  );
}

/** Bag line: quantity stepper and remove. Each change saves straight away. */
export function BagLineControls({ productId, quantity, stock }: { productId: string; quantity: number; stock: number }) {
  const [state, action, pending] = useActionState(setBagQuantity, null);
  const set = (q: number) => {
    const f = new FormData();
    f.set("productId", productId);
    f.set("quantity", String(q));
    startTransition(() => action(f));
  };
  return (
    <div className="flex items-center gap-2">
      {stock > 1 || quantity > 1 ? (
        <div className={cn("flex h-9 items-center rounded-lg border border-line", pending && "opacity-60")} role="group" aria-label="Quantity">
          <button type="button" aria-label="One less" disabled={pending || quantity <= 1} onClick={() => set(quantity - 1)} className="grid size-9 place-items-center text-muted hover:text-fg disabled:opacity-40">
            <Minus className="size-3.5" aria-hidden />
          </button>
          <span className="w-6 text-center text-sm font-semibold tabular">{quantity}</span>
          <button type="button" aria-label="One more" disabled={pending || quantity >= stock} onClick={() => set(quantity + 1)} className="grid size-9 place-items-center text-muted hover:text-fg disabled:opacity-40">
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
      <button type="button" disabled={pending} onClick={() => set(0)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted hover:bg-surface-sunk hover:text-danger">
        <Trash2 className="size-3.5" aria-hidden /> Remove
      </button>
      {state?.error && (
        <span role="alert" className="text-xs text-danger">
          {state.error}
        </span>
      )}
    </div>
  );
}
