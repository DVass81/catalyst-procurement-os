import type { DemoRole } from "@/demo/model";
import type { PhaseTwoCommand } from "@/phase-two/commands";
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
  "phase3_bank_propose",
  "phase3_bank_verify",
  "phase3_bank_decide",
  "phase3_contract_validate",
  "phase3_workflow_approve",
  "phase3_workflow_activate",
  "phase3_workflow_rollback",
  "phase3_mobile_approval",
  "phase3_mobile_receipt",
  "phase3_create_report_schedule",
  "phase3_deliver_report",
  "phase3_advance_incident",
  "phase3_record_assurance_retest",
  "phase3_reset",
]);

const phishingResistantPhaseThreeCommands = new Set<
  PhaseThreeCommand["type"]
>([
  "phase3_supplier_decide",
  "phase3_rfq_award",
  "phase3_rfq_cancel",
  "phase3_bank_propose",
  "phase3_bank_verify",
  "phase3_bank_decide",
  "phase3_workflow_approve",
  "phase3_workflow_activate",
  "phase3_workflow_rollback",
  "phase3_record_assurance_retest",
]);

const phaseTwoPresenterOnlyCommands = new Set<PhaseTwoCommand["type"]>([
  "switch_role",
  "jump_to_stage",
  "reset_demo",
  "toggle_notice",
  "toggle_highlights",
]);

const phaseTwoProtectedCommands = new Set<PhaseTwoCommand["type"]>([
  "withdraw_operational_request",
  "decide_operational_approval",
  "create_operational_purchase_order",
  "issue_operational_purchase_order",
  "acknowledge_operational_purchase_order",
  "record_operational_receipt",
  "record_operational_invoice",
  "match_operational_invoice",
  "record_operational_credit",
  "resolve_operational_invoice",
  "export_operational_payment_readiness",
  "cancel_operational_purchase_order",
  "close_operational_purchase_order",
  "reopen_operational_purchase_order",
  "decide_vendor_exception",
  "decide_approval",
  "delegate_approval",
  "escalate_approval",
  "bulk_decide_approvals",
  "create_purchase_order",
  "issue_purchase_order",
  "receive_order",
  "record_partial_receipt",
  "complete_partial_receipt",
  "reverse_receipt",
  "propose_po_revision",
  "decide_po_revision",
  "issue_po_revision",
  "cancel_purchase_order",
  "close_purchase_order",
  "run_invoice_match",
  "resolve_invoice_exception",
  "export_payment_readiness",
  "approve_configuration",
  "activate_configuration",
  "approve_import",
  "post_import",
  "reverse_import",
  "generate_audit_package",
]);

const phishingResistantPhaseTwoCommands = new Set<PhaseTwoCommand["type"]>([
  "decide_vendor_exception",
  "reverse_receipt",
  "activate_configuration",
  "approve_import",
  "post_import",
  "reverse_import",
  "generate_audit_package",
]);

