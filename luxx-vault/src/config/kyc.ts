/**
 * Identity and seller verification settings (brief §8). One list the owner
 * can edit: which Philippine IDs are accepted, what proof a seller gives,
 * and the thresholds the checks use. Safe on client and server.
 */

export const MIN_AGE = 18;

export type IdType = {
  value: string;
  label: string;
  /** Who issues it, shown under the label. */
  issuer: string;
  /** Whether the back carries information we ask to see. */
  hasBack: boolean;
  /** Whether the card shows an expiry date. */
  hasExpiry: boolean;
  /** Placeholder for the number field (format hint only, never validated against real registries). */
  numberHint: string;
};

/** Accepted Philippine government IDs. Order = how common they are among applicants. */
export const ID_TYPES = [
  { value: "philsys", label: "PhilSys National ID (PhilID or ePhilID)", issuer: "Philippine Statistics Authority", hasBack: true, hasExpiry: false, numberHint: "PCN or PhilSys card number" },
  { value: "drivers_license", label: "Driver's license", issuer: "Land Transportation Office", hasBack: true, hasExpiry: true, numberHint: "e.g. N01-23-456789" },
  { value: "passport", label: "Passport", issuer: "Department of Foreign Affairs", hasBack: false, hasExpiry: true, numberHint: "e.g. P1234567A" },
  { value: "umid", label: "UMID", issuer: "SSS / GSIS", hasBack: true, hasExpiry: false, numberHint: "CRN, e.g. 0111-2345678-9" },
  { value: "sss", label: "SSS ID", issuer: "Social Security System", hasBack: true, hasExpiry: false, numberHint: "e.g. 34-1234567-8" },
  { value: "prc", label: "PRC ID", issuer: "Professional Regulation Commission", hasBack: true, hasExpiry: true, numberHint: "Registration number" },
  { value: "postal", label: "Postal ID", issuer: "PHLPost", hasBack: true, hasExpiry: true, numberHint: "PRN on the card" },
  { value: "philhealth", label: "PhilHealth ID", issuer: "PhilHealth", hasBack: true, hasExpiry: false, numberHint: "e.g. 12-345678901-2" },
  { value: "tin", label: "TIN ID", issuer: "Bureau of Internal Revenue", hasBack: true, hasExpiry: false, numberHint: "e.g. 123-456-789-000" },
  { value: "senior_citizen", label: "Senior citizen ID", issuer: "OSCA / your city or municipality", hasBack: true, hasExpiry: false, numberHint: "OSCA ID number" },
  { value: "pwd", label: "PWD ID", issuer: "PDAO / your city or municipality", hasBack: true, hasExpiry: true, numberHint: "PWD ID number" },
  { value: "voters", label: "Voter's ID or voter's certification", issuer: "Commission on Elections", hasBack: true, hasExpiry: false, numberHint: "VIN or precinct reference" },
  { value: "ofw", label: "OFW / OWWA ID", issuer: "DMW / OWWA", hasBack: true, hasExpiry: true, numberHint: "OFW ID number" },
  { value: "school", label: "School ID (college, 18 and over only)", issuer: "Your school", hasBack: true, hasExpiry: true, numberHint: "Student number" },
] as const satisfies readonly IdType[];

export type IdTypeValue = (typeof ID_TYPES)[number]["value"];
export const ID_TYPE_VALUES = ID_TYPES.map((t) => t.value) as unknown as readonly [IdTypeValue, ...IdTypeValue[]];
export const idTypeOf = (value: string | null | undefined): IdType | undefined => ID_TYPES.find((t) => t.value === value);
export const idTypeLabel = (value: string | null | undefined) => idTypeOf(value)?.label ?? "ID";

// ------------------------------------------------------------ seller (Tier 4)

/** Proof of address, dated within the last three months. */
export const ADDRESS_PROOF_KINDS = [
  { value: "utility_bill", label: "Utility bill (electricity, water, internet, phone)" },
  { value: "bank_statement", label: "Bank or e-wallet statement" },
  { value: "barangay_certificate", label: "Barangay certificate of residency" },
] as const;
export type AddressProofKind = (typeof ADDRESS_PROOF_KINDS)[number]["value"];
export const ADDRESS_PROOF_MAX_AGE_DAYS = 92;

/** Registration a business seller holds (plus the BIR Certificate of Registration). */
export const BUSINESS_REG_KINDS = [
  { value: "dti", label: "DTI business name registration (sole proprietor)" },
  { value: "sec", label: "SEC registration (corporation, OPC or partnership)" },
] as const;
export type BusinessRegKind = (typeof BUSINESS_REG_KINDS)[number]["value"];
export const BIR_COR_LABEL = "BIR Certificate of Registration (Form 2303)";

export const PAYOUT_KINDS = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank account" },
] as const;
export type PayoutKind = (typeof PAYOUT_KINDS)[number]["value"];

// ------------------------------------------------------------ review

export const KYC_STATUSES = {
  pending: { label: "Pending review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  needs_resubmission: { label: "Needs resubmission", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
} as const;
export type KycStatus = keyof typeof KYC_STATUSES;

/** Flags raised by our own rules or the provider, in plain words for reviewers and applicants. */
export const KYC_FLAGS: Record<string, { label: string; severity: "high" | "medium" | "info" }> = {
  underage: { label: "Under 18 by the date of birth given", severity: "high" },
  expired_id: { label: "ID has expired", severity: "high" },
  name_mismatch: { label: "Name doesn't match the account name", severity: "medium" },
  duplicate_id: { label: "Same ID already used by another account", severity: "high" },
  duplicate_face: { label: "Face matches another account", severity: "high" },
  low_liveness: { label: "Liveness check below threshold", severity: "medium" },
  low_face_match: { label: "Face match below threshold", severity: "medium" },
  low_image_quality: { label: "ID photo blurry or glaring", severity: "medium" },
  face_match_unavailable: { label: "No face match performed (test mode)", severity: "info" },
  payout_name_mismatch: { label: "Payout account name differs from the ID name", severity: "high" },
  no_two_factor: { label: "Two-step sign-in is off", severity: "info" },
};
export const flagLabel = (flag: string) => KYC_FLAGS[flag]?.label ?? flag.replace(/_/g, " ");

/** Provider scores below these raise a flag for the reviewer. */
export const SCORE_THRESHOLDS = { liveness: 0.8, faceMatch: 0.85 } as const;

/** On-device photo checks (see components/verification/image-quality.ts). */
export const IMAGE_QUALITY = {
  /** Variance of the Laplacian on a 640px-wide greyscale copy; below this the photo is too soft to read. */
  minSharpness: 60,
  /** Share of blown-out pixels in the frame; above this a reflection is probably hiding text. */
  maxGlare: 0.035,
} as const;

/** Masked for display anywhere, staff screens included (brief §8). */
export function maskIdNumber(last4: string | null | undefined): string {
  return last4 ? `••••-${last4}` : "••••";
}
