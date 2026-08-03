import { NextResponse } from "next/server";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import {
  decideJitIdentityRequest,
  jitDecisionSchema,
  listPendingJitRequests,
} from "@/server/auth/jit";
import {
  requireRequestRoleCapability,
  resolveRequestRole,
} from "@/server/auth/request-role";
import { requireAppSession } from "@/server/auth/session";
import {
  consumeRateLimit,
  requestFingerprint,
} from "@/server/security/rate-limit";

const noStore = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

async function requireJitAdministrator(request: Request, tenantId: string) {
  const environment = assessRuntimeEnvironment();
  if (environment.kind !== "secure_pilot" || !environment.ready) {
    throw new Error("JIT_PILOT_ENVIRONMENT_REQUIRED");
  }
  const session = await requireAppSession(tenantId);
  const context = resolveRequestRole({
    request,
    session,
    tenantId,
    presenterRole: "system_administrator",
  });
  requireRequestRoleCapability({
    context,
    session,
    allowedRoles: ["system_administrator"],
    requireAal2: true,
  });
  if (!session.phishingResistant) {
    throw new Error("PHISHING_RESISTANT_AUTH_REQUIRED");
  }
  return session;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status =
    message === "AUTHENTICATION_REQUIRED"
      ? 401
      : message === "JIT_PILOT_ENVIRONMENT_REQUIRED"
        ? 503
        : message.includes("JIT_REQUEST_NOT_FOUND")
          ? 404
          : message.includes("ALREADY_DECIDED")
            ? 409
            : 403;
  const safe =
    message === "PHISHING_RESISTANT_AUTH_REQUIRED"
      ? "A verified phishing-resistant administrator sign-in is required."
      : message === "JIT_PILOT_ENVIRONMENT_REQUIRED"
        ? "JIT administration is unavailable until the secure pilot identity boundary is ready."
        : "The JIT identity request is unavailable or the active role is not authorized.";
  return NextResponse.json({ message: safe }, { status, headers: noStore });
}

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/i.test(tenantId)) {
    return NextResponse.json(
      { message: "A valid tenant is required." },
      { status: 400, headers: noStore },
    );
  }
  try {
    await requireJitAdministrator(request, tenantId);
    const requests = await listPendingJitRequests(tenantId);
    return NextResponse.json(
      {
        count: requests.length,
        requests: requests.map((item) => ({
          id: item.id,
          email: item.email,
          domain: item.domain,
          provider: item.provider_key,
          requestedRole: item.requested_role,
          requestedAt: item.requested_at,
          version: item.version,
        })),
      },
      { headers: noStore },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const rate = consumeRateLimit(
    `jit-decision:${requestFingerprint(request)}`,
    20,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "JIT decision limit reached. Try again later." },
      {
        status: 429,
        headers: {
          ...noStore,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }
  const parsed = jitDecisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "The JIT decision request is invalid." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const session = await requireJitAdministrator(
      request,
      parsed.data.tenantId,
    );
    const result = await decideJitIdentityRequest({
      requestId: parsed.data.requestId,
      actorId: session.userId,
      decision: parsed.data.decision,
      rationale: parsed.data.rationale,
      correlationId: parsed.data.correlationId,
    });
    return NextResponse.json(
      {
        id: result.id,
        status: result.status,
        requestedRole: result.requestedRole,
        version: result.version,
      },
      {
        headers: {
          ...noStore,
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
