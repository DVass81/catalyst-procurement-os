import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { authorizeMachineDataIntake } from "@/security/data-intake-policy";
import { createSupabasePrivateClient } from "@/server/supabase/admin";
import { verifySignedIntegrationRequest } from "@/server/integrations/signed-ingress";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "private, no-store",
  Vary: "X-Catalyst-Key-Id",
};

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `integration-event:${requestFingerprint(request)}`,
    60,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Integration ingress rate exceeded." },
      {
        status: 429,
        headers: {
          ...noStore,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json(
      { message: "Authoritative integration staging is unavailable." },
      { status: 503, headers: noStore },
    );
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 2_000_000) {
      return NextResponse.json(
        { message: "Integration event exceeds the two-megabyte limit." },
        { status: 413, headers: noStore },
      );
    }
    const verified = verifySignedIntegrationRequest({
      rawBody,
      keyRegistryJson: process.env.CATALYST_INTEGRATION_KEYS_JSON,
      headers: {
        keyId: request.headers.get("x-catalyst-key-id"),
        timestamp: request.headers.get("x-catalyst-timestamp"),
        idempotencyKey: request.headers.get(
          "x-catalyst-idempotency-key",
        ),
        signature: request.headers.get("x-catalyst-signature"),
      },
    });
    const environment = assessRuntimeEnvironment();
    authorizeMachineDataIntake({
      environmentKind: environment.kind,
      environmentReady: environment.ready,
      syntheticOnly: environment.syntheticOnly,
      classification: verified.event.dataClassification,
      synthetic: verified.event.synthetic,
      prohibitedDataAttestation:
        verified.event.prohibitedDataAttestation,
      pilotDataApprovalReference:
        verified.event.pilotDataApprovalReference,
    });

    const client = createSupabasePrivateClient();
    const { data, error } = await client.rpc(
      "record_integration_ingress",
      {
        p_tenant_id: verified.event.tenantId,
        p_event_id: verified.event.eventId,
        p_key_id: verified.keyId,
        p_request_sha256: verified.requestSha256,
        p_payload: verified.event,
      },
    );
    if (error) {
      if (`${error.message} ${error.details ?? ""}`.includes(
        "INTEGRATION_IDEMPOTENCY_KEY_REUSED",
      )) {
        return NextResponse.json(
          {
            message:
              "The integration event identifier was reused with different content.",
          },
          { status: 409, headers: noStore },
        );
      }
      throw new Error("INTEGRATION_STAGING_FAILED");
    }
    const result = (
      Array.isArray(data) ? data[0] : data
    ) as
      | {
          event_id: string;
          status: string;
          replayed: boolean;
          received_at: string;
        }
      | null;
    if (!result) throw new Error("INTEGRATION_STAGING_FAILED");

    return NextResponse.json(
      {
        eventId: result.event_id,
        status: result.status,
        replayed: result.replayed,
        receivedAt: result.received_at,
        externalPosting: "not_performed",
      },
      {
        status: result.replayed ? 200 : 202,
        headers: {
          ...noStore,
          "X-Catalyst-Command-Replayed": result.replayed ? "1" : "0",
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const denied =
      message.startsWith("INTEGRATION_SIGNATURE") ||
      message === "INTEGRATION_KEY_DENIED" ||
      message === "INTEGRATION_TENANT_KEY_MISMATCH" ||
      message.startsWith("DATA_INTAKE_") ||
      message.startsWith("SYNTHETIC_DATA_") ||
      message.startsWith("PILOT_DATA_");
    const invalid =
      error instanceof SyntaxError ||
      error instanceof ZodError ||
      message === "INTEGRATION_IDEMPOTENCY_KEY_INVALID" ||
      message === "INTEGRATION_EVENT_ID_MISMATCH" ||
      message === "INTEGRATION_KEY_REGISTRY_INVALID";
    return NextResponse.json(
      {
        message: denied
          ? "Integration signature validation failed."
          : invalid
            ? "Integration event validation failed."
            : "Authoritative integration staging failed.",
      },
      {
        status: denied ? 401 : invalid ? 400 : 503,
        headers: noStore,
      },
    );
  }
}
