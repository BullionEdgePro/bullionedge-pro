import "server-only";
import { z } from "zod";
import {
  ADDRESS_PROOF_KINDS,
  BUSINESS_REG_KINDS,
  ID_TYPE_VALUES,
  PAYOUT_KINDS,
  idTypeOf,
  type KycStatus,
} from "@/config/kyc";
import type { Viewer } from "../viewer";
import { audit } from "../audit";
import { db } from "../db";
import { POLICY_VERSION } from "../policy";
import { ensureProfile } from "../profile";
import { assertRateLimit } from "../rate-limit";
import { deviceChecksSchema, kycProvider } from "./provider";
import { identityRuleFlags, idNumberLast4, isAddressProofFresh, maskPayout, namesMatch, parseIsoDate } from "./rules";

/**
 * Applying for Tier 3 (identity) and Tier 4 (seller). Only masked data is
 * stored: last four of the ID number, birth year, masked payout account. The
 * full ID number and date of birth are used for the checks and then dropped.
 * Nothing here approves anything; a reviewer decides in /admin/kyc.
 */

export type SubmitResult = { ok: true; submissionId: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
type RequestMeta = { ipAddress: string | null; userAgent: string | null };

export async function latestSubmissions(userId: string) {
  const [identity, seller] = await Promise.all(
    (["identity", "seller"] as const).map((level) =>
      db.kycSubmission.findFirst({
        where: { userId, level },
        orderBy: { createdAt: "desc" },
        select: { id: true, level: true, status: true, decisionReason: true, idType: true, idNumberLast4: true, createdAt: true, reviewedAt: true, flags: true, payoutMasked: true },
      }),
    ),
  );
  return { identity: identity ?? null, seller: seller ?? null };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

// ------------------------------------------------------------ identity (Tier 3)

export const identityInputSchema = z.object({
  idType: z.enum(ID_TYPE_VALUES, { error: "Choose your ID type." }),
  nameOnId: z.string().trim().min(3, "Enter your name exactly as printed on the ID.").max(120),
  idNumber: z.string().trim().min(5, "Enter the ID number.").max(40),
  birthDate: z.string().refine((v) => parseIsoDate(v) !== null, "Enter your date of birth."),
  expiry: z.string().optional().nullable(),
  biometricConsent: z.literal(true, { error: "Please give your consent to continue." }),
  device: deviceChecksSchema,
});
export type IdentityInput = z.input<typeof identityInputSchema>;

export async function submitIdentity(viewer: Viewer, raw: unknown, meta: RequestMeta): Promise<SubmitResult> {
  if (viewer.tier < 2) return { ok: false, error: "Verify your mobile number first." };
  if (viewer.profile?.identityVerifiedAt) return { ok: false, error: "Your identity is already verified." };
  await assertRateLimit(`kyc:identity:${viewer.userId}`, 5, 24 * 3_600_000, "You've sent several applications today. Please try again tomorrow.");

  const parsed = identityInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;

  const type = idTypeOf(input.idType)!;
  const birthDate = parseIsoDate(input.birthDate)!;
  const last4 = idNumberLast4(input.idNumber);
  if (!last4) return { ok: false, error: "Please check the highlighted details.", fieldErrors: { idNumber: "That ID number looks too short." } };
  const expiry = type.hasExpiry ? parseIsoDate(input.expiry) : null;
  if (type.hasExpiry && !expiry) return { ok: false, error: "Please check the highlighted details.", fieldErrors: { expiry: "Enter the expiry date on the ID." } };
  const now = new Date();
  if (birthDate.getTime() > now.getTime() || birthDate.getUTCFullYear() < 1900) {
    return { ok: false, error: "Please check the highlighted details.", fieldErrors: { birthDate: "Enter a real date of birth." } };
  }
  if (input.device.back === null && type.hasBack) {
    return { ok: false, error: "Please photograph the back of your ID too." };
  }

  const pending = await db.kycSubmission.findFirst({ where: { userId: viewer.userId, level: "identity", status: "pending" }, select: { id: true } });
  if (pending) return { ok: false, error: "Your identity check is already waiting for review." };

  const birthYear = birthDate.getUTCFullYear();
  const duplicate = await db.kycSubmission.findFirst({
    where: { level: "identity", idType: input.idType, idNumberLast4: last4, birthYear, userId: { not: viewer.userId }, status: { not: "rejected" } },
    select: { id: true },
  });

  const provider = kycProvider();
  const assessment = await provider.assessIdentity({ userId: viewer.userId, idType: input.idType, device: input.device });
  const flags = [
    ...new Set([
      ...identityRuleFlags({
        accountName: viewer.name,
        nameOnId: input.nameOnId,
        birthDate,
        expiry,
        duplicateId: Boolean(duplicate),
        livenessScore: assessment.livenessScore,
        faceMatchScore: assessment.faceMatchScore,
        now,
      }),
      ...assessment.flags,
    ]),
  ];

  await ensureProfile(viewer.userId, viewer.name);
  const submission = await db.$transaction(async (tx) => {
    // Separate, explicit consent for biometric processing (Data Privacy Act: sensitive personal information).
    await tx.consentRecord.create({
      data: { userId: viewer.userId, kind: "kyc_biometrics", version: POLICY_VERSION, granted: true, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    });
    return tx.kycSubmission.create({
      data: {
        userId: viewer.userId,
        level: "identity",
        idType: input.idType,
        idNumberLast4: last4,
        nameOnId: input.nameOnId.replace(/\s+/g, " "),
        birthYear,
        idExpiry: expiry,
        provider: assessment.provider,
        providerRef: assessment.providerRef,
        livenessScore: assessment.livenessScore,
        faceMatchScore: assessment.faceMatchScore,
        flags,
        status: "pending",
      },
      select: { id: true },
    });
  });

  await audit({
    actorId: viewer.userId,
    action: "kyc.identity_submitted",
    targetType: "kyc_submission",
    targetId: submission.id,
    meta: { idType: input.idType, provider: assessment.provider, flags, imagesStored: provider.storesImages },
    ipAddress: meta.ipAddress,
  });
  return { ok: true, submissionId: submission.id };
}

// ------------------------------------------------------------ seller (Tier 4)

const kinds = <T extends readonly { value: string }[]>(list: T) => list.map((k) => k.value) as unknown as readonly [T[number]["value"], ...T[number]["value"][]];

export const sellerInputSchema = z
  .object({
    sellerType: z.enum(["individual", "business"], { error: "Choose individual or business." }),
    addressProofKind: z.enum(kinds(ADDRESS_PROOF_KINDS), { error: "Choose the document you'll provide." }),
    addressProofDate: z.string().refine((v) => parseIsoDate(v) !== null, "Enter the date printed on the document."),
    businessRegKind: z.enum(kinds(BUSINESS_REG_KINDS)).optional().nullable(),
    hasBirCor: z.boolean().optional(),
    payoutKind: z.enum(kinds(PAYOUT_KINDS), { error: "Choose where you'd like to be paid." }),
    bankName: z.string().trim().max(60).optional().nullable(),
    payoutAccountName: z.string().trim().min(3, "Enter the name on the account.").max(120),
    payoutAccountNumber: z.string().trim().min(8, "Enter the account or mobile number.").max(34),
    declaration: z.literal(true, { error: "Please confirm the declaration." }),
  })
  .superRefine((v, ctx) => {
    if (v.sellerType === "business") {
      if (!v.businessRegKind) ctx.addIssue({ code: "custom", path: ["businessRegKind"], message: "Choose your business registration." });
      if (!v.hasBirCor) ctx.addIssue({ code: "custom", path: ["hasBirCor"], message: "Business sellers need a BIR Certificate of Registration." });
    }
    if (v.payoutKind === "bank" && !v.bankName) ctx.addIssue({ code: "custom", path: ["bankName"], message: "Enter the bank's name." });
  });
export type SellerInput = z.input<typeof sellerInputSchema>;

export async function submitSeller(viewer: Viewer, raw: unknown, meta: RequestMeta): Promise<SubmitResult> {
  if (viewer.tier < 3) return { ok: false, error: "Verify your identity first." };
  if (viewer.profile?.sellerVerifiedAt) return { ok: false, error: "You're already a verified seller." };
  await assertRateLimit(`kyc:seller:${viewer.userId}`, 5, 24 * 3_600_000, "You've sent several applications today. Please try again tomorrow.");

  const parsed = sellerInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;

  const now = new Date();
  if (!isAddressProofFresh(parseIsoDate(input.addressProofDate)!, now)) {
    return { ok: false, error: "Please check the highlighted details.", fieldErrors: { addressProofDate: "The document must be dated within the last three months." } };
  }
  const kindLabel = input.payoutKind === "bank" ? (input.bankName ?? "Bank").slice(0, 30) : PAYOUT_KINDS.find((k) => k.value === input.payoutKind)!.label;
  const payoutMasked = maskPayout(kindLabel, input.payoutAccountNumber);
  if (!payoutMasked) return { ok: false, error: "Please check the highlighted details.", fieldErrors: { payoutAccountNumber: "That account number doesn't look right." } };
  if ((input.payoutKind === "gcash" || input.payoutKind === "maya") && !/^(\+?63|0)?9\d{9}$/.test(input.payoutAccountNumber.replace(/[\s-]/g, ""))) {
    return { ok: false, error: "Please check the highlighted details.", fieldErrors: { payoutAccountNumber: "Enter the mobile number of the wallet." } };
  }

  const pending = await db.kycSubmission.findFirst({ where: { userId: viewer.userId, level: "seller", status: "pending" }, select: { id: true } });
  if (pending) return { ok: false, error: "Your seller application is already waiting for review." };

  // The payout account must be in the same name as the verified ID (brief §8).
  const approvedId = await db.kycSubmission.findFirst({
    where: { userId: viewer.userId, level: "identity", status: "approved" },
    orderBy: { reviewedAt: "desc" },
    select: { nameOnId: true },
  });
  const idName = approvedId?.nameOnId ?? viewer.name;
  const flags: string[] = [];
  if (!namesMatch(idName, input.payoutAccountName)) flags.push("payout_name_mismatch");
  if (!viewer.twoFactorEnabled) flags.push("no_two_factor");

  const submission = await db.kycSubmission.create({
    data: {
      userId: viewer.userId,
      level: "seller",
      nameOnId: approvedId?.nameOnId ?? null,
      addressProofKind: input.addressProofKind,
      businessRegKind: input.sellerType === "business" && input.businessRegKind ? `${input.businessRegKind}+bir_cor` : null,
      payoutMasked,
      provider: kycProvider().name,
      flags,
      status: "pending",
    },
    select: { id: true },
  });
  await audit({
    actorId: viewer.userId,
    action: "kyc.seller_submitted",
    targetType: "kyc_submission",
    targetId: submission.id,
    meta: { sellerType: input.sellerType, addressProofKind: input.addressProofKind, payout: payoutMasked, flags },
    ipAddress: meta.ipAddress,
  });
  return { ok: true, submissionId: submission.id };
}

export type SubmissionSummary = NonNullable<Awaited<ReturnType<typeof latestSubmissions>>["identity"]> & { status: KycStatus | string };
