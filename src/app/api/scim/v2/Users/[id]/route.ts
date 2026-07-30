import { NextResponse } from "next/server";
import { z } from "zod";

import {
  findScimIdentity,
  provisionScimIdentity,
  scimAuthorized,
  scimUser,
} from "@/server/auth/scim";
import { resolvePublicOrigin } from "@/server/http/public-origin";

const patchSchema = z.object({
  schemas: z
    .array(z.string())
    .refine((schemas) =>
      schemas.includes("urn:ietf:params:scim:api:messages:2.0:PatchOp"),
    ),
  Operations: z
    .array(
      z.object({
        op: z.enum(["replace", "Replace", "REPLACE"]),
        path: z.enum(["active", "roles"]),
        value: z.unknown(),
      }),
    )
    .min(1)
    .max(10),
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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!scimAuthorized(request)) return scimError(401, "Unauthorized");
  const { id } = await context.params;
  try {
    const record = await findScimIdentity(id);
    if (!record) return scimError(404, "User not found");
    return NextResponse.json(
      scimUser(record, resolvePublicOrigin(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return scimError(503, "Provisioning directory unavailable");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!scimAuthorized(request)) return scimError(401, "Unauthorized");
  if (process.env.CATALYST_SCIM_ENABLED !== "1") {
    return scimError(404, "SCIM is disabled");
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return scimError(400, "Invalid SCIM patch");
  const { id } = await context.params;
  try {
    const current = await findScimIdentity(id);
    if (!current) return scimError(404, "User not found");
    let active = current.active;
    let roles = [...current.roles];
    for (const operation of parsed.data.Operations) {
      if (operation.path === "active") {
        if (typeof operation.value !== "boolean") {
          return scimError(400, "active must be boolean");
        }
        active = operation.value;
      } else {
        const roleResult = z
          .array(z.object({ value: z.string().trim().min(1).max(80) }))
          .min(1)
          .max(16)
          .safeParse(operation.value);
        if (!roleResult.success) return scimError(400, "roles are invalid");
        roles = roleResult.data.map((role) => role.value) as typeof roles;
      }
    }
    const updated = await provisionScimIdentity({
      providerKey: current.provider_key,
      externalId: current.external_id,
      tenantId: current.tenant_id,
      email: current.email,
      displayName: current.display_name,
      active,
      roles,
      correlationId: crypto.randomUUID(),
      authUserId: current.auth_user_id,
    });
    return NextResponse.json(
      scimUser(updated, resolvePublicOrigin(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return scimError(409, "The SCIM update could not be applied");
  }
}
