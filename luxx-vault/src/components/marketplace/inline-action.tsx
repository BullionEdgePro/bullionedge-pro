"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import type { ComponentProps } from "react";
import type { ActionState } from "@/lib/server/marketplace/context";
import { SubmitButton } from "./action-form";

/**
 * A one-button form for small actions in lists (renew, mark sold, decline…).
 * Shows the result inline beside the button; asks first when `confirm` is set.
 */
export function InlineAction({
  action,
  fields,
  children,
  confirm,
  variant = "ghost",
  size = "sm",
  className,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  children: React.ReactNode;
  confirm?: string;
  variant?: ComponentProps<typeof SubmitButton>["variant"];
  size?: ComponentProps<typeof SubmitButton>["size"];
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok && state.href) router.push(state.href);
  }, [state, router]);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} size={size}>
        {children}
      </SubmitButton>
      {state?.error && (
        <span role="alert" className="ml-2 text-xs font-medium text-danger">
          {state.error}
        </span>
      )}
      {state?.ok && state.message && (
        <span role="status" className="ml-2 text-xs font-medium text-success">
          {state.message}
        </span>
      )}
    </form>
  );
}
