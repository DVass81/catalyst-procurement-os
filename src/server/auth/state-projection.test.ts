import { describe, expect, it } from "vitest";

import { tenantThemes } from "@/config/organizations";
import { createDemoState } from "@/demo/seed";
import type { TenantAuthority } from "@/server/auth/authority";
import { projectStateForAuthorizedRole } from "@/server/auth/state-projection";

const authority: TenantAuthority = {
  tenantId: "org-y12-demo",
  policy: {
    internalAccessMode: "invite_magic_link",
    supplierAccessMode: "invite_magic_link",
    provisioningMode: "manual_review",
    requireAal2ForProtectedActions: true,
    allowSyntheticPresenterAal1: false,
    status: "active",
    version: 1,
  },
  roles: [
    {
      role: "supplier_user",
      assignmentType: "direct",
      departmentIds: [],
      locationIds: [],
      categoryIds: [],
      workflowOwnerIds: [],
      startsAt: "2026-01-01T00:00:00.000Z",
      emergencyAccess: false,
    },
  ],
  supplierAccess: [
    {
      supplierOrganizationId: "supplier-org-volunteer",
      supplierId: "vendor-001",
      scopes: ["supplier_profile:update", "supplier_response:submit"],
    },
  ],
};

describe("supplier state projection", () => {
  it("returns only the assigned supplier's portal records", () => {
    const source = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    const rfq = source.phaseThree.rfqs[0]!;
    rfq.questions.push(
      {
        id: "question-own",
        supplierId: "vendor-001",
        supplierOrganizationId: "supplier-org-volunteer",
        question: "Own supplier question",
        submittedAt: "2026-07-29T12:00:00.000Z",
        status: "open",
      },
      {
        id: "question-other",
        supplierId: "vendor-002",
        supplierOrganizationId: "supplier-org-ridgeline",
        question: "Confidential other-supplier question",
        submittedAt: "2026-07-29T12:01:00.000Z",
        status: "open",
      },
    );
    rfq.conflicts.push({
      id: "conflict-internal",
      disclosedByRole: "purchasing_specialist",
      supplierId: "vendor-002",
      description: "Internal conflict evidence",
      status: "open",
      disclosedAt: "2026-07-29T12:02:00.000Z",
    });
    rfq.negotiations.push({
      id: "negotiation-internal",
      supplierId: "vendor-002",
      round: 1,
      recordedAt: "2026-07-29T12:03:00.000Z",
      recordedByRole: "purchasing_manager",
      summary: "Confidential negotiation record",
      evidence: ["synthetic:evidence"],
    });
    rfq.decisionNotices.push(
      {
        id: "notice-own",
        supplierId: "vendor-001",
        noticeType: "non_award",
        issuedAt: "2026-07-29T12:04:00.000Z",
        issuedByRole: "purchasing_manager",
        summary: "Own notice",
        evidence: ["synthetic:evidence"],
      },
      {
        id: "notice-other",
        supplierId: "vendor-002",
        noticeType: "award",
        issuedAt: "2026-07-29T12:05:00.000Z",
        issuedByRole: "purchasing_manager",
        summary: "Other supplier notice",
        evidence: ["synthetic:evidence"],
      },
    );
    const projected = projectStateForAuthorizedRole({
      state: source,
      authority,
      activeRole: "supplier_user",
      simulation: false,
      userId: "supplier-user-id",
    });

    expect(projected.vendors.map((vendor) => vendor.id)).toEqual([
      "vendor-001",
    ]);
    expect(projected.requests).toEqual([]);
    expect(projected.invoices).toEqual([]);
    expect(
      projected.phaseThree.supplierApplications.every(
        (application) =>
          application.supplierOrganizationId ===
          "supplier-org-volunteer",
      ),
    ).toBe(true);
    expect(
      projected.phaseThree.rfqs.every(
        (rfq) =>
          rfq.suppliers.length === 1 &&
          rfq.suppliers[0]?.supplierOrganizationId ===
            "supplier-org-volunteer" &&
          rfq.responses.every(
            (response) =>
              response.supplierOrganizationId ===
              "supplier-org-volunteer",
          ),
      ),
    ).toBe(true);
    expect(projected.phaseThree.reportSnapshots).toEqual([]);
    expect(projected.phaseThree.integrations).toEqual([]);
    expect(projected.phaseThree.rfqs[0]?.questions.map((item) => item.id)).toEqual([
      "question-own",
    ]);
    expect(projected.phaseThree.rfqs[0]?.conflicts).toEqual([]);
    expect(projected.phaseThree.rfqs[0]?.negotiations).toEqual([]);
    expect(
      projected.phaseThree.rfqs[0]?.decisionNotices.map((item) => item.id),
    ).toEqual(["notice-own"]);
  });

  it("does not restrict an authorized synthetic presenter", () => {
    const source = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    expect(
      projectStateForAuthorizedRole({
        state: source,
        authority,
        activeRole: "supplier_user",
        simulation: true,
        userId: "presenter-id",
      }),
    ).toBe(source);
  });
});

describe("internal state projection", () => {
  it("limits a requester to records created by the signed-in identity", () => {
    const source = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    source.requests.push({
      ...structuredClone(source.requests[0]!),
      id: "request-operational-y12-0001",
      requestNumber: "Y12-REQ-9001",
      requesterId: "requester-user-id",
      createdByActorId: "requester-user-id",
    });
    const requesterAuthority: TenantAuthority = {
      ...authority,
      roles: [
        {
          ...authority.roles[0]!,
          role: "requester",
          departmentIds: ["dept-lending"],
          locationIds: ["loc-riverstone"],
        },
      ],
      supplierAccess: [],
    };
    const projected = projectStateForAuthorizedRole({
      state: source,
      authority: requesterAuthority,
      activeRole: "requester",
      simulation: false,
      userId: "requester-user-id",
    });

    expect(projected.requests.map((request) => request.id)).toEqual([
      "request-operational-y12-0001",
    ]);
    expect(projected.activeUserId).toBe("requester-user-id");
    expect(projected.activeRole).toBe("requester");
    expect(
      projected.users.some((user) => user.id === "requester-user-id"),
    ).toBe(true);
    expect(projected.configurationVersions).toEqual([]);
    expect(projected.auditPackages).toEqual([]);
  });

  it("fails closed when a department-scoped role has no department scope", () => {
    const source = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    const managerAuthority: TenantAuthority = {
      ...authority,
      roles: [
        {
          ...authority.roles[0]!,
          role: "department_manager",
          departmentIds: [],
        },
      ],
      supplierAccess: [],
    };
    const projected = projectStateForAuthorizedRole({
      state: source,
      authority: managerAuthority,
      activeRole: "department_manager",
      simulation: false,
      userId: "manager-user-id",
    });

    expect(projected.requests).toEqual([]);
    expect(projected.approvals).toEqual([]);
    expect(projected.purchaseOrders).toEqual([]);
    expect(projected.invoices).toEqual([]);
  });
});
