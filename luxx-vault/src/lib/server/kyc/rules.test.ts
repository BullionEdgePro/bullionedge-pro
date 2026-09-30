import { describe, expect, it } from "vitest";
import {
  ageOn,
  identityRuleFlags,
  idNumberLast4,
  isAddressProofFresh,
  isExpired,
  maskPayout,
  nameTokens,
  namesMatch,
  parseIsoDate,
  phToday,
} from "./rules";

const d = (s: string) => parseIsoDate(s)!;
// 30 Sep 2026, 10:00 in Manila.
const now = new Date("2026-09-30T02:00:00Z");

describe("dates in Philippine time", () => {
  it("today follows Manila, not UTC", () => {
    expect(phToday(new Date("2026-09-30T17:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(phToday(new Date("2026-09-30T15:59:00Z")).toISOString().slice(0, 10)).toBe("2026-09-30");
  });
  it("parses strict ISO dates only", () => {
    expect(parseIsoDate("2026-02-29")).toBeNull();
    expect(parseIsoDate("2024-02-29")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(parseIsoDate("30/09/2026")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });
});

describe("age", () => {
  it("turns 18 on the birthday itself", () => {
    expect(ageOn(d("2008-09-30"), now)).toBe(18);
    expect(ageOn(d("2008-10-01"), now)).toBe(17);
    expect(ageOn(d("1990-01-15"), now)).toBe(36);
  });
  it("handles a leap-day birthday", () => {
    expect(ageOn(d("2008-02-29"), new Date("2026-02-28T02:00:00Z"))).toBe(17);
    expect(ageOn(d("2008-02-29"), new Date("2026-03-01T02:00:00Z"))).toBe(18);
  });
});

describe("expiry", () => {
  it("an ID is valid through its expiry date", () => {
    expect(isExpired(d("2026-09-30"), now)).toBe(false);
    expect(isExpired(d("2026-09-29"), now)).toBe(true);
    expect(isExpired(d("2031-01-01"), now)).toBe(false);
  });
});

describe("proof of address", () => {
  it("must be within three months and not future-dated", () => {
    expect(isAddressProofFresh(d("2026-09-01"), now)).toBe(true);
    expect(isAddressProofFresh(d("2026-07-01"), now)).toBe(true);
    expect(isAddressProofFresh(d("2026-06-01"), now)).toBe(false);
    expect(isAddressProofFresh(d("2026-10-05"), now)).toBe(false);
  });
});

describe("name matching", () => {
  it("normalises accents, punctuation, suffixes, initials and particles", () => {
    expect(nameTokens("José P. Rizal Jr.")).toEqual(["jose", "rizal"]);
    expect(nameTokens("DELA CRUZ, JUAN")).toEqual(["delacruz", "juan"]);
    expect(nameTokens("Juan de la Cruz")).toEqual(["juan", "delacruz"]);
    expect(nameTokens("Ma. Cristina Peña")).toEqual(["maria", "cristina", "pena"]);
  });

  it("matches the same person written differently", () => {
    for (const [account, id] of [
      ["Juan Dela Cruz", "DELA CRUZ, JUAN PONCE"],
      ["Juan dela Cruz Jr.", "JUAN DELACRUZ"],
      ["José Rizal", "JOSE P. RIZAL"],
      ["Maria Santos", "MA. CRISTINA SANTOS"],
      ["Ana Peña", "ANA PENA"],
      ["Bea Tier-Three", "BEA TIER THREE"],
    ]) {
      expect(namesMatch(account!, id!), `${account} ~ ${id}`).toBe(true);
    }
  });

  it("does not match different people", () => {
    for (const [account, id] of [
      ["Juan Cruz", "PEDRO CRUZ"],
      ["Juan Santos", "JUAN REYES"],
      ["Juan", "JUAN SANTOS"], // a first name alone proves nothing
      ["Juan Santos", ""],
    ]) {
      expect(namesMatch(account!, id!), `${account} ≠ ${id}`).toBe(false);
    }
  });
});

describe("ID numbers and payouts", () => {
  it("keeps only the last four characters", () => {
    expect(idNumberLast4("N01-23-456789")).toBe("6789");
    expect(idNumberLast4("p1234567a")).toBe("567A");
    expect(idNumberLast4("123")).toBeNull();
  });
  it("masks payout accounts", () => {
    expect(maskPayout("GCash", "0917 123 7788")).toBe("GCash ••••7788");
    expect(maskPayout("BDO", "12-3456")).toBeNull();
  });
});

describe("identityRuleFlags", () => {
  const base = {
    accountName: "Juan Dela Cruz",
    nameOnId: "JUAN DELA CRUZ",
    birthDate: d("1990-05-05"),
    expiry: d("2030-01-01"),
    duplicateId: false,
    livenessScore: 0.95,
    faceMatchScore: null,
    now,
  };
  it("a clean application raises nothing", () => expect(identityRuleFlags(base)).toEqual([]));
  it("raises every rule that fails", () => {
    const flags = identityRuleFlags({
      ...base,
      nameOnId: "PEDRO REYES",
      birthDate: d("2010-01-01"),
      expiry: d("2025-01-01"),
      duplicateId: true,
      livenessScore: 0.4,
      faceMatchScore: 0.5,
    });
    expect(flags).toEqual(["underage", "expired_id", "name_mismatch", "duplicate_id", "low_liveness", "low_face_match"]);
  });
  it("an ID without an expiry date is never expired", () => expect(identityRuleFlags({ ...base, expiry: null })).toEqual([]));
});
