import { describe, expect, it } from "vitest";
import { formatPhMobile, isPhMobile, maskPhMobile, normalizePhMobile } from "./phone";

describe("normalizePhMobile", () => {
  it("accepts every common way of writing a PH mobile number", () => {
    for (const v of [
      "09171234567",
      "9171234567",
      "639171234567",
      "+639171234567",
      "+63 917 123 4567",
      "0917-123-4567",
      "(0917) 123 4567",
      "  0917.123.4567 ",
      "+63 (917) 123-4567",
    ]) {
      expect(normalizePhMobile(v), v).toBe("+639171234567");
    }
  });

  it("rejects landlines, foreign numbers, wrong lengths and junk", () => {
    for (const v of [
      "",
      null,
      undefined,
      "0287089506", // Manila landline
      "02 7089 5061",
      "+14155550123", // US
      "+6591234567", // Singapore
      "0917123456", // one digit short
      "091712345678", // one digit long
      "+63 817 123 4567", // not a 9XX mobile prefix
      "0917 123 4567 ext 2",
      "abc09171234567",
      "+0639171234567",
      "639171234567 0",
    ]) {
      expect(normalizePhMobile(v as string), String(v)).toBeNull();
    }
  });

  it("does not treat a bare 63-prefixed number with a plus sign wrongly", () => {
    expect(normalizePhMobile("+9171234567")).toBeNull();
  });

  it("isPhMobile mirrors normalisation", () => {
    expect(isPhMobile("0917 123 4567")).toBe(true);
    expect(isPhMobile("12345")).toBe(false);
  });
});

describe("formatting and masking", () => {
  it("formats E.164 for display", () => expect(formatPhMobile("+639171234567")).toBe("+63 917 123 4567"));
  it("masks all but the last four digits", () => expect(maskPhMobile("+639171234567")).toBe("+63 9•• ••• 4567"));
  it("never echoes something that is not a valid number", () => {
    expect(maskPhMobile("0917")).toBe("—");
    expect(maskPhMobile(null)).toBe("—");
  });
});
