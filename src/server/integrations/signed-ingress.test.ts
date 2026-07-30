import { describe, expect, it } from "vitest";

import {
  signIntegrationPayload,
  verifySignedIntegrationRequest,
} from "@/server/integrations/signed-ingress";

const secret = "qualification-secret-that-is-at-least-32-characters";
const eventId = "11111111-1111-4111-8111-111111111111";
const timestamp = "1785355200";
const now = new Date(Number(timestamp) * 1_000);
const registry = JSON.stringify({
  "reference-ledger": {
    tenantId: "org-y12-demo",
    secret,
    status: "active",
  },
});

function body(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schema: "catalyst.integration-event.v1",
    eventId,
    correlationId: "22222222-2222-4222-8222-222222222222",
    tenantId: "org-y12-demo",
    sourceSystem: "Vendor-neutral reference ledger",
    entityType: "invoice",
    operation: "upsert",
    expectedRevision: 12,
    occurredAt: "2026-07-29T12:00:00.000Z",
    dataClassification: "synthetic_demo",
    synthetic: true,
    prohibitedDataAttestation: false,
    records: [
      { sourceId: "INV-001", amountCents: 12500 },
      { sourceId: "INV-002", amountCents: -2500 },
    ],
    controlTotals: { recordCount: 2, amountCents: 10000 },
    ...overrides,
  });
}

function verify(rawBody: string, signature?: string) {
  return verifySignedIntegrationRequest({
    rawBody,
    keyRegistryJson: registry,
    now,
    headers: {
      keyId: "reference-ledger",
      timestamp,
      idempotencyKey: eventId,
      signature:
        signature ??
        signIntegrationPayload({ rawBody, timestamp, secret }),
    },
  });
}

describe("signed vendor-neutral integration ingress", () => {
  it("accepts a fresh tenant-bound event with reconciled totals", () => {
    expect(verify(body())).toMatchObject({
      keyId: "reference-ledger",
      event: {
        tenantId: "org-y12-demo",
        controlTotals: { recordCount: 2, amountCents: 10000 },
      },
      requestSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it("rejects tampering, tenant crossover, and stale signatures", () => {
    expect(() => verify(body(), `v1=${"0".repeat(64)}`)).toThrow(
      "INTEGRATION_SIGNATURE_INVALID",
    );
    expect(() =>
      verify(body({ tenantId: "org-catalyst-community-demo" })),
    ).toThrow("INTEGRATION_TENANT_KEY_MISMATCH");
    const rawBody = body();
    expect(() =>
      verifySignedIntegrationRequest({
        rawBody,
        keyRegistryJson: registry,
        now: new Date((Number(timestamp) + 301) * 1_000),
        headers: {
          keyId: "reference-ledger",
          timestamp,
          idempotencyKey: eventId,
          signature: signIntegrationPayload({
            rawBody,
            timestamp,
            secret,
          }),
        },
      }),
    ).toThrow("INTEGRATION_SIGNATURE_STALE");
  });

  it("rejects unreconciled count and amount controls", () => {
    expect(() =>
      verify(
        body({
          controlTotals: { recordCount: 1, amountCents: 9999 },
        }),
      ),
    ).toThrow();
  });
});
