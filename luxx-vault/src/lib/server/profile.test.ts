import { describe, expect, it, vi } from "vitest";

// profile.ts is server-only and talks to the database; these tests cover its pure rules.
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: {} }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error {} } }));

const { profileInputErrors, slugifyHandle, validateHandle } = await import("./profile");

describe("validateHandle", () => {
  it("accepts ordinary handles", () => {
    for (const h of ["maria-santos", "goldby.jun", "ana22", "abc", "a".repeat(30), "Maria-Santos", "@maria"]) {
      expect(validateHandle(h).ok, h).toBe(true);
    }
    expect(validateHandle("  @Maria-Santos ")).toEqual({ ok: true, handle: "maria-santos" });
  });

  it("enforces length and characters", () => {
    expect(validateHandle("ab")).toMatchObject({ ok: false });
    expect(validateHandle("a".repeat(31))).toMatchObject({ ok: false });
    for (const h of ["maria santos", "maria_santos", "maría", "maria!", "-maria", "maria.", "ma..ria", "ma-.ria", "12345"]) {
      expect(validateHandle(h).ok, h).toBe(false);
    }
  });

  it("blocks reserved words", () => {
    for (const h of ["admin", "support", "staff", "help", "api", "official", "sellers", "verify"]) expect(validateHandle(h).ok, h).toBe(false);
  });

  it("blocks handles that impersonate the shop or staff, look-alikes included", () => {
    for (const h of ["luxx4less", "luxx4less.ph", "luxx", "the-luxx-shop", "1uxx4less", "luxx-4-less", "l4l-gold", "official-gold", "gold.official", "the.admin", "adm1n", "verified-seller", "moderator1"]) {
      expect(validateHandle(h).ok, h).toBe(false);
    }
  });
});

describe("slugifyHandle", () => {
  it("turns names into handles", () => {
    expect(slugifyHandle("María dela Cruz")).toBe("maria-dela-cruz");
    expect(slugifyHandle("  Juan   Peña Jr. ")).toBe("juan-pena-jr");
    expect(slugifyHandle("Bea Tier-Three")).toBe("bea-tier-three");
  });
  it("falls back when the name can't make a valid handle", () => {
    expect(slugifyHandle("李")).toBe("member");
    expect(slugifyHandle("Al")).toBe("member");
    expect(slugifyHandle("Luxx Official")).toBe("member");
  });
  it("stays within the length limit", () => expect(slugifyHandle("A very long name that keeps going and going").length).toBeLessThanOrEqual(24));
});

describe("profileInputErrors", () => {
  const ok = {
    handle: "maria-santos",
    displayName: "Maria Santos",
    bio: "Collector of Saudi gold.",
    regionCode: null,
    provinceCode: null,
    cityCode: null,
    businessName: null,
    specializations: ["Gold assaying"],
    tools: ["XRF machine"],
    yearsExperience: 3,
  };
  it("accepts a valid profile", () => expect(profileInputErrors(ok)).toBeNull());
  it("reports each bad field", () => {
    const e = profileInputErrors({ ...ok, bio: "x".repeat(281), specializations: ["Hacking"], yearsExperience: 4, displayName: "M" });
    expect(Object.keys(e ?? {}).sort()).toEqual(["bio", "displayName", "specializations", "yearsExperience"]);
  });
  it("keeps a handle the person already holds, even if now reserved", () => {
    expect(profileInputErrors({ ...ok, handle: "ana-admin" }, "ana-admin")).toBeNull();
    expect(profileInputErrors({ ...ok, handle: "ana-admin" }, "ana")?.handle).toBeTruthy();
  });
});
