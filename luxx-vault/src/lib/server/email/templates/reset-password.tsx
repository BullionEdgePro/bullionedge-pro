import { Button, Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

export function ResetPassword({ name, url, baseUrl }: { name: string; url: string; baseUrl: string }) {
  return (
    <EmailLayout preview="Reset your Luxx4less password" baseUrl={baseUrl}>
      <Text style={s.h1}>Reset your password</Text>
      <Text style={s.p}>Hi {name}, someone asked to reset the password for your Luxx4less account. If it was you, choose a new one here.</Text>
      <Button href={url} style={s.button}>
        Choose a new password
      </Button>
      <Text style={{ ...s.small, marginTop: "24px" }}>This link works once and expires in 1 hour. Resetting signs you out on every other device.</Text>
      <Link href={url} style={s.code}>
        {url}
      </Link>
      <Text style={{ ...s.small, marginTop: "16px" }}>Didn&apos;t ask for this? Ignore this email and your password stays the same.</Text>
    </EmailLayout>
  );
}
