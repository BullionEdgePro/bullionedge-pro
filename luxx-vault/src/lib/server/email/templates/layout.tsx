import { Body, Container, Head, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";

const velvet = "#17101F";
const champagne = "#D6B26E";
const ink = "#1C1A22";
const muted = "#55505E";

export const emailStyles = {
  h1: { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "26px", lineHeight: "1.25", color: ink, margin: "0 0 16px", fontWeight: 600 },
  p: { fontSize: "16px", lineHeight: "1.6", color: ink, margin: "0 0 16px" },
  small: { fontSize: "13px", lineHeight: "1.5", color: muted, margin: "0 0 8px" },
  button: {
    display: "inline-block",
    backgroundColor: champagne,
    color: velvet,
    fontWeight: 700,
    fontSize: "16px",
    padding: "14px 28px",
    borderRadius: "10px",
    textDecoration: "none",
  },
  code: { fontFamily: "Menlo, Consolas, monospace", fontSize: "13px", color: muted, wordBreak: "break-all" as const },
};

/** Shared frame: velvet band with the emblem, pearl body, official-channels footer. */
export function EmailLayout({ preview, baseUrl, children }: { preview: string; baseUrl: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#EEF0F3", margin: 0, padding: "24px 0", fontFamily: "'Plus Jakarta Sans', Helvetica, Arial, sans-serif" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", backgroundColor: "#FFFFFF", borderRadius: "16px", overflow: "hidden" }}>
          <Section style={{ backgroundColor: velvet, padding: "24px 32px" }}>
            <Img src={`${baseUrl}/icons/icon-192.png`} width="48" height="48" alt="" style={{ display: "inline-block", verticalAlign: "middle", borderRadius: "10px" }} />
            <Text style={{ display: "inline-block", verticalAlign: "middle", margin: "0 0 0 14px", color: champagne, fontFamily: "Georgia, serif", fontSize: "22px", letterSpacing: "2px" }}>
              LUXX4LESS
            </Text>
          </Section>
          <Section style={{ padding: "32px" }}>{children}</Section>
          <Hr style={{ borderColor: "#D5D8DE", margin: 0 }} />
          <Section style={{ padding: "20px 32px 28px" }}>
            <Text style={emailStyles.small}>
              {brand.publicName} · {brand.location.city}, {brand.location.province}. {brand.tagline.en}
            </Text>
            <Text style={emailStyles.small}>
              We will never ask for your password, one-time codes or bank details by chat, SMS or phone. If a message claims to be from us and asks for
              these, report it on our website.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
