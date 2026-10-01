import "server-only";
import { z } from "zod";
import { deviceChecksSchema } from "../kyc/provider";

/**
 * Face re-verification for people whose ID is already verified (owner,
 * 1 Oct 2026). Brief §8: never hand-roll face recognition. A live adapter
 * compares a fresh liveness capture with the face enrolled during the ID
 * check, in the vendor's own SDK and vault:
 *   - the identity vendor's re-verification flow (Sumsub, Veriff, Persona), or
 *   - AWS Rekognition Face Liveness + CompareFaces against the enrolled face.
 * Until one is contracted, the mock runs and every screen says so.
 *
 * Settings, read here rather than in env.ts:
 *   FACE_PROVIDER                   mock (default). Live adapters are added here.
 *   ALLOW_MOCK_FACE_IN_PRODUCTION   "true" to allow the mock on a public deployment (demos only)
 */

export const livenessSchema = deviceChecksSchema.shape.liveness;
export type LivenessInput = z.infer<typeof livenessSchema>;

export type FaceAssessment = {
  provider: string;
  providerRef: string | null;
  passed: boolean;
  /** 0..1, or null when the provider did not measure it. */
  livenessScore: number | null;
  faceMatchScore: number | null;
  flags: string[];
};

export interface FaceProvider {
  readonly name: "mock";
  /** True when no real face comparison runs and every screen must say so. */
  readonly isTest: boolean;
  verify(input: { userId: string; liveness: LivenessInput }): Promise<FaceAssessment>;
}

/**
 * Test mode. The device confirms a face moved on cue (look ahead, turn left,
 * turn right, blink); frames are compared on the device and thrown away.
 * It cannot tell WHOSE face it is, so it reports no match score and flags
 * that. It passes when at least three of the four prompts registered movement.
 */
class MockFaceProvider implements FaceProvider {
  readonly name = "mock" as const;
  readonly isTest = true;

  async verify({ liveness }: { userId: string; liveness: LivenessInput }): Promise<FaceAssessment> {
    const prompts = liveness.prompts;
    const passedPrompts = prompts.filter((p) => p.passed).length;
    const score = prompts.length ? passedPrompts / prompts.length : 0;
    const flags = ["face_match_unavailable"];
    if (passedPrompts < 3) flags.push("low_liveness");
    return { provider: "mock", providerRef: null, passed: passedPrompts >= 3, livenessScore: score, faceMatchScore: null, flags };
  }
}

const settingsSchema = z
  .object({
    FACE_PROVIDER: z.enum(["mock"]).default("mock"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    BETTER_AUTH_URL: z.string().optional(),
    ALLOW_MOCK_FACE_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
  })
  .superRefine((s, ctx) => {
    const isPublic = s.NODE_ENV === "production" && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(s.BETTER_AUTH_URL ?? "");
    if (isPublic && s.FACE_PROVIDER === "mock" && s.ALLOW_MOCK_FACE_IN_PRODUCTION !== "true") {
      ctx.addIssue({ code: "custom", path: ["FACE_PROVIDER"], message: "Mock face checks on a public deployment need ALLOW_MOCK_FACE_IN_PRODUCTION=true" });
    }
  });

let cached: FaceProvider | undefined;

export function faceProvider(): FaceProvider {
  if (!cached) {
    const s = settingsSchema.parse(process.env);
    switch (s.FACE_PROVIDER) {
      case "mock":
        cached = new MockFaceProvider();
        break;
    }
  }
  return cached;
}
