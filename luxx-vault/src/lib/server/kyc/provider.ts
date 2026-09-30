import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Identity verification vendor behind one interface (brief §8: "Do not
 * hand-roll face recognition"). A live adapter (Sumsub, Veriff, Persona…)
 * captures the ID and selfie in its own SDK, stores the images in its vault
 * and reports liveness and face-match scores. Until one is contracted, the
 * mock below runs by default and says so on every screen.
 *
 * Settings, read here rather than in env.ts:
 *   KYC_PROVIDER                   mock (default). Live adapters are added here.
 *   ALLOW_MOCK_KYC_IN_PRODUCTION   "true" to allow the mock on a public deployment (demos only)
 */

/** What the applicant's device measured. Untrusted: it only informs the reviewer. */
export const deviceChecksSchema = z.object({
  front: z.object({ sharpness: z.number().min(0).max(1e6), glare: z.number().min(0).max(1), ok: z.boolean(), source: z.enum(["camera", "upload"]) }),
  back: z.object({ sharpness: z.number().min(0).max(1e6), glare: z.number().min(0).max(1), ok: z.boolean(), source: z.enum(["camera", "upload"]) }).nullable(),
  liveness: z.object({
    prompts: z.array(z.object({ prompt: z.enum(["center", "left", "right", "blink"]), movement: z.number().min(0).max(255), passed: z.boolean() })).max(8),
    framesCaptured: z.number().int().min(0).max(64),
  }),
});
export type DeviceChecks = z.infer<typeof deviceChecksSchema>;

export type IdentityAssessment = {
  provider: string;
  providerRef: string | null;
  /** 0..1, or null when the provider did not measure it. */
  livenessScore: number | null;
  faceMatchScore: number | null;
  flags: string[];
};

export interface KycProvider {
  readonly name: "mock";
  /** True when no real identity checks run and every screen must say so. */
  readonly isTest: boolean;
  /** Whether ID and selfie images leave the device (to the vendor's vault). */
  readonly storesImages: boolean;
  assessIdentity(input: { userId: string; idType: string; device: DeviceChecks }): Promise<IdentityAssessment>;
}

/**
 * Test mode. Photos are checked on the applicant's device and discarded;
 * nothing is uploaded or stored. It cannot compare a face with the ID photo,
 * so it reports no face-match score and says why. Its liveness number is only
 * the share of on-screen prompts where the device saw movement. It never
 * approves anything: every submission waits for a human reviewer.
 */
class MockKycProvider implements KycProvider {
  readonly name = "mock" as const;
  readonly isTest = true;
  readonly storesImages = false;

  async assessIdentity({ device }: { userId: string; idType: string; device: DeviceChecks }): Promise<IdentityAssessment> {
    const prompts = device.liveness.prompts;
    const liveness = prompts.length ? prompts.filter((p) => p.passed).length / prompts.length : 0;
    const flags = ["face_match_unavailable"];
    if (!device.front.ok || (device.back && !device.back.ok)) flags.push("low_image_quality");
    return { provider: this.name, providerRef: `mock_${randomUUID()}`, livenessScore: Math.round(liveness * 100) / 100, faceMatchScore: null, flags };
  }
}

const settingsSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    KYC_PROVIDER: z.enum(["mock"]).default("mock"),
    ALLOW_MOCK_KYC_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
    BETTER_AUTH_URL: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    const isPublic = s.NODE_ENV === "production" && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(s.BETTER_AUTH_URL ?? "");
    if (isPublic && s.KYC_PROVIDER === "mock" && s.ALLOW_MOCK_KYC_IN_PRODUCTION !== "true") {
      ctx.addIssue({ code: "custom", path: ["KYC_PROVIDER"], message: "Mock identity checks on a public deployment need ALLOW_MOCK_KYC_IN_PRODUCTION=true" });
    }
  });

let provider: KycProvider | undefined;

export function kycProvider(): KycProvider {
  if (!provider) {
    const parsed = settingsSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid KYC settings:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
    }
    provider = new MockKycProvider();
  }
  return provider;
}
