import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEVELOPMENT_BYPASS_EXPIRES_AT,
  DEVELOPMENT_BYPASS_TENANT_IDS,
  isDevelopmentBypassExpiration,
  resolveDevelopmentBypass,
} from "@/server/auth/development-bypass";
import {
  demoRoles,
  normalizeAssuranceLevel,
  type ActiveRoleAssignment,
  type AssuranceLevel,
  type SupplierAccess,
  type TenantAuthority,
  type TenantIdentityPolicy,
} from "@/server/auth/authority";
import {
  deriveVerifiedAuthenticationContext,
  type VerifiedAuthenticationContext,
} from "@/server/auth/authentication-assurance";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

export interface AppSession {
  userId: string;
  email: string;
  role: string;
  tenantIds: string[];
  presenter: boolean;
  assuranceLevel: AssuranceLevel;
  nextAssuranceLevel: AssuranceLevel;
  authenticationMethods: string[];
  identityProvider?: "entra" | "saml";
  phishingResistant: boolean;
  authorities: Record<string, TenantAuthority>;
  mode: "supabase" | "preview" | "staging_bypass";
}

export function auditActorRole(session: AppSession) {
  return session.mode === "staging_bypass"
    ? "staging_bypass_presenter"
    : session.role;
}

type TenantAssignment = { tenant_id: string; role: string };
type RoleAssignmentRow = {
  tenant_id: string;
  role: string;
  assignment_type: ActiveRoleAssignment["assignmentType"];
  department_ids: string[] | null;
  location_ids: string[] | null;
  category_ids: string[] | null;
  approval_limit_cents: number | string | null;
  workflow_owner_ids: string[] | null;
  starts_at: string;
  expires_at: string | null;
  emergency_access: boolean;
};
type SupplierAssignmentRow = {
  tenant_id: string;
  supplier_organization_id: string;
  supplier_id: string;
  scopes: string[] | null;
  expires_at: string | null;
};
type IdentityPolicyRow = {
  tenant_id: string;
  internal_access_mode: TenantIdentityPolicy["internalAccessMode"];
  supplier_access_mode: TenantIdentityPolicy["supplierAccessMode"];
  provisioning_mode: TenantIdentityPolicy["provisioningMode"];
  require_aal2_for_protected_actions: boolean;
  allow_synthetic_presenter_aal1: boolean;
  status: TenantIdentityPolicy["status"];
  version: number;
};

export function deriveSessionAuthority(
  appMetadata: Record<string, unknown>,
  assignments: TenantAssignment[],
) {
  const assignedRole =
    assignments.find((assignment) => assignment.role === "administrator")
      ?.role ??
    assignments.find((assignment) => assignment.role === "presenter")?.role ??
    assignments[0]?.role ??
    "viewer";
  const metadataRole =
    typeof appMetadata.role === "string" ? appMetadata.role : undefined;
  const metadataPresenter =
    appMetadata.presenter === true || metadataRole === "administrator";
  const assignedPresenter = ["presenter", "administrator"].includes(
    assignedRole,
  );

  return {
    role: assignedRole,
    presenter: metadataPresenter && assignedPresenter,
  };
}

