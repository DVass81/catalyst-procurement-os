import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { DemoRole } from "@/demo/model";
import {
  createSupabasePrivateClient,
  createSupabaseServiceClient,
} from "@/server/supabase/admin";

export const SCIM_CORE_USER_SCHEMA =
  "urn:ietf:params:scim:schemas:core:2.0:User";
export const CATALYST_SCIM_EXTENSION =
  "urn:catalyst:params:scim:schemas:extension:2.0:User";

const scimRoles = new Set<DemoRole>([
  "requester",
  "department_manager",
  "it_reviewer",
  "purchasing_specialist",
  "purchasing_manager",
  "finance_reviewer",
  "compliance_reviewer",
  "receiving_clerk",
  "accounts_payable",
  "executive",
  "auditor",
  "supplier_user",
  "contract_manager",
  "security_reviewer",
  "operations_manager",
  "system_administrator",
]);

export interface ScimIdentityRecord {
  id: string;
  provider_key: "entra" | "saml";
  external_id: string;
  tenant_id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  active: boolean;
  roles: DemoRole[];
  provisioning_version: number;
  last_provisioned_at: string;
}

export function scimAuthorized(request: Request) {
  const configured = process.env.CATALYST_SCIM_BEARER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const received = Buffer.from(supplied);
  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

export function normalizeScimRoles(values: string[]) {
  const roles = [...new Set(values.map((role) => role.trim()))].sort();
  if (
    roles.length === 0 ||
    roles.some((role) => !scimRoles.has(role as DemoRole))
  ) {
    throw new Error("SCIM_ROLE_INVALID");
  }
  return roles as DemoRole[];
}

async function findAuthUserId(email: string) {
  const privateClient = createSupabasePrivateClient();
  const { data, error } = await privateClient.rpc(
    "find_auth_user_id_by_email",
    { p_email: email },
  );
  if (error) throw new Error(`SCIM_AUTH_LOOKUP_FAILED:${error.code}`);
  return typeof data === "string" ? data : null;
}

export async function findScimIdentity(id: string) {
  const client = createSupabasePrivateClient();
  const { data, error } = await client
    .from("scim_identities")
    .select(
      "id,provider_key,external_id,tenant_id,auth_user_id,email,display_name,active,roles,provisioning_version,last_provisioned_at",
    )
    .eq("id", id)
    .maybeSingle<ScimIdentityRecord>();
  if (error) throw new Error(`SCIM_IDENTITY_LOOKUP_FAILED:${error.code}`);
  return data;
}

export async function listScimIdentities(email?: string) {
  const client = createSupabasePrivateClient();
  let query = client
    .from("scim_identities")
    .select(
      "id,provider_key,external_id,tenant_id,auth_user_id,email,display_name,active,roles,provisioning_version,last_provisioned_at",
    )
    .order("last_provisioned_at", { ascending: false })
    .limit(100);
  if (email) query = query.eq("email", email.toLowerCase());
  const { data, error } = await query;
  if (error) throw new Error(`SCIM_IDENTITY_LIST_FAILED:${error.code}`);
  return (data ?? []) as ScimIdentityRecord[];
}

export async function provisionScimIdentity(input: {
  providerKey: "entra" | "saml";
  externalId: string;
  tenantId: string;
  email: string;
  displayName: string;
  active: boolean;
  roles: string[];
  correlationId: string;
  authUserId?: string;
}) {
  const roles = normalizeScimRoles(input.roles);
  const service = createSupabaseServiceClient();
  let authUserId =
    input.authUserId ?? (await findAuthUserId(input.email.toLowerCase()));
  let created = false;
  if (!authUserId) {
    const { data, error } = await service.auth.admin.createUser({
      email: input.email.toLowerCase(),
      email_confirm: true,
      app_metadata: {
        provisioning_source: "scim",
      },
      user_metadata: {
        display_name: input.displayName,
      },
    });
    if (error || !data.user) {
      throw new Error("SCIM_AUTH_USER_CREATE_FAILED");
    }
    authUserId = data.user.id;
    created = true;
  }

  try {
    if (!input.active) {
      const { error } = await service.auth.admin.updateUserById(authUserId, {
        ban_duration: "876000h",
      });
      if (error) throw new Error("SCIM_AUTH_USER_SUSPEND_FAILED");
    }

    const privateClient = createSupabasePrivateClient();
    const { data, error } = await privateClient.rpc("apply_scim_identity", {
      p_provider_key: input.providerKey,
      p_external_id: input.externalId,
      p_tenant_id: input.tenantId,
      p_auth_user_id: authUserId,
      p_email: input.email.toLowerCase(),
      p_display_name: input.displayName,
      p_active: input.active,
      p_roles: roles,
      p_correlation_id: input.correlationId,
    });
    if (error || !data) {
      throw new Error(`SCIM_PROVISIONING_FAILED:${error?.code ?? "NO_RESULT"}`);
    }

    if (input.active) {
      const { error: activationError } =
        await service.auth.admin.updateUserById(authUserId, {
          ban_duration: "none",
        });
      if (activationError) {
        throw new Error("SCIM_AUTH_USER_ACTIVATION_FAILED");
      }
    }
    return data as ScimIdentityRecord;
  } catch (error) {
    if (created) {
      await service.auth.admin.deleteUser(authUserId, true);
    }
    throw error;
  }
}

export function scimUser(record: ScimIdentityRecord, baseUrl: string) {
  return {
    schemas: [SCIM_CORE_USER_SCHEMA, CATALYST_SCIM_EXTENSION],
    id: record.id,
    externalId: record.external_id,
    userName: record.email,
    displayName: record.display_name,
    active: record.active,
    roles: record.roles.map((role) => ({ value: role, primary: true })),
    [CATALYST_SCIM_EXTENSION]: {
      tenantId: record.tenant_id,
      provisioningVersion: record.provisioning_version,
    },
    meta: {
      resourceType: "User",
      location: `${baseUrl}/api/scim/v2/Users/${record.id}`,
      lastModified: record.last_provisioned_at,
    },
  };
}
