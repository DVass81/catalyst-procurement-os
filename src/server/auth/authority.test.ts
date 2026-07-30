import { describe, expect, it } from "vitest";

import {
  authorizePhaseTwoActor,
  authorizePhaseThreeActor,
  requireSupplierScope,
  type ActiveRoleAssignment,
  type TenantAuthority,
} from "@/server/auth/authority";

const directManager: ActiveRoleAssignment = {
  role: "purchasing_manager",
  assignmentType: "direct",
  departmentIds: [],
  locationIds: [],
  categoryIds: [],
  workflowOwnerIds: [],
  startsAt: "2026-01-01T00:00:00.000Z",
  emergencyAccess: false,
};

function authority(
  roles: ActiveRoleAssignment[],
  overrides: Partial<TenantAuthority["policy"]> = {},
): TenantAuthority {
  return {
    tenantId: "org-y12-demo",
    policy: {
      internalAccessMode: "invite_magic_link",
      supplierAccessMode: "invite_magic_link",
      provisioningMode: "manual_review",
      requireAal2ForProtectedActions: true,
      allowSyntheticPresenterAal1: true,
      status: "configured",
      version: 1,
      ...overrides,
    },
    roles,
    supplierAccess: [],
  };
}

describe("tenant identity authority", () => {
  it("allows an assigned direct role and requires AAL2 for a protected action", () => {
    expect(() =>
      authorizePhaseThreeActor({
        authority: authority([directManager]),
        assuranceLevel: "aal1",
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "phase3_supplier_decide",
      }),
    ).toThrow("AAL2_REQUIRED");

    expect(
      authorizePhaseThreeActor({
        authority: authority([directManager]),
        assuranceLevel: "aal2",
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "phase3_supplier_decide",
      }),
    ).toMatchObject({
      activeRole: "purchasing_manager",
      protectedAction: true,
      simulation: false,
    });
  });

  it("enforces command-specific role authority for both workflow generations", () => {
    expect(() =>
      authorizePhaseThreeActor({
        authority: authority([directManager]),
        assuranceLevel: "aal2",
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "phase3_bank_decide",
      }),
    ).toThrow("COMMAND_ROLE_DENIED");

    expect(() =>
      authorizePhaseTwoActor({
        authority: authority([directManager]),
        assuranceLevel: "aal2",
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "receive_order",
      }),
    ).toThrow("COMMAND_ROLE_DENIED");

    expect(
      authorizePhaseTwoActor({
        authority: authority([directManager]),
        assuranceLevel: "aal2",
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "issue_purchase_order",
      }),
    ).toMatchObject({
      activeRole: "purchasing_manager",
      protectedAction: true,
      simulation: false,
    });
  });

  it("requires verified phishing-resistant assurance for privileged pilot actions", () => {
    expect(() =>
      authorizePhaseThreeActor({
        authority: authority([directManager]),
        assuranceLevel: "aal2",
        securePilot: true,
        phishingResistant: false,
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "phase3_rfq_award",
      }),
    ).toThrow("PHISHING_RESISTANT_AUTH_REQUIRED");

    expect(
      authorizePhaseThreeActor({
        authority: authority([directManager]),
        assuranceLevel: "aal2",
        securePilot: true,
        phishingResistant: true,
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "phase3_rfq_award",
      }),
    ).toMatchObject({
      activeRole: "purchasing_manager",
      protectedAction: true,
    });
  });

  it("keeps presenter shortcuts out of direct pilot identities", () => {
    expect(() =>
      authorizePhaseTwoActor({
        authority: authority([
          { ...directManager, role: "system_administrator" },
        ]),
        assuranceLevel: "aal2",
        presenter: false,
        syntheticOnly: false,
        requestedRole: "system_administrator",
        presenterRole: "system_administrator",
        commandType: "reset_demo",
      }),
    ).toThrow("PRESENTER_SIMULATION_DENIED");
  });

  it("allows AAL1 only for an explicitly entitled synthetic presenter simulation", () => {
    const presenterAssignment: ActiveRoleAssignment = {
      ...directManager,
      role: "finance_reviewer",
      assignmentType: "presenter_simulation",
    };
    expect(
      authorizePhaseThreeActor({
        authority: authority([presenterAssignment]),
        assuranceLevel: "aal1",
        presenter: true,
        syntheticOnly: true,
        presenterRole: "finance_reviewer",
        commandType: "phase3_bank_decide",
      }),
    ).toMatchObject({
      activeRole: "finance_reviewer",
      protectedAction: true,
      simulation: true,
    });

    expect(() =>
      authorizePhaseThreeActor({
        authority: authority([presenterAssignment]),
        assuranceLevel: "aal1",
        presenter: true,
        syntheticOnly: false,
        presenterRole: "finance_reviewer",
        commandType: "phase3_bank_decide",
      }),
    ).toThrow("PRESENTER_SIMULATION_DENIED");
  });

  it("rejects unassigned, expired, and presenter-only role grants", () => {
    const expired: ActiveRoleAssignment = {
      ...directManager,
      expiresAt: "2026-02-01T00:00:00.000Z",
    };
    expect(() =>
      authorizePhaseThreeActor({
        authority: authority([expired]),
        assuranceLevel: "aal2",
        presenter: false,
        syntheticOnly: false,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "phase3_supplier_decide",
      }),
    ).toThrow("ROLE_ACCESS_DENIED");

    expect(() =>
      authorizePhaseThreeActor({
        authority: authority([
          { ...directManager, assignmentType: "presenter_simulation" },
        ]),
        assuranceLevel: "aal2",
        presenter: false,
        syntheticOnly: true,
        requestedRole: "purchasing_manager",
        presenterRole: "requester",
        commandType: "phase3_supplier_decide",
      }),
    ).toThrow("ROLE_ACCESS_DENIED");
  });

  it("binds a supplier identity to one organization and explicit scope", () => {
    const supplierAuthority = authority([]);
    supplierAuthority.supplierAccess.push({
      supplierOrganizationId: "supplier-org-blue-ridge",
      supplierId: "vendor-003",
      scopes: ["supplier_response:submit"],
    });
    expect(
      requireSupplierScope({
        authority: supplierAuthority,
        supplierOrganizationId: "supplier-org-blue-ridge",
        supplierId: "vendor-003",
        requiredScope: "supplier_response:submit",
      }),
    ).toMatchObject({ supplierId: "vendor-003" });

    expect(() =>
      requireSupplierScope({
        authority: supplierAuthority,
        supplierOrganizationId: "supplier-org-volunteer",
        requiredScope: "supplier_response:submit",
      }),
    ).toThrow("SUPPLIER_ACCESS_DENIED");

    expect(() =>
      requireSupplierScope({
        authority: supplierAuthority,
        supplierOrganizationId: "supplier-org-blue-ridge",
        supplierId: "vendor-999",
        requiredScope: "supplier_response:submit",
      }),
    ).toThrow("SUPPLIER_ACCESS_DENIED");
  });
});
