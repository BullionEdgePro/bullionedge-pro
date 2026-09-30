import Link from "next/link";

/**
 * Visible whenever email runs in mock mode (brief §0: never fake security —
 * label mock mode). Reads the raw variable so static pages can render it
 * without the full server environment.
 */
export function MockEmailBanner() {
  if (process.env.EMAIL_PROVIDER === "resend") return null;
  return (
    <div role="status" className="bg-warning-tint px-4 py-2 text-center text-xs font-medium text-warning">
      Test email mode: messages go to the on-site mailbox, not real inboxes.{" "}
      <Link href="/dev/mailbox" className="underline underline-offset-2">
        Open mailbox
      </Link>
    </div>
  );
}
