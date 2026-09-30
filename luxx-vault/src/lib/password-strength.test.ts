import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
  it("guides an empty field", () => expect(passwordStrength("").score).toBe(0));
  it("flags short passwords", () => expect(passwordStrength("Ab1!xyz").label).toBe("Too short"));
  it("flags common words and personal details", () => {
    expect(passwordStrength("mypassword2026!").label).toBe("Too guessable");
    expect(passwordStrength("JuanDelaCruz#99", ["juan"]).label).toBe("Too guessable");
  });
  it("rewards length and variety", () => {
    expect(passwordStrength("correct horse battery staple").score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("Tunay-na-Ginto-2026").score).toBe(4);
  });
  it("penalises runs and repeats", () => {
    expect(passwordStrength("aaaabbbb1234").score).toBeLessThan(passwordStrength("xqvtbmwe9k2r").score + 1);
  });
});
