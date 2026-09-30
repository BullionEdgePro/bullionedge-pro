import { Button, Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

export function VerifyEmail({ name, url, baseUrl }: { name: string; url: string; baseUrl: string }) {
  return (
    <EmailLayout preview="Confirm your email to finish creating your Luxx4less account" baseUrl={baseUrl}>
      <Text style={s.h1}>Confirm your email</Text>
      <Text style={s.p}>Hi {name}, salamat for joining Luxx4less. Tap the button to confirm this is your email address.</Text>
      <Button href={url} style={s.button}>
        Confirm my email
      </Button>
      <Text style={{ ...s.small, marginTop: "24px" }}>This link works once and expires in 24 hours. If the button doesn&apos;t work, copy this link:</Text>
      <Link href={url} style={s.code}>
        {url}
      </Link>
      <Text style={{ ...s.small, marginTop: "16px" }}>Didn&apos;t sign up? You can ignore this email; no account is created until the address is confirmed.</Text>
    </EmailLayout>
  );
}
