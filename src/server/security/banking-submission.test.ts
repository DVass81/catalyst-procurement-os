import { describe, expect, it } from "vitest";

import {
  bankingInstructionFingerprint,
  bankingProposalRequestSchema,
  buildBankingPlaintext,
  maskedBankingMetadata,
} from "@/server/security/banking-submission";

const valid = {
  tenantId: "pilot-tenant",
  applicationId: "supplier-application-1",
  expectedRevision: 12,
  idempotencyKey: "12345678-1234-4123-8123-123456789012",
  correlationId: "22345678-1234-4123-8123-123456789012",
  requestedAt: "2026-07-29T18:00:00.000Z",
  routingNumber: "021000021",
  accountNumber: "123456789",
  confirmAccountNumber: "123456789",
  rationale:
    "Supplier submitted a new payment instruction for independent verification.",
};

describe("secure supplier banking proposal", () => {
  it("validates ABA checksum and matching account confirmation", () => {
    expect(bankingProposalRequestSchema.parse(valid)).toMatchObject(valid);
    expect(
      bankingProposalRequestSchema.safeParse({
        ...valid,
        routingNumber: "021000022",
      }).success,
    ).toBe(false);
    expect(
      bankingProposalRequestSchema.safeParse({
        ...valid,
        confirmAccountNumber: "123456788",
      }).success,
    ).toBe(false);
  });

  it("returns only masked metadata separately from encrypted plaintext", () => {
    const plaintext = buildBankingPlaintext(valid);
    expect(plaintext.toString("utf8")).toContain("123456789");
    plaintext.fill(0);
    expect(maskedBankingMetadata(valid)).toEqual({
      routingLastFour: "0021",
      accountLastFour: "6789",
    });
  });

  it("creates a stable secret-keyed fingerprint without exposing account data", () => {
    const first = bankingInstructionFingerprint({
      ...valid,
      supplierOrganizationId: "supplier-org-1",
      secret: "a-secure-test-secret-that-is-at-least-32-bytes",
    });
    const replay = bankingInstructionFingerprint({
      ...valid,
      supplierOrganizationId: "supplier-org-1",
      secret: "a-secure-test-secret-that-is-at-least-32-bytes",
    });
    const changed = bankingInstructionFingerprint({
      ...valid,
      accountNumber: "223456789",
      supplierOrganizationId: "supplier-org-1",
      secret: "a-secure-test-secret-that-is-at-least-32-bytes",
    });
    expect(first).toBe(replay);
    expect(first).not.toBe(changed);
    expect(first).not.toContain(valid.accountNumber);
  });
});
