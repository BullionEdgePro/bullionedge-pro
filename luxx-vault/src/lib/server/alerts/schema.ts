/** Input validation for price alerts (no I/O, shared by the server action and its tests). */
import { z } from "zod";
import { METAL_VALUES } from "@/config/catalog";
import { ALERT_CHANNELS, ALERT_DIRECTIONS, ALERT_KARATS } from "./logic";

const karatValues = new Set<number>(ALERT_KARATS);

export const createAlertSchema = z
  .object({
    metal: z.enum(METAL_VALUES),
    /** "pure" or a karat such as "18". Only gold takes a karat. */
    karat: z.string().trim().default("pure"),
    direction: z.enum(ALERT_DIRECTIONS),
    target: z
      .string()
      .trim()
      .transform((s) => Number(s.replace(/[₱,\s]/g, "") || "NaN"))
      .pipe(
        z
          .number({ error: "Enter a price per gram." })
          .positive("Enter a price above zero.")
          .max(10_000_000, "That price is too high to be real.")
          .multipleOf(0.01, "Use at most two decimal places."),
      ),
    channels: z.array(z.enum(ALERT_CHANNELS)).default([]),
  })
  .transform((v, ctx) => {
    let karat: number | null = null;
    if (v.karat !== "pure" && v.karat !== "") {
      const n = Number(v.karat);
      if (v.metal !== "gold" || !karatValues.has(n)) {
        ctx.addIssue({ code: "custom", path: ["karat"], message: "Choose a karat from the list." });
        return z.NEVER;
      }
      karat = n;
    }
    // The bell always gets it; email is on unless unticked in the form.
    const channels = [...new Set(["in_app", ...v.channels])];
    return { metal: v.metal, karat, direction: v.direction, target: v.target, channels };
  });

export type CreateAlertInput = z.infer<typeof createAlertSchema>;