const phaseTwoAllowedRoles: Record<PhaseTwoCommand["type"], readonly DemoRole[]> =
  {
    create_operational_request: ["requester"],
    update_operational_request: ["requester"],
    clone_operational_request: ["requester"],
    submit_operational_request: ["requester"],
    withdraw_operational_request: ["requester"],
    decide_operational_approval: [
      "department_manager",
      "it_reviewer",
      "purchasing_manager",
      "finance_reviewer",
      "compliance_reviewer",
    ],
    create_operational_purchase_order: [
      "purchasing_specialist",
      "purchasing_manager",
    ],
    issue_operational_purchase_order: [
      "purchasing_specialist",
      "purchasing_manager",
    ],
    acknowledge_operational_purchase_order: [
      "purchasing_specialist",
      "purchasing_manager",
    ],
    record_operational_receipt: ["receiving_clerk"],
    record_operational_invoice: ["accounts_payable"],
    match_operational_invoice: ["accounts_payable"],
    record_operational_credit: ["accounts_payable"],
    resolve_operational_invoice: ["finance_reviewer"],
    export_operational_payment_readiness: ["accounts_payable"],
    cancel_operational_purchase_order: ["purchasing_manager"],
    close_operational_purchase_order: ["purchasing_manager"],
    reopen_operational_purchase_order: ["purchasing_manager"],
    analyze_request: ["requester", "purchasing_specialist", "purchasing_manager"],
    accept_inventory_recommendation: [
      "requester",
      "purchasing_specialist",
      "purchasing_manager",
    ],
    accept_standards_substitution: [
      "requester",
      "it_reviewer",
      "purchasing_specialist",
      "purchasing_manager",
    ],
    select_vendor: ["purchasing_specialist", "purchasing_manager"],
    request_vendor_exception: [
      "requester",
      "purchasing_specialist",
      "purchasing_manager",
    ],
    decide_vendor_exception: ["compliance_reviewer", "purchasing_manager"],
    confirm_budget_and_coding: [
      "requester",
      "finance_reviewer",
      "purchasing_specialist",
      "purchasing_manager",
    ],
    submit_request: ["requester"],
    decide_approval: [
      "department_manager",
      "it_reviewer",
      "purchasing_manager",
      "finance_reviewer",
      "compliance_reviewer",
    ],
    delegate_approval: [
      "department_manager",
      "it_reviewer",
      "purchasing_manager",
      "finance_reviewer",
      "compliance_reviewer",
      "system_administrator",
    ],
    send_approval_reminder: [
      "requester",
      "department_manager",
      "it_reviewer",
      "purchasing_specialist",
      "purchasing_manager",
      "finance_reviewer",
      "compliance_reviewer",
      "operations_manager",
      "system_administrator",
    ],
    escalate_approval: ["operations_manager", "system_administrator"],
    bulk_decide_approvals: [
      "department_manager",
      "it_reviewer",
      "purchasing_manager",
      "finance_reviewer",
      "compliance_reviewer",
    ],
    create_purchase_order: ["purchasing_specialist", "purchasing_manager"],
    issue_purchase_order: ["purchasing_specialist", "purchasing_manager"],
    record_vendor_acknowledgment: [
      "purchasing_specialist",
      "purchasing_manager",
    ],
    receive_order: ["receiving_clerk"],
    record_partial_receipt: ["receiving_clerk"],
    complete_partial_receipt: ["receiving_clerk"],
    reverse_receipt: ["receiving_clerk", "operations_manager"],
    propose_po_revision: ["purchasing_specialist", "purchasing_manager"],
    decide_po_revision: ["purchasing_manager", "finance_reviewer"],
    issue_po_revision: ["purchasing_specialist", "purchasing_manager"],
    cancel_purchase_order: ["purchasing_manager"],
    close_purchase_order: ["purchasing_manager"],
    run_invoice_match: ["accounts_payable"],
    resolve_invoice_exception: ["accounts_payable", "finance_reviewer"],
    export_payment_readiness: ["accounts_payable", "finance_reviewer"],
    switch_role: [],
    jump_to_stage: [],
    reset_demo: [],
    toggle_notice: [],
    toggle_highlights: [],
    validate_configuration: ["system_administrator"],
    submit_configuration_review: ["system_administrator"],
    approve_configuration: ["compliance_reviewer", "system_administrator"],
    activate_configuration: ["system_administrator"],
    approve_import: [
      "purchasing_manager",
      "finance_reviewer",
      "system_administrator",
    ],
    post_import: ["system_administrator"],
    reverse_import: ["finance_reviewer", "system_administrator"],
    generate_audit_package: ["auditor", "system_administrator"],
    retry_notification: ["operations_manager", "system_administrator"],
    acknowledge_notification: demoRoles,
  };

const phaseThreePresenterOnlyCommands = new Set<PhaseThreeCommand["type"]>([
  "phase3_set_scene",
  "phase3_simulate_provider_outage",
  "phase3_reset",
]);

const phaseThreeAllowedRoles: Record<
  PhaseThreeCommand["type"],
  readonly DemoRole[]
> = {
  phase3_test_integration: ["operations_manager", "system_administrator"],
  phase3_replay_integration: ["operations_manager", "system_administrator"],
  phase3_supplier_submit: ["supplier_user"],
  phase3_rfq_create: ["purchasing_specialist", "purchasing_manager"],
  phase3_rfq_update_draft: ["purchasing_specialist", "purchasing_manager"],
  phase3_rfq_release: ["purchasing_specialist", "purchasing_manager"],
  phase3_rfq_amend: ["purchasing_specialist", "purchasing_manager"],
  phase3_rfq_submit_question: ["supplier_user"],
  phase3_rfq_answer_question: [
    "purchasing_specialist",
    "purchasing_manager",
  ],
  phase3_rfq_decline: ["supplier_user"],
  phase3_rfq_withdraw_response: ["supplier_user"],
  phase3_rfq_disclose_conflict: [
    "purchasing_specialist",
    "purchasing_manager",
  ],
  phase3_rfq_resolve_conflict: [
    "compliance_reviewer",
    "purchasing_manager",
  ],
  phase3_rfq_record_negotiation: ["purchasing_manager"],
  phase3_rfq_submit_response: ["supplier_user"],
  phase3_rfq_submit_bafo: ["supplier_user"],
  phase3_rfq_close: ["purchasing_specialist", "purchasing_manager"],
  phase3_rfq_evaluate: ["purchasing_specialist", "purchasing_manager"],
  phase3_rfq_request_bafo: ["purchasing_manager"],
  phase3_rfq_award: ["purchasing_manager"],
  phase3_rfq_cancel: ["purchasing_manager"],
  phase3_supplier_request_remediation: [
    "compliance_reviewer",
    "purchasing_manager",
  ],
  phase3_supplier_decide: ["compliance_reviewer", "purchasing_manager"],
  phase3_bank_propose: ["supplier_user"],
  phase3_bank_verify: ["compliance_reviewer"],
  phase3_bank_decide: ["finance_reviewer"],
  phase3_contract_validate: ["contract_manager", "compliance_reviewer"],
  phase3_obligation_acknowledge: ["contract_manager"],
  phase3_workflow_validate: ["operations_manager", "system_administrator"],
  phase3_workflow_simulate: ["operations_manager", "system_administrator"],
  phase3_workflow_submit: ["operations_manager", "system_administrator"],
  phase3_workflow_approve: ["compliance_reviewer", "system_administrator"],
  phase3_workflow_activate: ["system_administrator"],
  phase3_workflow_rollback: ["system_administrator"],
  phase3_mobile_approval: [
    "department_manager",
    "it_reviewer",
    "purchasing_manager",
    "finance_reviewer",
    "compliance_reviewer",
  ],
  phase3_mobile_receipt: ["receiving_clerk"],
  phase3_generate_report: [
    "purchasing_manager",
    "finance_reviewer",
    "accounts_payable",
    "executive",
    "auditor",
  ],
  phase3_create_report_schedule: [
    "purchasing_manager",
    "finance_reviewer",
    "executive",
    "auditor",
  ],
  phase3_deliver_report: [
    "purchasing_manager",
    "finance_reviewer",
    "executive",
    "auditor",
  ],
  phase3_generate_cate_narrative: [
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
    "contract_manager",
    "security_reviewer",
    "operations_manager",
    "system_administrator",
  ],
  phase3_advance_incident: [
    "security_reviewer",
    "operations_manager",
    "system_administrator",
  ],
  phase3_advance_support_case: ["operations_manager", "system_administrator"],
  phase3_run_preflight: ["operations_manager", "system_administrator"],
  phase3_set_scene: [],
  phase3_simulate_provider_outage: [],
  phase3_record_assurance_retest: [
    "security_reviewer",
    "compliance_reviewer",
    "system_administrator",
  ],
  phase3_reset: [],
};

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

