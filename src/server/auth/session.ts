import "server-only";

import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  demoRoles,
  normalizeAssuranceLevel,
  type ActiveRoleAssignment,
  type AssuranceLevel,
  type SupplierAccess,
  type TenantAuthority,
  type TenantIdentityPolicy,
} from "@/server/auth/authority";

export interface AppSession {
  userId: string;
  email: string;
  role: string;
  tenantIds: string[];
  presenter: boolean;
  assuranceLevel: AssuranceLevel;
  nextAssuranceLevel: AssuranceLevel;
  authorities: Record<string, TenantAuthority>;
  mode: "supabase" | "preview";
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
    authorities,
    mode: "supabase",
  };
}

export async function getAppSession(): Promise<AppSession | null> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV !== "production") {
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
        ["org-y12-demo", "org-catalyst-community-demo"].map((tenantId) => [
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
        tenantIds: ["org-y12-demo", "org-catalyst-community-demo"],
        presenter: true,
        assuranceLevel: "aal1",
        nextAssuranceLevel: "aal1",
        authorities,
        mode: "preview",
      };
    }
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: assignments, error } = await supabase
    .from("tenant_assignments")
    .select("tenant_id,role")
    .eq("user_id", user.id);
  if (error || !assignments?.length) return null;
  const tenantIds = assignments.map((assignment) => assignment.tenant_id);
  const [roleResult, supplierResult, policyResult, assuranceResult] =
    await Promise.all([
      supabase
        .from("tenant_role_assignments")
        .select(
          "tenant_id,role,assignment_type,department_ids,location_ids,category_ids,approval_limit_cents,workflow_owner_ids,starts_at,expires_at,emergency_access",
        )
        .eq("user_id", user.id)
        .is("suspended_at", null),
      supabase
        .from("supplier_identity_assignments")
        .select(
          "tenant_id,supplier_organization_id,supplier_id,scopes,expires_at",
        )
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("identity_access_policies")
        .select(
          "tenant_id,internal_access_mode,supplier_access_mode,provisioning_mode,require_aal2_for_protected_actions,allow_synthetic_presenter_aal1,status,version",
        )
        .in("tenant_id", tenantIds),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
  if (
    roleResult.error ||
    supplierResult.error ||
    policyResult.error ||
    assuranceResult.error
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
    normalizeAssuranceLevel(assuranceResult.data.currentLevel),
    normalizeAssuranceLevel(assuranceResult.data.nextLevel),
    authorities,
  );
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
