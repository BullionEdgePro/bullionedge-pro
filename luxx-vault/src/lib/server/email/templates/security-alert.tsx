import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

/** New sign-in, 2FA turned on/off, passkey added, password changed. */
export function SecurityAlert({
  name,
  title,
  lines,
  baseUrl,
}: {
  name: string;
  title: string;
  lines: string[];
  baseUrl: string;
}) {
  return (
    <EmailLayout preview={title} baseUrl={baseUrl}>
      <Text style={s.h1}>{title}</Text>
      <Text style={s.p}>Hi {name}, we&apos;re letting you know about a change to your Luxx4less account.</Text>
      {lines.map((l) => (
        <Text key={l} style={{ ...s.small, color: "#1C1A22" }}>
          {l}
        </Text>
      ))}
      <Text style={{ ...s.p, marginTop: "16px" }}>If this was you, there&apos;s nothing to do. If it wasn&apos;t, secure your account now.</Text>
      <Button href={`${baseUrl}/account/security`} style={s.button}>
        Review account security
      </Button>
    </EmailLayout>
  );
}
