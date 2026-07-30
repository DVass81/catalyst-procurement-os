import "server-only";

import { createHmac } from "node:crypto";

import { z } from "zod";

function hasValidAbaChecksum(value: string) {
  if (!/^[0-9]{9}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const checksum =
    3 * (digits[0]! + digits[3]! + digits[6]!) +
    7 * (digits[1]! + digits[4]! + digits[7]!) +
    (digits[2]! + digits[5]! + digits[8]!);
  return checksum !== 0 && checksum % 10 === 0;
}

export const bankingProposalRequestSchema = z
  .object({
    tenantId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/i),
    applicationId: z.string().min(1).max(120),
    expectedRevision: z.number().int().nonnegative(),
    idempotencyKey: z.string().uuid(),
    correlationId: z.string().uuid(),
    requestedAt: z.string().datetime(),
    routingNumber: z
      .string()
      .regex(/^[0-9]{9}$/)
      .refine(hasValidAbaChecksum, "Routing number checksum is invalid."),
    accountNumber: z.string().regex(/^[0-9]{4,17}$/),
    confirmAccountNumber: z.string().regex(/^[0-9]{4,17}$/),
    rationale: z.string().trim().min(20).max(2_000),
  })
  .superRefine((value, context) => {
    if (value.accountNumber !== value.confirmAccountNumber) {
      context.addIssue({
        code: "custom",
        path: ["confirmAccountNumber"],
        message: "Account number confirmation does not match.",
      });
    }
  });

export type BankingProposalRequest = z.infer<
  typeof bankingProposalRequestSchema
>;

export function buildBankingPlaintext(input: {
  routingNumber: string;
  accountNumber: string;
}) {
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      routingNumber: input.routingNumber,
      accountNumber: input.accountNumber,
    }),
    "utf8",
  );
}

export function maskedBankingMetadata(input: {
  routingNumber: string;
  accountNumber: string;
}) {
  return {
    routingLastFour: input.routingNumber.slice(-4),
    accountLastFour: input.accountNumber.slice(-4),
  };
}

export function bankingInstructionFingerprint(input: {
  tenantId: string;
  supplierOrganizationId: string;
  routingNumber: string;
  accountNumber: string;
  secret?: string;
}) {
  const secret =
    input.secret ?? process.env.CATALYST_BANKING_FINGERPRINT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("BANKING_FINGERPRINT_SECRET_UNAVAILABLE");
  }
  return createHmac("sha256", secret)
    .update(
      [
        "catalyst-banking-v1",
        input.tenantId,
        input.supplierOrganizationId,
        input.routingNumber,
        input.accountNumber,
      ].join("|"),
      "utf8",
    )
    .digest("hex");
}
