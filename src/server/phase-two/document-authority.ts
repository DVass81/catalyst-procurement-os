import "server-only";

import type { DemoRole, DemoState } from "@/demo/model";
import {
  activeRoleAssignments,
  demoRoles,
} from "@/server/auth/authority";
import type { AppSession } from "@/server/auth/session";
import { requestedActiveRole } from "@/server/auth/request-role";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";
import { loadPhaseTwoState } from "@/server/phase-two/repository";

export type DocumentParentType =
  | "request"
  | "sourcing_event"
  | "vendor_quote"
  | "vendor"
  | "exception"
  | "purchase_order"
  | "receipt"
  | "invoice"
  | "contract"
  | "audit_package";

const uploadRoles: Record<DocumentParentType, readonly DemoRole[]> = {
  request: ["requester", "purchasing_specialist", "purchasing_manager"],
  sourcing_event: [
    "purchasing_specialist",
    "purchasing_manager",
    "supplier_user",
  ],
  vendor_quote: [
    "purchasing_specialist",
    "purchasing_manager",
    "supplier_user",
  ],
  vendor: [
    "purchasing_specialist",
    "purchasing_manager",
    "compliance_reviewer",
    "supplier_user",
  ],
  exception: [
    "purchasing_specialist",
    "purchasing_manager",
    "compliance_reviewer",
    "accounts_payable",
    "finance_reviewer",
  ],
  purchase_order: ["purchasing_specialist", "purchasing_manager"],
  receipt: ["receiving_clerk"],
  invoice: ["accounts_payable"],
  contract: ["contract_manager"],
  audit_package: ["system_administrator"],
};

const readRoles: Record<DocumentParentType, readonly DemoRole[]> = {
  request: [
    "requester",
    "department_manager",
    "it_reviewer",
    "purchasing_specialist",
    "purchasing_manager",
    "finance_reviewer",
    "compliance_reviewer",
    "executive",
    "auditor",
    "system_administrator",
  ],
  sourcing_event: [
    "purchasing_specialist",
    "purchasing_manager",
    "compliance_reviewer",
    "supplier_user",
    "auditor",
    "system_administrator",
  ],
  vendor_quote: [
    "purchasing_specialist",
    "purchasing_manager",
    "compliance_reviewer",
    "supplier_user",
    "auditor",
    "system_administrator",
  ],
  vendor: [
    "purchasing_specialist",
    "purchasing_manager",
    "compliance_reviewer",
    "supplier_user",
    "contract_manager",
    "auditor",
    "system_administrator",
  ],
  exception: [
    "purchasing_specialist",
    "purchasing_manager",
    "compliance_reviewer",
    "accounts_payable",
    "finance_reviewer",
    "auditor",
    "system_administrator",
  ],
  purchase_order: [
    "purchasing_specialist",
    "purchasing_manager",
    "receiving_clerk",
    "accounts_payable",
    "finance_reviewer",
    "auditor",
    "system_administrator",
  ],
  receipt: [
    "receiving_clerk",
    "accounts_payable",
    "finance_reviewer",
    "auditor",
    "system_administrator",
  ],
  invoice: [
    "accounts_payable",
    "finance_reviewer",
    "purchasing_manager",
    "auditor",
    "system_administrator",
  ],
  contract: [
    "contract_manager",
    "compliance_reviewer",
    "purchasing_manager",
    "auditor",
    "system_administrator",
  ],
  audit_package: ["auditor", "system_administrator"],
};

export function hasVisibleDocumentParent(
  state: DemoState,
  parentEntityType: DocumentParentType,
  parentEntityId: string,
) {
  switch (parentEntityType) {
    case "request":
      return state.requests.some((record) => record.id === parentEntityId);
    case "sourcing_event":
      return state.phaseThree.rfqs.some((record) => record.id === parentEntityId);
    case "vendor_quote":
      return (
        state.quotes.some((record) => record.id === parentEntityId) ||
        state.phaseThree.rfqs.some((rfq) =>
          rfq.responses.some((record) => record.id === parentEntityId),
        )
      );
    case "vendor":
      return (
        state.vendors.some((record) => record.id === parentEntityId) ||
        state.phaseThree.supplierApplications.some(
          (record) => record.id === parentEntityId,
        )
      );
    case "exception":
      return (
        state.vendorExceptions.some((record) => record.id === parentEntityId) ||
        state.invoices.some((record) => record.id === parentEntityId)
      );
    case "purchase_order":
      return state.purchaseOrders.some((record) => record.id === parentEntityId);
    case "receipt":
      return state.receipts.some((record) => record.id === parentEntityId);
    case "invoice":
      return state.invoices.some((record) => record.id === parentEntityId);
    case "contract":
      return (
        state.contracts.some((record) => record.id === parentEntityId) ||
        state.phaseThree.contracts.some((record) => record.id === parentEntityId)
      );
    case "audit_package":
      return state.auditPackages.some((record) => record.id === parentEntityId);
  }
}

export function canRoleUsePrivateDocument(
  role: DemoRole,
  parentEntityType: DocumentParentType,
  intent: "read" | "upload",
) {
  return (intent === "upload"
    ? uploadRoles[parentEntityType]
    : readRoles[parentEntityType]
  ).includes(role);
}

export async function authorizePrivateDocumentParent(input: {
  request: Request;
  session: AppSession;
  tenantId: string;
  parentEntityType: DocumentParentType;
  parentEntityId: string;
  intent: "read" | "upload";
}) {
  const authority = input.session.authorities[input.tenantId];
  if (!authority) throw new Error("DOCUMENT_ACCESS_DENIED");
  const current = await loadPhaseTwoState(input.tenantId);
  const directAssignments = activeRoleAssignments(authority.roles).filter(
    (assignment) => assignment.assignmentType !== "presenter_simulation",
  );
  const requestedRole =
    requestedActiveRole(input.request) ??
    (directAssignments.length === 1
      ? directAssignments[0]?.role
      : undefined);
  const activeRole =
    requestedRole && demoRoles.includes(requestedRole as DemoRole)
      ? (requestedRole as DemoRole)
      : input.session.presenter
        ? current.state.activeRole
        : undefined;
  if (!activeRole) throw new Error("ACTIVE_ROLE_REQUIRED");
  const assignment = activeRoleAssignments(authority.roles).find(
    (candidate) => candidate.role === activeRole,
  );
  if (!assignment) throw new Error("DOCUMENT_ACCESS_DENIED");
  const simulation =
    input.session.presenter &&
    process.env.CATALYST_SYNTHETIC_ONLY === "1" &&
    assignment.assignmentType === "presenter_simulation";
  if (
    input.session.presenter &&
    (!simulation || process.env.CATALYST_SYNTHETIC_ONLY !== "1")
  ) {
    throw new Error("DOCUMENT_ACCESS_DENIED");
  }
  if (
    !canRoleUsePrivateDocument(
      activeRole,
      input.parentEntityType,
      input.intent,
    )
  ) {
    throw new Error("DOCUMENT_ACCESS_DENIED");
  }
  const projected = projectStateForAuthorizedRole({
    state: current.state,
    authority,
    activeRole,
    simulation,
    userId: input.session.userId,
  });
  if (
    !hasVisibleDocumentParent(
      projected,
      input.parentEntityType,
      input.parentEntityId,
    )
  ) {
    throw new Error("DOCUMENT_ACCESS_DENIED");
  }
  return { activeRole, simulation };
}
