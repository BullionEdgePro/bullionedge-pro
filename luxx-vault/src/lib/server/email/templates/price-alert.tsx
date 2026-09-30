import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles as s } from "./layout";

/**
 * A price alert (and, with `kicker` changed, any other notification that asks
 * for email). The first body line is the headline figure; the rest are notes.
 */
export function PriceAlertEmail({
  name,
  title,
  body,
  href,
  baseUrl,
  kicker = "Price alert",
  manageHref = "/account/alerts",
  footnote,
}: {
  name: string;
  title: string;
  body: string;
  href?: string;
  baseUrl: string;
  kicker?: string;
  manageHref?: string;
  /** Replaces the price-alert footnote for other kinds of notification. */
  footnote?: string;
}) {
  const [lead, ...notes] = body.split("\n").filter(Boolean);
  const link = href ? `${baseUrl}${href.startsWith("/") ? href : `/${href}`}` : `${baseUrl}/prices`;
  return (
    <EmailLayout preview={title} baseUrl={baseUrl}>
      <Text style={{ ...s.small, textTransform: "uppercase", letterSpacing: "2px", color: "#7A5B22", margin: "0 0 8px" }}>{kicker}</Text>
      <Text style={s.h1}>{title}</Text>
      <Text style={s.p}>Hi {name},</Text>
      {lead && (
        <Section style={{ borderLeft: "3px solid #D6B26E", backgroundColor: "#F3EAD8", borderRadius: "8px", padding: "14px 18px", margin: "0 0 20px" }}>
          <Text style={{ ...s.p, margin: 0, fontWeight: 600 }}>{lead}</Text>
        </Section>
      )}
      {notes.map((n) => (
        <Text key={n} style={s.small}>
          {n}
        </Text>
      ))}
      <Button href={link} style={{ ...s.button, marginTop: "16px" }}>
        {href && !href.startsWith("/prices") ? "Open Luxx4less" : "See live prices"}
      </Button>
      {footnote ? (
        <Text style={{ ...s.small, marginTop: "24px" }}>{footnote}</Text>
      ) : (
      <Text style={{ ...s.small, marginTop: "24px" }}>
        You set this alert on Luxx4less. Pause or delete it any time in{" "}
        <a href={`${baseUrl}${manageHref}`} style={{ color: "#7A5B22" }}>
          your price alerts
        </a>
        . We send at most one message per alert every 12 hours.
      </Text>
      )}
    </EmailLayout>
  );
}
