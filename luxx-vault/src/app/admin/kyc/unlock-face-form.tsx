"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert, Input } from "@/components/ui/field";
import { unlockFaceAction } from "./actions";

export function UnlockFaceForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(unlockFaceAction, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <input type="hidden" name="userId" value={userId} />
      <Input name="reason" required minLength={10} maxLength={500} placeholder="Why it's safe to reopen (e.g. confirmed by email, poor lighting)" aria-label="Reason for reopening trading" />
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="h-12">
        {pending ? "Reopening…" : "Reopen trading"}
      </Button>
      {state && !state.ok && (
        <div className="sm:col-span-2">
          <FormAlert>{state.error}</FormAlert>
        </div>
      )}
    </form>
  );
}