function authorizeAssignedRole(input: {
  authority: TenantAuthority;
  assuranceLevel: AssuranceLevel;
  presenter: boolean;
  syntheticOnly: boolean;
  requestedRole?: string;
  presenterRole: DemoRole;
  allowedRoles: readonly DemoRole[];
  presenterOnly: boolean;
  protectedAction: boolean;
  securePilot?: boolean;
  phishingResistant?: boolean;
  phishingResistantAction?: boolean;
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
  if (!input.presenter && assignment.assignmentType === "presenter_simulation") {
    throw new Error("ROLE_ACCESS_DENIED");
  }
  if (input.presenterOnly && !presenterSimulation) {
    throw new Error("PRESENTER_SIMULATION_DENIED");
  }
  if (
    !input.presenterOnly &&
    !presenterSimulation &&
    !input.allowedRoles.includes(assignment.role)
  ) {
    throw new Error("COMMAND_ROLE_DENIED");
  }

  const aal2Required =
    input.protectedAction &&
    input.authority.policy.requireAal2ForProtectedActions &&
    !(
      presenterSimulation &&
      input.authority.policy.allowSyntheticPresenterAal1
    );
  if (aal2Required && input.assuranceLevel !== "aal2") {
    throw new Error("AAL2_REQUIRED");
  }
  if (
    input.securePilot &&
    input.phishingResistantAction &&
    !input.phishingResistant
  ) {
    throw new Error("PHISHING_RESISTANT_AUTH_REQUIRED");
  }

  return {
    activeRole: assignment.role,
    assignment,
    protectedAction: input.protectedAction,
    simulation: presenterSimulation,
  };
}

export function authorizePhaseTwoActor(input: {
  authority: TenantAuthority;
  assuranceLevel: AssuranceLevel;
  presenter: boolean;
  syntheticOnly: boolean;
  requestedRole?: string;
  presenterRole: DemoRole;
  commandType: PhaseTwoCommand["type"];
  securePilot?: boolean;
  phishingResistant?: boolean;
}) {
  return authorizeAssignedRole({
    ...input,
    allowedRoles: phaseTwoAllowedRoles[input.commandType],
    presenterOnly: phaseTwoPresenterOnlyCommands.has(input.commandType),
    protectedAction: phaseTwoProtectedCommands.has(input.commandType),
    phishingResistantAction: phishingResistantPhaseTwoCommands.has(
      input.commandType,
    ),
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
  securePilot?: boolean;
  phishingResistant?: boolean;
}) {
  return authorizeAssignedRole({
    ...input,
    allowedRoles: phaseThreeAllowedRoles[input.commandType],
    presenterOnly: phaseThreePresenterOnlyCommands.has(input.commandType),
    protectedAction: isProtectedPhaseThreeCommand(input.commandType),
    phishingResistantAction: phishingResistantPhaseThreeCommands.has(
      input.commandType,
    ),
  });
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
  supplierId?: string;
  requiredScope: string;
}) {
  const assignment = input.authority.supplierAccess.find(
    (candidate) =>
      candidate.supplierOrganizationId === input.supplierOrganizationId &&
      (!input.supplierId || candidate.supplierId === input.supplierId) &&
      candidate.scopes.includes(input.requiredScope) &&
      (!candidate.expiresAt ||
        new Date(candidate.expiresAt).getTime() > Date.now()),
  );
  if (!assignment) throw new Error("SUPPLIER_ACCESS_DENIED");
  return assignment;
}
