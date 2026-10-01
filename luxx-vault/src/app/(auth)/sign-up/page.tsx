import type { Metadata } from "next";
import { SignUpForm, type JoinAs } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

/** /sign-up asks buyer or seller first; /sign-up?as=buyer|seller goes straight to the form. */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { as } = await searchParams;
  const role: JoinAs | null = as === "buyer" || as === "seller" ? as : null;
  return <SignUpForm as={role} />;
}
