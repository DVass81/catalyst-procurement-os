import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CATALYST_SCIM_EXTENSION,
  listScimIdentities,
  provisionScimIdentity,
  SCIM_CORE_USER_SCHEMA,
  scimAuthorized,
  scimUser,
} from "@/server/auth/scim";
import { resolvePublicOrigin } from "@/server/http/public-origin";

const userSchema = z.object({
  schemas: z.array(z.string()).refine((schemas) =>
    schemas.includes(SCIM_CORE_USER_SCHEMA),
  ),
  externalId: z.string().trim().min(1).max(240),
  userName: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(240),
  active: z.boolean().default(true),
  roles: z
    .array(z.object({ value: z.string().trim().min(1).max(80) }))
    .min(1)
    .max(16),
  [CATALYST_SCIM_EXTENSION]: z.object({
    tenantId: z.string().trim().min(1).max(80),
  }),
});

function scimError(status: number, detail: string) {
  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      detail,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  if (!scimAuthorized(request)) return scimError(401, "Unauthorized");
  if (process.env.CATALYST_SCIM_ENABLED !== "1") {
    return scimError(404, "SCIM is disabled");
  }
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "";
  const match = filter.match(/^userName eq "([^"]+)"$/i);
  if (filter && !match) {
    return scimError(400, "Only an exact userName filter is supported");
  }
  try {
    const records = await listScimIdentities(match?.[1]);
    const baseUrl = resolvePublicOrigin(request);
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults: records.length,
        startIndex: 1,
        itemsPerPage: records.length,
        Resources: records.map((record) => scimUser(record, baseUrl)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return scimError(503, "Provisioning directory unavailable");
  }
}

export async function POST(request: Request) {
  if (!scimAuthorized(request)) return scimError(401, "Unauthorized");
  if (process.env.CATALYST_SCIM_ENABLED !== "1") {
    return scimError(404, "SCIM is disabled");
  }
  const parsed = userSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return scimError(400, "Invalid SCIM user payload");
  try {
    const record = await provisionScimIdentity({
      providerKey: "entra",
      externalId: parsed.data.externalId,
      tenantId: parsed.data[CATALYST_SCIM_EXTENSION].tenantId,
      email: parsed.data.userName,
      displayName: parsed.data.displayName,
      active: parsed.data.active,
      roles: parsed.data.roles.map((role) => role.value),
      correlationId: crypto.randomUUID(),
    });
    return NextResponse.json(
      scimUser(record, resolvePublicOrigin(request)),
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          Location: `${resolvePublicOrigin(request)}/api/scim/v2/Users/${record.id}`,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return scimError(
      message.includes("ROLE_INVALID") ? 400 : 409,
      "The SCIM identity could not be provisioned",
    );
  }
}
