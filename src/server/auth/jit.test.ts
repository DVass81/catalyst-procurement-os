import { describe, expect, it } from "vitest";

import { jitDecisionSchema } from "@/server/auth/jit";

describe("governed JIT decision contract", () => {
  it("requires an independent decision rationale and correlation identifier", () => {
    expect(
      jitDecisionSchema.parse({
        tenantId: "pilot-tenant",
        requestId: "12345678-1234-4123-8123-123456789012",
        decision: "approve",
        rationale:
          "Approved the least-privilege requester role after identity and employment review.",
        correlationId: "22345678-1234-4123-8123-123456789012",
      }),
    ).toMatchObject({ decision: "approve" });
    expect(
      jitDecisionSchema.safeParse({
        tenantId: "pilot-tenant",
        requestId: "12345678-1234-4123-8123-123456789012",
        decision: "approve",
        rationale: "Approved",
        correlationId: "22345678-1234-4123-8123-123456789012",
      }).success,
    ).toBe(false);
  });
});
