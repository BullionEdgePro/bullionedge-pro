import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => expect(safeNext("/account/security")).toBe("/account/security"));
  it("rejects other sites and tricks", () => {
    for (const v of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null]) expect(safeNext(v)).toBe("/account");
  });
});
