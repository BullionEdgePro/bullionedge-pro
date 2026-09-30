import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type Profile } from "@/generated/prisma/client";
import { EXPERIENCE, SPECIALIZATIONS, TESTING_TOOLS } from "@/config/catalog";
import { isValidLocation } from "@/lib/locations";
import { db } from "./db";

/**
 * Profiles: the public face of an account (showroom at /sellers/{handle})
 * plus its verification timestamps. Every other track creates profiles
 * through `ensureProfile`, never directly.
 */

// ------------------------------------------------------------------ handles

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/** Exact handles nobody may take: site routes, staff words, and generic names scammers like. */
const RESERVED = new Set([
  "about", "account", "accounts", "admin", "administrator", "api", "app", "auth", "billing", "blog", "buy", "cart", "checkout",
  "contact", "customer-service", "dashboard", "dev", "faq", "help", "helpdesk", "home", "info", "kyc", "learn", "legal", "live",
  "login", "logout", "mail", "marketplace", "me", "mod", "moderator", "new", "news", "null", "owner", "payments", "prices", "privacy",
  "profile", "register", "resellers", "root", "security", "sell", "seller", "sellers", "settings", "shop", "sign-in", "sign-up",
  "signin", "signup", "staff", "static", "store", "support", "system", "team", "terms", "tools", "trust", "undefined", "verify",
  "verification", "www",
]);

/**
 * Fragments that make a handle look official, checked after undoing common
 * look-alike swaps (1→l, 4→a, 0→o…) and separators, so "luxx4less.ph",
 * "1uxx-official" and "the.admin" are all refused. Impersonating the shop is
 * the scam this marketplace most needs to stop.
 */
const RESERVED_FRAGMENTS = ["luxx", "official", "admin", "moderator", "verified", "l4l"];
const LOOKALIKE: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t" };

export type HandleCheck = { ok: true; handle: string } | { ok: false; reason: string };

/** Lowercases and trims; the result still has to pass validateHandle. */
export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, "");
}

export function validateHandle(input: string): HandleCheck {
  const handle = normalizeHandle(input);
  if (handle.length < HANDLE_MIN) return { ok: false, reason: `At least ${HANDLE_MIN} characters.` };
  if (handle.length > HANDLE_MAX) return { ok: false, reason: `No more than ${HANDLE_MAX} characters.` };
  if (!/^[a-z0-9.-]+$/.test(handle)) return { ok: false, reason: "Use lowercase letters, numbers, dots and hyphens only." };
  if (!/^[a-z0-9]/.test(handle) || !/[a-z0-9]$/.test(handle)) return { ok: false, reason: "Start and end with a letter or number." };
  if (/[.-]{2}/.test(handle)) return { ok: false, reason: "No two dots or hyphens in a row." };
  if (!/[a-z]/.test(handle)) return { ok: false, reason: "Include at least one letter." };
  if (RESERVED.has(handle)) return { ok: false, reason: "That handle is reserved." };
  const squashed = handle.replace(/[.-]/g, "");
  // "1" stands in for both l and i ("1uxx", "adm1n").
  const deleet = squashed.replace(/[03457]/g, (d) => LOOKALIKE[d] ?? d);
  const variants = [squashed, deleet.replace(/1/g, "l"), deleet.replace(/1/g, "i")];
  if (RESERVED_FRAGMENTS.some((f) => variants.some((v) => v.includes(f)))) {
    return { ok: false, reason: "Handles can't suggest they belong to Luxx4less or its staff." };
  }
  return { ok: true, handle };
}

/** A handle-shaped version of a person's name: "María dela Cruz" → "maria-dela-cruz". */
export function slugifyHandle(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  return base.length >= HANDLE_MIN && validateHandle(base).ok ? base : "member";
}

async function handleTaken(handle: string, exceptUserId?: string): Promise<boolean> {
  const row = await db.profile.findUnique({ where: { handle }, select: { userId: true } });
  return Boolean(row && row.userId !== exceptUserId);
}

/** A free handle based on the name, trying the plain slug first. Read-only. */
export async function suggestHandle(name: string, exceptUserId?: string): Promise<string> {
  const base = slugifyHandle(name);
  if (base !== "member" && !(await handleTaken(base, exceptUserId))) return base;
  for (let i = 0; i < 8; i++) {
    const candidate = `${base}-${randomInt(100, 10_000)}`;
    if (!(await handleTaken(candidate, exceptUserId))) return candidate;
  }
  return `${base}-${randomInt(100_000, 1_000_000)}`;
}

/** Whether someone may use this handle (valid, not reserved, not someone else's). */
export async function checkHandleAvailability(input: string, userId: string): Promise<HandleCheck> {
  const v = validateHandle(input);
  if (!v.ok) return v;
  if (await handleTaken(v.handle, userId)) return { ok: false, reason: "That handle is taken." };
  return v;
}

