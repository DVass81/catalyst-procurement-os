import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { z } from "zod";

import { dataIntakeClassifications } from "@/security/data-intake-policy";

const integrationRecordSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(160),
    amountCents: z.number().int().safe().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const signedIntegrationEventSchema = z
  .object({
    schema: z.literal("catalyst.integration-event.v1"),
    eventId: z.string().uuid(),
    correlationId: z.string().uuid(),
    tenantId: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
    sourceSystem: z.string().trim().min(1).max(160),
    entityType: z.enum([
      "purchase_request",
      "purchase_order",
      "receipt",
      "invoice",
      "supplier",
    ]),
    operation: z.enum(["upsert", "reverse"]),
    expectedRevision: z.number().int().nonnegative(),
    occurredAt: z.string().datetime({ offset: true }),
    dataClassification: z.enum(dataIntakeClassifications),
    synthetic: z.boolean(),
    prohibitedDataAttestation: z.boolean(),
    pilotDataApprovalReference: z.string().trim().max(160).optional(),
    records: z.array(integrationRecordSchema).min(1).max(500),
    controlTotals: z.object({
      recordCount: z.number().int().positive().max(500),
      amountCents: z.number().int().safe(),
    }),
  })
  .superRefine((event, context) => {
    if (
      (event.dataClassification === "synthetic_demo") !== event.synthetic
    ) {
      context.addIssue({
        code: "custom",
        path: ["dataClassification"],
        message: "DATA_CLASSIFICATION_SYNTHETIC_MISMATCH",
      });
    }
    if (
      event.dataClassification === "approved_pilot_procurement" &&
      (!event.prohibitedDataAttestation ||
        !event.pilotDataApprovalReference)
    ) {
      context.addIssue({
        code: "custom",
        path: ["pilotDataApprovalReference"],
        message: "PILOT_DATA_APPROVAL_REQUIRED",
      });
    }
    if (event.controlTotals.recordCount !== event.records.length) {
      context.addIssue({
        code: "custom",
        path: ["controlTotals", "recordCount"],
        message: "CONTROL_COUNT_MISMATCH",
      });
    }
    const recordTotal = event.records.reduce(
      (total, record) => total + (record.amountCents ?? 0),
      0,
    );
    if (event.controlTotals.amountCents !== recordTotal) {
      context.addIssue({
        code: "custom",
        path: ["controlTotals", "amountCents"],
        message: "CONTROL_AMOUNT_MISMATCH",
      });
    }
  });

export type SignedIntegrationEvent = z.infer<
  typeof signedIntegrationEventSchema
>;

interface IntegrationKey {
  tenantId: string;
  secret: string;
  status: "active" | "disabled";
}

interface IntegrationKeyRegistry {
  [keyId: string]: IntegrationKey;
}

export interface SignedIntegrationHeaders {
  keyId: string | null;
  timestamp: string | null;
  idempotencyKey: string | null;
  signature: string | null;
}

const maximumAgeSeconds = 300;
const signaturePattern = /^v1=([0-9a-f]{64})$/;

function parseKeyRegistry(raw: string | undefined) {
  if (!raw) throw new Error("INTEGRATION_KEY_REGISTRY_UNAVAILABLE");
  const parsed = z
    .record(
      z.string().trim().min(1).max(120),
      z.object({
        tenantId: z
          .string()
          .trim()
          .regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
        secret: z.string().min(32).max(512),
        status: z.enum(["active", "disabled"]),
      }),
    )
    .safeParse(JSON.parse(raw) as unknown);
  if (!parsed.success) throw new Error("INTEGRATION_KEY_REGISTRY_INVALID");
  return parsed.data as IntegrationKeyRegistry;
}

export function signIntegrationPayload(input: {
  rawBody: string;
  timestamp: string;
  secret: string;
}) {
  return `v1=${createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex")}`;
}

export function verifySignedIntegrationRequest(input: {
  rawBody: string;
  headers: SignedIntegrationHeaders;
  keyRegistryJson?: string;
  now?: Date;
}) {
  const { keyId, timestamp, idempotencyKey, signature } = input.headers;
  if (!keyId || !timestamp || !idempotencyKey || !signature) {
    throw new Error("INTEGRATION_SIGNATURE_HEADERS_REQUIRED");
  }
  if (!z.string().uuid().safeParse(idempotencyKey).success) {
    throw new Error("INTEGRATION_IDEMPOTENCY_KEY_INVALID");
  }
  const timestampNumber = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (
    !Number.isSafeInteger(timestampNumber) ||
    Math.abs(nowSeconds - timestampNumber) > maximumAgeSeconds
  ) {
    throw new Error("INTEGRATION_SIGNATURE_STALE");
  }
  const registry = parseKeyRegistry(input.keyRegistryJson);
  const key = registry[keyId];
  if (!key || key.status !== "active") {
    throw new Error("INTEGRATION_KEY_DENIED");
  }
  const matched = signaturePattern.exec(signature);
  if (!matched) throw new Error("INTEGRATION_SIGNATURE_INVALID");
  const expected = signIntegrationPayload({
    rawBody: input.rawBody,
    timestamp,
    secret: key.secret,
  });
  const providedBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  ) {
    throw new Error("INTEGRATION_SIGNATURE_INVALID");
  }
  const event = signedIntegrationEventSchema.parse(
    JSON.parse(input.rawBody) as unknown,
  );
  if (event.tenantId !== key.tenantId) {
    throw new Error("INTEGRATION_TENANT_KEY_MISMATCH");
  }
  if (event.eventId !== idempotencyKey) {
    throw new Error("INTEGRATION_EVENT_ID_MISMATCH");
  }
  return {
    event,
    keyId,
    requestSha256: createHash("sha256")
      .update(input.rawBody)
      .digest("hex"),
  };
}
