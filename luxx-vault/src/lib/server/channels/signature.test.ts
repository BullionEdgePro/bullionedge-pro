import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MESSENGER_WINDOW_MS,
  isLinkCode,
  newLinkCode,
  safeEqualHex,
  verifyMetaSignature,
  verifyViberSignature,
  withinMessengerWindow,
} from "./signature";

const body = JSON.stringify({ event: "conversation_started", user: { id: "01234567890A=" }, context: "abc" });

describe("verifyViberSignature", () => {
  const token = "445da6az1s345z78-dazcczb2542zv51a-e0vc5fva17480im9";
  const good = createHmac("sha256", token).update(body).digest("hex");

  it("accepts the HMAC of the exact raw body", () => {
    expect(verifyViberSignature(body, good, token)).toBe(true);
    expect(verifyViberSignature(Buffer.from(body), good.toUpperCase(), token)).toBe(true);
  });

  it("rejects a changed body, a wrong key, or a missing/garbled header", () => {
    expect(verifyViberSignature(body + " ", good, token)).toBe(false);
    expect(verifyViberSignature(body, good, token + "x")).toBe(false);
    expect(verifyViberSignature(body, null, token)).toBe(false);
    expect(verifyViberSignature(body, "zz", token)).toBe(false);
    expect(verifyViberSignature(body, good.slice(0, 63), token)).toBe(false);
    expect(verifyViberSignature(body, good, "")).toBe(false);
  });
});

describe("verifyMetaSignature", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const good = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("accepts sha256=<hex HMAC>", () => {
    expect(verifyMetaSignature(body, good, secret)).toBe(true);
  });

  it("rejects the old sha1 header, a bare digest, and tampering", () => {
    expect(verifyMetaSignature(body, good.replace("sha256=", "sha1="), secret)).toBe(false);
    expect(verifyMetaSignature(body, good.replace("sha256=", ""), secret)).toBe(false);
    expect(verifyMetaSignature(body.replace("abc", "abd"), good, secret)).toBe(false);
    expect(verifyMetaSignature(body, good, "")).toBe(false);
  });
});

describe("safeEqualHex", () => {
  it("never throws on unequal lengths or non-hex input", () => {
    expect(safeEqualHex("abc", "abcd")).toBe(false);
    expect(safeEqualHex("xyz0", "abcd")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("withinMessengerWindow", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  it("is open for 24 hours after the person's last message", () => {
    expect(withinMessengerWindow(new Date(now.getTime() - 60_000), now)).toBe(true);
    expect(withinMessengerWindow(new Date(now.getTime() - MESSENGER_WINDOW_MS + 1), now)).toBe(true);
  });
  it("is closed at 24 hours, with no inbound message, or for a time in the future", () => {
    expect(withinMessengerWindow(new Date(now.getTime() - MESSENGER_WINDOW_MS), now)).toBe(false);
    expect(withinMessengerWindow(null, now)).toBe(false);
    expect(withinMessengerWindow(new Date(now.getTime() + 60_000), now)).toBe(false);
  });
});

describe("link codes", () => {
  it("are 24 URL-safe characters and unique", () => {
    const a = newLinkCode();
    expect(isLinkCode(a)).toBe(true);
    expect(a).not.toBe(newLinkCode());
    expect(isLinkCode("short")).toBe(false);
    expect(isLinkCode("a".repeat(23) + "/")).toBe(false);
    expect(isLinkCode(42)).toBe(false);
  });
});