// ------------------------------------------------------------------ profile rows

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * The user's profile, created on first need with a suggested handle.
 * Safe to call concurrently: a lost race re-reads the winner's row.
 */
export async function ensureProfile(userId: string, name: string): Promise<Profile> {
  const existing = await db.profile.findUnique({ where: { userId } });
  if (existing) return existing;
  const displayName = name.trim().slice(0, 60) || "Member";
  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = await suggestHandle(displayName);
    try {
      return await db.profile.create({ data: { userId, handle, displayName } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const winner = await db.profile.findUnique({ where: { userId } });
      if (winner) return winner;
      // Otherwise the handle was taken in between; try another.
    }
  }
  throw new Error("Couldn't create your profile. Please try again.");
}

export type ProfileInput = {
  handle: string;
  displayName: string;
  bio: string | null;
  regionCode: string | null;
  provinceCode: string | null;
  cityCode: string | null;
  businessName: string | null;
  specializations: string[];
  tools: string[];
  yearsExperience: number | null;
};

export const BIO_MAX = 280;

/**
 * Field-level problems with a profile edit, or null when it can be saved.
 * A handle the person already holds is kept even if the rules have since
 * tightened (staff-assigned handles, older accounts); only a change is checked.
 */
export function profileInputErrors(input: ProfileInput, currentHandle?: string): Partial<Record<keyof ProfileInput, string>> | null {
  const errors: Partial<Record<keyof ProfileInput, string>> = {};
  if (normalizeHandle(input.handle) !== currentHandle) {
    const h = validateHandle(input.handle);
    if (!h.ok) errors.handle = h.reason;
  }
  if (input.displayName.trim().length < 2 || input.displayName.length > 60) errors.displayName = "Between 2 and 60 characters.";
  if (input.bio && input.bio.length > BIO_MAX) errors.bio = `No more than ${BIO_MAX} characters.`;
  if (input.businessName && input.businessName.length > 80) errors.businessName = "No more than 80 characters.";
  if (input.regionCode && !isValidLocation(input.regionCode, input.cityCode, input.provinceCode)) errors.regionCode = "Choose a region, province and city from the lists.";
  if (!input.regionCode && (input.cityCode || input.provinceCode)) errors.regionCode = "Choose a region first.";
  if (input.specializations.some((s) => !(SPECIALIZATIONS as readonly string[]).includes(s))) errors.specializations = "Choose from the list.";
  if (input.tools.some((s) => !(TESTING_TOOLS as readonly string[]).includes(s))) errors.tools = "Choose from the list.";
  if (input.yearsExperience !== null && !EXPERIENCE.some((e) => e.value === input.yearsExperience)) errors.yearsExperience = "Choose from the list.";
  return Object.keys(errors).length ? errors : null;
}

/**
 * Saves the public profile fields. Returns field errors instead of throwing
 * for anything the person can fix (e.g. a handle taken in the meantime).
 */
export async function updateProfile(
  userId: string,
  accountName: string,
  input: ProfileInput,
): Promise<{ ok: true; profile: Profile; handleChanged: boolean } | { ok: false; errors: Partial<Record<keyof ProfileInput, string>> }> {
  const current = await ensureProfile(userId, accountName);
  const errors = profileInputErrors(input, current.handle);
  if (errors) return { ok: false, errors };
  const handle = normalizeHandle(input.handle);
  if (await handleTaken(handle, userId)) return { ok: false, errors: { handle: "That handle is taken." } };
  const data = {
    handle,
    displayName: input.displayName.trim(),
    bio: input.bio?.trim() || null,
    regionCode: input.regionCode || null,
    provinceCode: input.regionCode ? input.provinceCode || null : null,
    cityCode: input.regionCode ? input.cityCode || null : null,
    businessName: input.businessName?.trim() || null,
    specializations: [...new Set(input.specializations)],
    tools: [...new Set(input.tools)],
    yearsExperience: input.yearsExperience,
  };
  try {
    const profile = await db.profile.update({ where: { userId }, data });
    return { ok: true, profile, handleChanged: current.handle !== handle };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: { handle: "That handle is taken." } };
    throw e;
  }
}

/** Tier 2: the number is now proven to belong to this account. */
export async function setVerifiedPhone(userId: string, accountName: string, phoneE164: string, at: Date): Promise<Profile> {
  await ensureProfile(userId, accountName);
  return db.profile.update({ where: { userId }, data: { phone: phoneE164, phoneVerifiedAt: at } });
}

/** Tier 3, set only by a reviewer's approval. */
export async function markIdentityVerified(userId: string, accountName: string, at: Date): Promise<Profile> {
  await ensureProfile(userId, accountName);
  return db.profile.update({ where: { userId }, data: { identityVerifiedAt: at } });
}

/** Tier 4, set only by a reviewer's approval. */
export async function markSellerVerified(userId: string, accountName: string, at: Date): Promise<Profile> {
  await ensureProfile(userId, accountName);
  return db.profile.update({ where: { userId }, data: { sellerVerifiedAt: at } });
}
