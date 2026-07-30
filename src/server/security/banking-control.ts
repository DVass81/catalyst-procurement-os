import "server-only";

import { z } from "zod";

const noLongDigitSequence = (value: string) => !/[0-9]{9,}/.test(value);

export const bankingControlRequestSchema = z.object({
  tenantId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/i),
  applicationId: z.string().min(1).max(120),
  action: z.enum(["verify", "approve", "reject"]),
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  correlationId: z.string().uuid(),
  requestedAt: z.string().datetime(),
  rationale: z
    .string()
    .trim()
    .min(20)
    .max(2_000)
    .refine(
      noLongDigitSequence,
      "Rationale must not contain full banking numbers.",
    ),
  evidenceReference: z
    .string()
    .regex(
      /^(verification|approval)-case:[A-Za-z0-9._:-]{8,200}$/,
      "Use a governed verification or approval case reference.",
    )
    .refine(
      noLongDigitSequence,
      "Evidence reference must not contain full banking numbers.",
    ),
});

export type BankingControlRequest = z.infer<
  typeof bankingControlRequestSchema
>;
