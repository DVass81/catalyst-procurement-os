import { describe, expect, it } from "vitest";

import { bankingControlRequestSchema } from "@/server/security/banking-control";

const valid = {
  tenantId: "pilot-tenant",
  applicationId: "supplier-application-1",
  action: "verify" as const,
  expectedRevision: 12,
  idempotencyKey: "12345678-1234-4123-8123-123456789012",
  correlationId: "22345678-1234-4123-8123-123456789012",
  requestedAt: "2026-07-29T18:00:00.000Z",
  rationale:
    "Known supplier contact confirmed the change through an approved out-of-band channel.",
  evidenceReference: "verification-case:case-verified-001",
};

describe("banking control request", () => {
  it("accepts a governed evidence reference without banking values", () => {
    expect(bankingControlRequestSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects banking-number-like values in rationale or evidence", () => {
    expect(
      bankingControlRequestSchema.safeParse({
        ...valid,
        rationale: "Verified account 123456789 through the known contact.",
      }).success,
    ).toBe(false);
    expect(
      bankingControlRequestSchema.safeParse({
        ...valid,
        evidenceReference: "verification-case:123456789",
      }).success,
    ).toBe(false);
  });
});
