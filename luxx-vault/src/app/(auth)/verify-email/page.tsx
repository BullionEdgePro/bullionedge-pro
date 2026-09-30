import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailState } from "./verify-state";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailState />
    </Suspense>
  );
}
