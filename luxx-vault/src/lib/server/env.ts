import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once. Misconfiguration fails loudly at the
 * first request instead of surfacing as odd auth behaviour. Documented in
 * .env.example.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.string().url(),
    EMAIL_PROVIDER: z.enum(["resend", "mock"]).default("mock"),
    EMAIL_FROM: z.string().default("Luxx4less <no-reply@luxx4less.ph>"),
    RESEND_API_KEY: z.string().optional(),
    /** Mock email on a public deployment (demos): the mailbox then needs this key. */
    ALLOW_MOCK_EMAIL_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
    MAILBOX_KEY: z.string().min(16).optional(),
    /** Breached-password check (HIBP k-anonymity). On by default; off where api.pwnedpasswords.com is unreachable. */
    HIBP_CHECK: z.enum(["on", "off"]).default("on"),
    /** WebAuthn relying party id: the bare domain, e.g. luxx4less.ph. Defaults to the host of BETTER_AUTH_URL. */
    PASSKEY_RP_ID: z.string().optional(),
    /** gold-api.com key: only the price-history backfill needs it (free tier, 10 requests/hour). Live prices work without it. */
    GOLD_API_KEY: z.string().optional(),
    /** metals.dev key: optional second source for spot prices when gold-api.com is down. */
    METALS_DEV_API_KEY: z.string().optional(),
    /** Protects /api/cron/*. Vercel Cron sends it as "Authorization: Bearer <CRON_SECRET>". */
    CRON_SECRET: z.string().min(16).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Required when EMAIL_PROVIDER=resend" });
    }
    // A public deployment (not localhost) must opt in to mock email and lock the mailbox.
    const isPublic = env.NODE_ENV === "production" && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.BETTER_AUTH_URL);
    if (isPublic && env.EMAIL_PROVIDER === "mock") {
      if (env.ALLOW_MOCK_EMAIL_IN_PRODUCTION !== "true") {
        ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "Mock email in production needs ALLOW_MOCK_EMAIL_IN_PRODUCTION=true" });
      } else if (!env.MAILBOX_KEY) {
        ctx.addIssue({ code: "custom", path: ["MAILBOX_KEY"], message: "A public mock mailbox must be protected by MAILBOX_KEY" });
      }
    }
  });

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/**
 * On Vercel, default the site URL: production uses the project's production
 * domain; preview deployments use their own branch URL, so sign-in works there too.
 */
function withPlatformDefaults(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const vercelHost =
    source.VERCEL_ENV === "production" ? source.VERCEL_PROJECT_PRODUCTION_URL : (source.VERCEL_BRANCH_URL ?? source.VERCEL_URL);
  return {
    ...source,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL ?? (vercelHost ? `https://${vercelHost}` : undefined),
  };
}

export function env(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(withPlatformDefaults(process.env));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid server environment:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
