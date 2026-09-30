import { describe, expect, it } from "vitest";
import { hasAnyRole, parseRoles, requiresTwoFactor, verificationTier } from "./roles";

describe("parseRoles", () => {
  it("defaults to buyer", () => {
    expect(parseRoles(null)).toEqual(["buyer"]);
    expect(parseRoles("")).toEqual(["buyer"]);
  });
  it("splits and drops unknown roles", () => {
    expect(parseRoles("seller, admin,wizard")).toEqual(["seller", "admin"]);
    expect(parseRoles("wizard")).toEqual(["buyer"]);
  });
});

describe("access rules", () => {
  it("matches any allowed role", () => {
    expect(hasAnyRole("buyer,kyc_reviewer", ["kyc_reviewer"])).toBe(true);
    expect(hasAnyRole("buyer", ["admin", "super_admin"])).toBe(false);
  });
  it("requires 2FA for sellers and staff, not buyers", () => {
    expect(requiresTwoFactor("buyer")).toBe(false);
    expect(requiresTwoFactor("reseller")).toBe(false);
    expect(requiresTwoFactor("seller")).toBe(true);
    expect(requiresTwoFactor("support")).toBe(true);
    expect(requiresTwoFactor("buyer,admin")).toBe(true);
  });
});

describe("verificationTier", () => {
  it("is 0 for guests and unverified emails", () => {
    expect(verificationTier({ signedIn: false, emailVerified: true })).toBe(0);
    expect(verificationTier({ signedIn: true, emailVerified: false })).toBe(0);
  });
  it("climbs one check at a time", () => {
    expect(verificationTier({ signedIn: true, emailVerified: true })).toBe(1);
    expect(verificationTier({ signedIn: true, emailVerified: true, phoneVerified: true })).toBe(2);
    expect(verificationTier({ signedIn: true, emailVerified: true, phoneVerified: true, identityVerified: true })).toBe(3);
    expect(verificationTier({ signedIn: true, emailVerified: true, phoneVerified: true, identityVerified: true, sellerVerified: true })).toBe(4);
  });
  it("never skips a missing earlier check", () => {
    expect(verificationTier({ signedIn: true, emailVerified: true, identityVerified: true, sellerVerified: true })).toBe(1);
  });
});
