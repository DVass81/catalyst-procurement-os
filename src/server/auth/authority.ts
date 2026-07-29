import type { DemoRole } from "@/demo/model";
import type { PhaseThreeCommand } from "@/phase-three/commands";

export type AssuranceLevel = "aal1" | "aal2" | "unknown";
export type RoleAssignmentType =
  | "direct"
  | "delegated"
  | "emergency"
  | "presenter_simulation";

export interface ActiveRoleAssignment {
  role: DemoRole;
  assignmentType: RoleAssignmentType;
  departmentIds: string[];
  locationIds: string[];
  categoryIds: string[];
  approvalLimitCents?: number;
  workflowOwnerIds: string[];
  startsAt: string;
  expiresAt?: string;
  emergencyAccess: boolean;
}

export interface SupplierAccess {
  supplierOrganizationId: string;
  supplierId: string;
  scopes: string[];
  expiresAt?: string;
}

export interface TenantIdentityPolicy {
  internalAccessMode:
    | "invite_magic_link"
    | "saml_required"
    | "hybrid_transition";
  supplierAccessMode: "invite_magic_link" | "federated" | "disabled";
  provisioningMode: "manual_review" | "scim" | "jit_with_approval";
  requireAal2ForProtectedActions: boolean;
  allowSyntheticPresenterAal1: boolean;
  status: "validation_required" | "configured" | "active" | "suspended";
  version: number;
}

export interface TenantAuthority {
  tenantId: string;
  policy: TenantIdentityPolicy;
  roles: ActiveRoleAssignment[];
  supplierAccess: SupplierAccess[];
}

export const demoRoles = [
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
] as const satisfies readonly DemoRole[];

const protectedCommandTypes = new Set<PhaseThreeCommand["type"]>([
  "phase3_supplier_decide",
  "phase3_rfq_close",
  "phase3_rfq_evaluate",
  "phase3_rfq_request_bafo",
  "phase3_rfq_award",
  "phase3_rfq_cancel",
  "phase3_bank_verify",
  "phase3_bank_decide",
  "phase3_contract_validate",
  "phase3_workflow_approve",
  "phase3_workflow_activate",
  "phase3_workflow_rollback",
  "phase3_mobile_approval",
  "phase3_mobile_receipt",
  "phase3_advance_incident",
  "phase3_record_assurance_retest",
  "phase3_reset",
]);

export function normalizeAssuranceLevel(value: string | null | undefined) {
  if (value === "aal1" || value === "aal2") return value;
  return "unknown" as const;
}

export function isProtectedPhaseThreeCommand(
  type: PhaseThreeCommand["type"],
) {
  return protectedCommandTypes.has(type);
}

export function activeRoleAssignments(
  assignments: ActiveRoleAssignment[],
  at = new Date(),
) {
  const timestamp = at.getTime();
  return assignments.filter((assignment) => {
    const startsAt = new Date(assignment.startsAt).getTime();
    const expiresAt = assignment.expiresAt
      ? new Date(assignment.expiresAt).getTime()
      : undefined;
    return (
      Number.isFinite(startsAt) &&
      startsAt <= timestamp &&
      (expiresAt === undefined ||
        (Number.isFinite(expiresAt) && expiresAt > timestamp))
    );
  });
}

export function authorizePhaseThreeActor(input: {
  authority: TenantAuthority;
  assuranceLevel: AssuranceLevel;
  presenter: boolean;
  syntheticOnly: boolean;
  requestedRole?: string;
  presenterRole: DemoRole;
  commandType: PhaseThreeCommand["type"];
}) {
  if (input.authority.policy.status === "suspended") {
    throw new Error("IDENTITY_POLICY_SUSPENDED");
  }

  const assignments = activeRoleAssignments(input.authority.roles);
  const selectedRole = input.presenter
    ? input.presenterRole
    : input.requestedRole;
  if (!selectedRole || !demoRoles.includes(selectedRole as DemoRole)) {
    throw new Error("ACTIVE_ROLE_REQUIRED");
  }

  const assignment = assignments.find(
    (candidate) => candidate.role === selectedRole,
  );
  if (!assignment) {
    throw new Error("ROLE_ACCESS_DENIED");
  }

  const presenterSimulation =
    input.presenter &&
    input.syntheticOnly &&
    assignment.assignmentType === "presenter_simulation";
  if (
    input.presenter &&
    (!input.syntheticOnly ||
      assignment.assignmentType !== "presenter_simulation")
  ) {
    throw new Error("PRESENTER_SIMULATION_DENIED");
  }
  if (
    !input.presenter &&
    assignment.assignmentType === "presenter_simulation"
  ) {
    throw new Error("ROLE_ACCESS_DENIED");
  }

  const protectedAction = isProtectedPhaseThreeCommand(input.commandType);
  const aal2Required =
    protectedAction &&
    input.authority.policy.requireAal2ForProtectedActions &&
    !(
      presenterSimulation &&
      input.authority.policy.allowSyntheticPresenterAal1
    );
  if (aal2Required && input.assuranceLevel !== "aal2") {
    throw new Error("AAL2_REQUIRED");
  }

  return {
    activeRole: selectedRole as DemoRole,
    assignment,
    protectedAction,
    simulation: presenterSimulation,
  };
}

export function authorizeCateActor(input: {
  authority: TenantAuthority;
  presenter: boolean;
  syntheticOnly: boolean;
  requestedRole?: string;
}) {
  if (input.authority.policy.status === "suspended") {
    throw new Error("IDENTITY_POLICY_SUSPENDED");
  }
  if (
    !input.requestedRole ||
    !demoRoles.includes(input.requestedRole as DemoRole)
  ) {
    throw new Error("ACTIVE_ROLE_REQUIRED");
  }
  const assignment = activeRoleAssignments(input.authority.roles).find(
    (candidate) => candidate.role === input.requestedRole,
  );
  if (!assignment) throw new Error("ROLE_ACCESS_DENIED");

  const presenterSimulation =
    input.presenter &&
    input.syntheticOnly &&
    assignment.assignmentType === "presenter_simulation";
  if (
    input.presenter &&
    (!input.syntheticOnly ||
      assignment.assignmentType !== "presenter_simulation")
  ) {
    throw new Error("PRESENTER_SIMULATION_DENIED");
  }
  if (
    !input.presenter &&
    assignment.assignmentType === "presenter_simulation"
  ) {
    throw new Error("ROLE_ACCESS_DENIED");
  }
  if (
    assignment.role === "supplier_user" &&
    !presenterSimulation &&
    input.authority.supplierAccess.length === 0
  ) {
    throw new Error("SUPPLIER_ACCESS_DENIED");
  }
  return {
    activeRole: assignment.role,
    assignment,
    simulation: presenterSimulation,
  };
}

export function requireSupplierScope(input: {
  authority: TenantAuthority;
  supplierOrganizationId: string;
  requiredScope: string;
}) {
  const assignment = input.authority.supplierAccess.find(
    (candidate) =>
      candidate.supplierOrganizationId === input.supplierOrganizationId &&
      candidate.scopes.includes(input.requiredScope) &&
      (!candidate.expiresAt ||
        new Date(candidate.expiresAt).getTime() > Date.now()),
  );
  if (!assignment) throw new Error("SUPPLIER_ACCESS_DENIED");
  return assignment;
}
