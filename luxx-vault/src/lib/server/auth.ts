import "server-only";
import { createHash } from "node:crypto";
import { passkey } from "@better-auth/passkey";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, haveIBeenPwned, twoFactor } from "better-auth/plugins";
import { ac, roleAccess } from "@/config/access";
import { ADMIN_ROLES } from "@/config/roles";
import { audit } from "./audit";
import { db } from "./db";
import { sendPasswordResetEmail, sendSecurityAlert, sendVerificationEmail } from "./email/send";
import { POLICY_VERSION } from "./policy";
import { env } from "./env";


// OWASP password-storage settings for Argon2id (the library's default algorithm).
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

const e = env();
const baseURL = e.BETTER_AUTH_URL.replace(/\/$/, "");
const rpID = e.PASSKEY_RP_ID ?? new URL(baseURL).hostname;

/** Short stable fingerprint of a browser, to spot sign-ins from new devices. Never stores the raw user agent in logs. */
function deviceKey(userAgent: string | null | undefined): string {
  return createHash("sha256").update(userAgent ?? "unknown").digest("hex").slice(0, 16);
}

function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "an unknown device";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone or iPad" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "a device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "a browser";
  return `${browser} on ${os}`;
}

const SECURITY_EVENTS: Record<string, { action: string; title: string } | undefined> = {
  "/two-factor/disable": { action: "auth.2fa_disabled", title: "Two-step sign-in was turned off" },
  "/two-factor/generate-backup-codes": { action: "auth.backup_codes_regenerated", title: "New backup codes were created" },
  "/passkey/verify-registration": { action: "auth.passkey_added", title: "A passkey was added to your account" },
  "/passkey/delete-passkey": { action: "auth.passkey_removed", title: "A passkey was removed from your account" },
  "/change-password": { action: "auth.password_changed", title: "Your Luxx4less password was changed" },
};

export const auth = betterAuth({
  appName: "Luxx4less",
  baseURL,
  secret: e.BETTER_AUTH_SECRET,
  trustedOrigins: [baseURL],
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    password: {
      hash: (password) => argonHash(password, ARGON),
      verify: ({ hash, password }) => argonVerify(hash, password),
    },
    // Sign-up with an existing email answers like a normal sign-up (no account
    // enumeration); the real owner hears about it instead.
    onExistingUserSignUp: async ({ user }) => {
      await sendSecurityAlert(user.email, user.name, "Someone tried to sign up with your email", [
        "An account already exists for this address, so nothing was changed.",
        "If it was you, sign in instead, or reset your password if you've forgotten it.",
      ]);
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, user.name, url);
    },
    onPasswordReset: async ({ user }) => {
      await audit({ actorId: user.id, action: "auth.password_reset" });
      await sendSecurityAlert(user.email, user.name, "Your Luxx4less password was changed", [
        `Changed on ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time).`,
        "You've been signed out on all other devices.",
      ]);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // The sign-in form requests a fresh link itself (with the welcome destination).
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours (brief §8)
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, user.name, url);
    },
    afterEmailVerification: async (user) => {
      await audit({ actorId: user.id, action: "auth.email_verified" });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refreshed daily while in use
    freshAge: 60 * 15, // sensitive changes need a sign-in within 15 minutes
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 10, max: 3 },
      "/send-verification-email": { window: 60 * 10, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: baseURL.startsWith("https://"),
    cookiePrefix: "l4l",
  },

  hooks: {
    // Sign-up must carry the consents a Philippine platform needs: terms,
    // privacy notice (Data Privacy Act) and age 18+ (brief §12).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      if (body.acceptTerms !== true || body.acceptPrivacy !== true) {
        throw new APIError("BAD_REQUEST", { message: "Please agree to the Terms and the Privacy Notice to create an account." });
      }
      if (body.ageConfirmed !== true) {
        throw new APIError("BAD_REQUEST", { message: "You must be 18 or older to use Luxx4less." });
      }
    }),
    // Every security-relevant change is logged and the owner gets an email.
    after: createAuthMiddleware(async (ctx) => {
      if (isAPIError(ctx.context.returned) || ctx.context.returned instanceof Error) return;
      const session = ctx.context.session;
      if (!session) return;
      let event = SECURITY_EVENTS[ctx.path];
      // Turning 2FA on finishes with a code check while signed in and 2FA still off.
      if (ctx.path === "/two-factor/verify-totp" && !session.user.twoFactorEnabled) {
        event = { action: "auth.2fa_enabled", title: "Two-step sign-in was turned on" };
      }
      if (!event) return;
      await audit({ actorId: session.user.id, action: event.action, ipAddress: session.session.ipAddress ?? null });
      await sendSecurityAlert(session.user.email, session.user.name, event.title, [
        `When: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)`,
        `Device: ${describeDevice(session.session.userAgent)}`,
      ]);
    }),
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user, ctx) => {
          const body = (ctx?.body ?? {}) as Record<string, unknown>;
          const ip = ctx?.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
          const ua = ctx?.request?.headers.get("user-agent") ?? null;
          const consents = [
            { kind: "terms", granted: body.acceptTerms === true },
            { kind: "privacy", granted: body.acceptPrivacy === true },
            { kind: "age_18", granted: body.ageConfirmed === true },
            { kind: "marketing", granted: body.marketing === true },
          ];
          await db.consentRecord.createMany({
            data: consents.map((c) => ({ ...c, userId: user.id, version: POLICY_VERSION, ipAddress: ip, userAgent: ua })),
          });
          await audit({ actorId: user.id, action: "auth.sign_up", ipAddress: ip });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          const key = deviceKey(session.userAgent);
          const known = await db.auditLog.findFirst({
            where: { actorId: session.userId, action: "auth.sign_in", meta: { path: ["device"], equals: key } },
            select: { id: true },
          });
          const hasHistory = await db.auditLog.count({ where: { actorId: session.userId, action: "auth.sign_in" } });
          await audit({ actorId: session.userId, action: "auth.sign_in", meta: { device: key }, ipAddress: session.ipAddress ?? null });
          // Alert on a device we haven't seen, but not on the very first sign-in.
          if (!known && hasHistory > 0) {
            const user = await db.user.findUnique({ where: { id: session.userId }, select: { email: true, name: true } });
            if (user) {
              await sendSecurityAlert(user.email, user.name, "New sign-in to your Luxx4less account", [
                `Device: ${describeDevice(session.userAgent)}`,
                `When: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine time)`,
                ...(session.ipAddress ? [`Network address: ${session.ipAddress}`] : []),
              ]);
            }
          }
        },
      },
    },
  },

  plugins: [
    twoFactor({ issuer: "Luxx4less" }),
    passkey({ rpID, rpName: "Luxx4less", origin: baseURL }),
    admin({ ac, roles: roleAccess, defaultRole: "buyer", adminRoles: [...ADMIN_ROLES] }),
    ...(e.HIBP_CHECK === "on"
      ? [haveIBeenPwned({ customPasswordCompromisedMessage: "This password has appeared in a known data breach. Please choose a different one." })]
      : []),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