function numberOrUndefined(value: number | string | null) {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function buildTenantAuthorities(input: {
  tenantIds: string[];
  roleAssignments: RoleAssignmentRow[];
  supplierAssignments: SupplierAssignmentRow[];
  policies: IdentityPolicyRow[];
}) {
  return Object.fromEntries(
    input.tenantIds.map((tenantId) => {
      const policy = input.policies.find(
        (candidate) => candidate.tenant_id === tenantId,
      );
      if (!policy) throw new Error("IDENTITY_POLICY_UNAVAILABLE");
      const roles = input.roleAssignments
        .filter(
          (assignment) =>
            assignment.tenant_id === tenantId &&
            demoRoles.includes(
              assignment.role as (typeof demoRoles)[number],
            ),
        )
        .map(
          (assignment): ActiveRoleAssignment => ({
            role: assignment.role as ActiveRoleAssignment["role"],
            assignmentType: assignment.assignment_type,
            departmentIds: assignment.department_ids ?? [],
            locationIds: assignment.location_ids ?? [],
            categoryIds: assignment.category_ids ?? [],
            approvalLimitCents: numberOrUndefined(
              assignment.approval_limit_cents,
            ),
            workflowOwnerIds: assignment.workflow_owner_ids ?? [],
            startsAt: assignment.starts_at,
            expiresAt: assignment.expires_at ?? undefined,
            emergencyAccess: assignment.emergency_access,
          }),
        );
      const supplierAccess = input.supplierAssignments
        .filter((assignment) => assignment.tenant_id === tenantId)
        .map(
          (assignment): SupplierAccess => ({
            supplierOrganizationId: assignment.supplier_organization_id,
            supplierId: assignment.supplier_id,
            scopes: assignment.scopes ?? [],
            expiresAt: assignment.expires_at ?? undefined,
          }),
        );
      return [
        tenantId,
        {
          tenantId,
          policy: {
            internalAccessMode: policy.internal_access_mode,
            supplierAccessMode: policy.supplier_access_mode,
            provisioningMode: policy.provisioning_mode,
            requireAal2ForProtectedActions:
              policy.require_aal2_for_protected_actions,
            allowSyntheticPresenterAal1:
              policy.allow_synthetic_presenter_aal1,
            status: policy.status,
            version: policy.version,
          },
          roles,
          supplierAccess,
        } satisfies TenantAuthority,
      ];
    }),
  );
}

function fromUser(
  user: User,
  assignments: TenantAssignment[],
  assuranceLevel: AssuranceLevel,
  nextAssuranceLevel: AssuranceLevel,
  authorities: Record<string, TenantAuthority>,
  authentication: VerifiedAuthenticationContext,
  mode: AppSession["mode"] = "supabase",
): AppSession {
  const tenantIds = assignments.map((assignment) => assignment.tenant_id);
  const authority = deriveSessionAuthority(user.app_metadata, assignments);
  return {
    userId: user.id,
    email: user.email ?? "",
    role: authority.role,
    tenantIds,
    presenter: authority.presenter,
    assuranceLevel,
    nextAssuranceLevel,
    authenticationMethods: authentication.methods,
    identityProvider: authentication.identityProvider,
    phishingResistant: authentication.phishingResistant,
    authorities,
    mode,
  };
}

async function loadSessionForUser(input: {
  client: SupabaseClient;
  user: User;
  assuranceLevel: AssuranceLevel;
  nextAssuranceLevel: AssuranceLevel;
  authentication: VerifiedAuthenticationContext;
  mode: AppSession["mode"];
}) {
  const { client, user } = input;
  const { data: assignments, error } = await client
    .from("tenant_assignments")
    .select("tenant_id,role")
    .eq("user_id", user.id);
  if (error || !assignments?.length) return null;
  const tenantIds = assignments.map((assignment) => assignment.tenant_id);
  const [roleResult, supplierResult, policyResult] = await Promise.all([
      client
        .from("tenant_role_assignments")
        .select(
          "tenant_id,role,assignment_type,department_ids,location_ids,category_ids,approval_limit_cents,workflow_owner_ids,starts_at,expires_at,emergency_access",
        )
        .eq("user_id", user.id)
        .is("suspended_at", null),
      client
        .from("supplier_identity_assignments")
        .select(
          "tenant_id,supplier_organization_id,supplier_id,scopes,expires_at",
        )
        .eq("user_id", user.id)
        .eq("status", "active"),
      client
        .from("identity_access_policies")
        .select(
          "tenant_id,internal_access_mode,supplier_access_mode,provisioning_mode,require_aal2_for_protected_actions,allow_synthetic_presenter_aal1,status,version",
        )
        .in("tenant_id", tenantIds),
    ]);
  if (
    roleResult.error ||
    supplierResult.error ||
    policyResult.error
  ) {
    return null;
  }
  const authorities = buildTenantAuthorities({
    tenantIds,
    roleAssignments: (roleResult.data ?? []) as RoleAssignmentRow[],
    supplierAssignments: (supplierResult.data ?? []) as SupplierAssignmentRow[],
    policies: (policyResult.data ?? []) as IdentityPolicyRow[],
  });
  return fromUser(
    user,
    assignments,
    input.assuranceLevel,
    input.nextAssuranceLevel,
    authorities,
    input.authentication,
    input.mode,
  );
}

function createLocalPreviewSession(): AppSession {
  const roles: ActiveRoleAssignment[] = demoRoles.map((role) => ({
    role,
    assignmentType: "presenter_simulation",
    departmentIds: [],
    locationIds: [],
    categoryIds: [],
    workflowOwnerIds: [],
    startsAt: "2020-01-01T00:00:00.000Z",
    emergencyAccess: false,
  }));
  const policy: TenantIdentityPolicy = {
    internalAccessMode: "invite_magic_link",
    supplierAccessMode: "invite_magic_link",
    provisioningMode: "manual_review",
    requireAal2ForProtectedActions: true,
    allowSyntheticPresenterAal1: true,
    status: "validation_required",
    version: 1,
  };
  const authorities = Object.fromEntries(
    DEVELOPMENT_BYPASS_TENANT_IDS.map((tenantId) => [
      tenantId,
      {
        tenantId,
        policy,
        roles,
        supplierAccess: [],
      } satisfies TenantAuthority,
    ]),
  );
  return {
    userId: "preview-presenter",
    email: "preview@catalystinnovations.example",
    role: "system_administrator",
    tenantIds: [...DEVELOPMENT_BYPASS_TENANT_IDS],
    presenter: true,
    assuranceLevel: "aal1",
    nextAssuranceLevel: "aal1",
    authenticationMethods: ["development_preview"],
    phishingResistant: false,
    authorities,
    mode: "preview",
  };
}

async function getStagingBypassSession(actorId: string) {
  try {
    const client = createSupabaseServiceClient();
    const {
      data: { user },
      error,
    } = await client.auth.admin.getUserById(actorId);
    if (error || !user) return null;
    if (
      user.app_metadata.presenter !== true ||
      user.app_metadata.access_mode !== "staging_bypass" ||
      user.app_metadata.bypass_expires_at !==
        DEVELOPMENT_BYPASS_EXPIRES_AT
    ) {
      return null;
    }
    const session = await loadSessionForUser({
      client,
      user,
      assuranceLevel: "aal1",
      nextAssuranceLevel: "aal1",
      authentication: {
        methods: ["staging_bypass"],
        phishingResistant: false,
      },
      mode: "staging_bypass",
    });
    if (!session || !session.presenter) return null;
    const assignedTenants = [...session.tenantIds].sort();
    const allowedTenants = [...DEVELOPMENT_BYPASS_TENANT_IDS].sort();
    if (
      assignedTenants.length !== allowedTenants.length ||
      assignedTenants.some(
        (tenantId, index) => tenantId !== allowedTenants[index],
      )
    ) {
      return null;
    }
    const hasCompleteSimulationAuthority = allowedTenants.every((tenantId) => {
      const roles = session.authorities[tenantId]?.roles ?? [];
      return demoRoles.every((role) =>
        roles.some(
          (assignment) =>
            assignment.role === role &&
            assignment.assignmentType === "presenter_simulation" &&
            isDevelopmentBypassExpiration(assignment.expiresAt),
        ),
      );
    });
    return hasCompleteSimulationAuthority ? session : null;
  } catch {
    return null;
  }
}

export async function getAppSession(): Promise<AppSession | null> {
  const bypass = resolveDevelopmentBypass();
  if (bypass.active && bypass.actorId) {
    const bypassSession = await getStagingBypassSession(bypass.actorId);
    if (bypassSession) return bypassSession;
  }
  if (!isSupabaseConfigured()) {
    return process.env.NODE_ENV !== "production"
      ? createLocalPreviewSession()
      : null;
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [assuranceResult, claimsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.getClaims(),
  ]);
  if (assuranceResult.error || claimsResult.error || !claimsResult.data) {
    return null;
  }
  const assuranceLevel = normalizeAssuranceLevel(
    assuranceResult.data.currentLevel,
  );
  return loadSessionForUser({
    client: supabase,
    user,
    assuranceLevel,
    nextAssuranceLevel: normalizeAssuranceLevel(
      assuranceResult.data.nextLevel,
    ),
    authentication: deriveVerifiedAuthenticationContext({
      assuranceLevel,
      claims: claimsResult.data.claims as Record<string, unknown>,
    }),
    mode: "supabase",
  });
}

export async function requireAppSession(tenantId?: string) {
  const session = await getAppSession();
  if (!session) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  if (tenantId && !session.tenantIds.includes(tenantId)) {
    throw new Error("TENANT_ACCESS_DENIED");
  }
  if (tenantId && !session.authorities[tenantId]) {
    throw new Error("IDENTITY_POLICY_UNAVAILABLE");
  }
  return session;
}
