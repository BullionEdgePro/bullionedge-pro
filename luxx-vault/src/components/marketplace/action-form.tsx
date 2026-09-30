"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/field";
import type { ActionState } from "@/lib/server/marketplace/context";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A form bound to a marketplace server action with useActionState: shows the
 * returned message or error, passes field errors to its children, and follows
 * `href` when the action hands one back. Works without JavaScript too (the
 * action still runs; the page re-renders).
 */
export function ActionForm({
  action,
  children,
  className,
  hidden,
  showSuccess = true,
}: {
  action: Action;
  children: ReactNode | ((state: { fieldErrors: Record<string, string>; pending: boolean; state: ActionState }) => ReactNode);
  className?: string;
  /** Hidden inputs, e.g. { code: "LX-4F7K2" }. */
  hidden?: Record<string, string>;
  showSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok && state.href) router.push(state.href);
  }, [state, router]);
  const fieldErrors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className={className} noValidate>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {typeof children === "function" ? children({ fieldErrors, pending, state }) : children}
      {state?.error && (
        <div className="mt-3">
          <FormAlert>{state.error}</FormAlert>
        </div>
      )}
      {showSuccess && state?.ok && state.message && (
        <div className="mt-3">
          <FormAlert tone="success">{state.message}</FormAlert>
        </div>
      )}
    </form>
  );
}

/** Submit button that shows a spinner while its form's action runs. */
export function SubmitButton({ children, pendingLabel, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending || undefined} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
