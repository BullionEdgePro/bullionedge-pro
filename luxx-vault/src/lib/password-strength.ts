/**
 * A quick, offline guide to password strength for the sign-up meter. The
 * server is the real gate: minimum 10 characters, plus the breached-password
 * check (HIBP) where enabled.
 */
export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string };

const COMMON = ["password", "123456", "qwerty", "iloveyou", "luxx4less", "gold", "admin", "welcome", "abc123", "pilipinas", "mahalkita"];

export function passwordStrength(pw: string, context: string[] = []): Strength {
  if (!pw) return { score: 0, label: "", hint: "At least 10 characters. A short phrase is easiest to remember." };
  const lower = pw.toLowerCase();
  const personal = [...COMMON, ...context.map((c) => c.toLowerCase()).filter((c) => c.length >= 3)];
  if (personal.some((w) => lower.includes(w))) {
    return { score: 1, label: "Too guessable", hint: "Avoid names, emails and common words." };
  }
  if (pw.length < 10) return { score: 1, label: "Too short", hint: `${10 - pw.length} more character${pw.length === 9 ? "" : "s"} needed.` };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const repeats = /(.)\1{2,}/.test(pw) || /(012|123|234|345|456|567|678|789|abc|bcd|cde)/i.test(pw);
  let score = (pw.length >= 16 ? 2 : pw.length >= 12 ? 1 : 0) + (kinds >= 3 ? 2 : kinds === 2 ? 1 : 0);
  if (repeats) score -= 1;
  const s = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
  const labels = { 1: "Weak", 2: "Fair", 3: "Strong", 4: "Very strong" } as const;
  const hints = {
    1: "Add length or mix in numbers and symbols.",
    2: "Good start. A few more characters makes it much stronger.",
    3: "Strong password.",
    4: "Excellent.",
  } as const;
  return { score: s, label: labels[s], hint: hints[s] };
}
