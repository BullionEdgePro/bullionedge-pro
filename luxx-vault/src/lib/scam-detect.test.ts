import { describe, expect, it } from "vitest";
import { detectScam, knownFlags } from "./scam-detect";

const flags = (text: string) => detectScam(text).flags;

describe("detectScam: phone numbers", () => {
  it.each([
    "call me 09171234567",
    "0917 123 4567",
    "0917-123-4567",
    "0917.123.4567",
    "(0917) 123 4567",
    "+63 917 123 4567",
    "+639171234567",
    "63 917 123 4567",
    "my number is 917 123 4567",
    "0 9 1 7 1 2 3 4 5 6 7",
    "zero nine one seven one two three four five six seven",
  ])("flags %s", (text) => {
    expect(flags(text)).toContain("phone_number");
  });

  it.each([
    "It's 18K, 12.4 grams, asking ₱75,000",
    "Weight is 12.45 g and the receipt is dated 2024-05-12",
    "LBC tracking 123456789012 sent today",
    "Price 150000 fixed",
  ])("does not flag %s", (text) => {
    expect(flags(text)).not.toContain("phone_number");
  });
});

describe("detectScam: bank and e-wallet accounts", () => {
  it.each([
    "BDO account 0012 3456 7890",
    "Send to BPI acct no. 1234-5678-90",
    "Metrobank 123-4-56789012-3",
    "EastWest savings 200012345678",
    "gcash 09171234567 under Maria",
    "Maya: 0917 123 4567",
  ])("flags %s", (text) => {
    expect(flags(text)).toContain("bank_account");
  });

  it("does not flag a tracking number with no bank word nearby", () => {
    expect(flags("J&T tracking 830012345678, arriving Friday")).not.toContain("bank_account");
  });

  it("does not flag the word account without a number", () => {
    expect(flags("I'll check my account later")).toEqual([]);
  });
});

describe("detectScam: off-platform payment", () => {
  it.each([
    "send to my GCash na lang",
    "Send mo na lang sa gcash ko",
    "gcash ko na lang para mabilis",
    "Can you pay outside the platform? cheaper",
    "pay me directly and I'll ship",
    "deposit first to reserve",
    "reservation fee muna po",
    "bayad muna bago ko ipadala",
    "Bayaran mo muna",
    "padala mo na lang ang pera",
    "padala muna",
    "pay upfront please",
    "let's skip the escrow",
    "wag na ang platform, diretso na lang sa akin",
    "via Palawan Express",
    "transfer the payment to my bank",
  ])("flags %s", (text) => {
    expect(flags(text)).toContain("off_platform_payment");
  });

  it.each([
    "I'll pay through the protected hold now",
    "Ipapadala ko bukas via LBC",
    "Payment held, shipping tomorrow",
    "Can we meet at the Antipolo branch for testing?",
  ])("does not flag %s", (text) => {
    expect(flags(text)).not.toContain("off_platform_payment");
  });
});

describe("detectScam: links and outside contact", () => {
  it.each([
    "check https://example.com/deal",
    "see www.gold-deals.net",
    "m.me/goldseller",
    "wa.me/639171234567",
    "t.me/luxxdeals",
    "add me on Facebook",
    "pm mo ako sa messenger",
    "message me on WhatsApp",
    "my viber is the same",
    "viber na lang tayo",
    "text mo na lang ako",
    "goldshop.ph has more",
  ])("flags %s", (text) => {
    expect(flags(text)).toContain("external_link");
  });

  it("does not flag links to Luxx4less itself", () => {
    expect(flags("here it is: https://luxx4less.ph/marketplace/LX-4F7K2")).not.toContain("external_link");
  });

  it("does not flag an ordinary sentence mentioning Facebook", () => {
    expect(flags("I saw your shop on the Facebook live last week")).not.toContain("external_link");
  });
});

describe("detectScam: pressure tactics", () => {
  it.each([
    "Today only at this price",
    "many buyers waiting, decide now",
    "Maraming nag-iinquire po",
    "someone else is interested",
    "last piece!",
    "first come first served",
    "price valid until 5pm",
    "hurry, going fast",
    "mauunahan ka",
  ])("flags %s", (text) => {
    expect(flags(text)).toContain("pressure");
  });

  it.each(["No hurry, take your time", "Take a few days to decide", "It's the last day I'm in Antipolo? no, just kidding"])(
    "does not flag %s",
    (text) => {
      expect(flags(text)).not.toContain("pressure");
    },
  );
});

describe("detectScam: combined and clean", () => {
  it("returns every distinct flag once, in a stable order", () => {
    const r = detectScam("Today only! Send to my GCash 0917 123 4567 or text me, www.deal.ph");
    expect(r.flags).toEqual(["phone_number", "bank_account", "off_platform_payment", "external_link", "pressure"]);
    expect(r.matches).toHaveLength(5);
    expect(r.matches[0]?.text).toMatch(/0917/);
  });

  it("leaves an ordinary trading message alone", () => {
    expect(flags("Hi! Is the 18K Saudi chain still available? Can you share a photo of the hallmark?")).toEqual([]);
    expect(flags("Sure, 12.4 g on my scale. Open to ₱80,000.")).toEqual([]);
  });

  it("copes with empty input", () => {
    expect(flags("")).toEqual([]);
  });

  it("narrows stored strings to known flags", () => {
    expect(knownFlags(["pressure", "nonsense", "phone_number"])).toEqual(["phone_number", "pressure"]);
  });
});
