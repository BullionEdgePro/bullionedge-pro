import { describe, expect, it } from "vitest";
import { SELL_BRANCHES, manilaToday, normalizePhMobile, parseContact, sellQuoteSchema } from "./schema";

const NOW = new Date("2026-09-30T10:00:00Z"); // 18:00 in Manila

const valid = {
  name: "Maria Santos",
  contact: "0917 123 4567",
  metal: "gold",
  purity: "18",
  weightGrams: "12.5",
  branch: "antipolo",
  preferredDate: "",
  notes: "",
};

describe("contact", () => {
  it("normalises PH mobile numbers", () => {
    expect(normalizePhMobile("0917 123 4567")).toBe("+639171234567");
    expect(normalizePhMobile("+63 917-123-4567")).toBe("+639171234567");
    expect(normalizePhMobile("639171234567")).toBe("+639171234567");
    expect(normalizePhMobile("9171234567")).toBe("+639171234567");
    expect(normalizePhMobile("02 8123 4567")).toBeNull();
    expect(normalizePhMobile("0917123456")).toBeNull();
  });

  it("accepts a mobile or an email, nothing else", () => {
    expect(parseContact("Maria@Example.com")).toEqual({ kind: "email", value: "maria@example.com" });
    expect(parseContact("09171234567")).toEqual({ kind: "mobile", value: "+639171234567" });
    expect(parseContact("call me")).toBeNull();
  });
});

describe("branches", () => {
  it("offers only public branches", () => {
    expect(SELL_BRANCHES.map((b) => b.value)).toEqual(["antipolo", "ongpin"]);
  });
});

describe("sell quote schema", () => {
  const schema = sellQuoteSchema(NOW);

  it("accepts a complete request and normalises it", () => {
    const r = schema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.contact).toBe("+639171234567");
    expect(r.data.purity).toBe(18);
    expect(r.data.weightGrams).toBe(12.5);
    expect(r.data.preferredDate).toBeUndefined();
    expect(r.data.notes).toBeUndefined();
  });

  it("rejects a karat that isn't in the table, and silver fineness for gold", () => {
    expect(schema.safeParse({ ...valid, purity: "23" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, purity: "925" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, metal: "silver", purity: "925" }).success).toBe(true);
  });

  it("rejects unknown branches, including the unconfirmed one", () => {
    expect(schema.safeParse({ ...valid, branch: "makati" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, branch: "online" }).success).toBe(false);
  });

  it("rejects bad weights", () => {
    expect(schema.safeParse({ ...valid, weightGrams: "0" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, weightGrams: "-2" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, weightGrams: "abc" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, weightGrams: "20000" }).success).toBe(false);
  });

  it("keeps preferred dates between today and 90 days out (Manila)", () => {
    expect(manilaToday(NOW)).toBe("2026-09-30");
    expect(schema.safeParse({ ...valid, preferredDate: "2026-09-30" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, preferredDate: "2026-09-29" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, preferredDate: "2027-03-01" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, preferredDate: "30/10/2026" }).success).toBe(false);
  });

  it("rejects missing names and unusable contacts", () => {
    expect(schema.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, contact: "facebook" }).success).toBe(false);
  });
});
