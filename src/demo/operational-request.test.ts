import { describe, expect, it } from "vitest";

import { tenantThemes } from "@/config/organizations";
import { assertDemoIntegrity } from "@/demo/integrity";
import { createDemoState } from "@/demo/seed";
import {
  cloneOperationalRequest,
  acknowledgeOperationalPurchaseOrder,
  closeOperationalPurchaseOrder,
  reopenOperationalPurchaseOrder,
  createOperationalPurchaseOrder,
  createOperationalRequest,
  decideOperationalApproval,
  exportOperationalPaymentReadiness,
  issueOperationalPurchaseOrder,
  matchOperationalInvoice,
  recordOperationalCredit,
  recordOperationalInvoice,
  recordOperationalReceipt,
  resolveOperationalInvoice,
  submitOperationalRequest,
  updateOperationalRequest,
  withdrawOperationalRequest,
  type OperationalActorContext,
} from "@/demo/workflow";

const requester: OperationalActorContext = {
  userId: "00000000-0000-4000-8000-000000000101",
  activeRole: "requester",
  departmentIds: ["dept-lending"],
  locationIds: ["loc-riverstone"],
};

function actor(
  activeRole: OperationalActorContext["activeRole"],
  userId: string,
  approvalLimitCents = 1_000_000,
): OperationalActorContext {
  return {
    userId,
    activeRole,
    departmentIds: ["dept-lending"],
    locationIds: ["loc-riverstone"],
    approvalLimitCents,
  };
}

function createRequest() {
  return createOperationalRequest(
    createDemoState(tenantThemes["org-y12-demo"], "2026-07-29"),
    {
      title: "Branch network support services",
      departmentId: "dept-lending",
      locationId: "loc-riverstone",
      requiredDate: "2026-08-29",
      businessJustification:
        "Provide governed support coverage for branch network equipment and documented service acceptance.",
      requestChannel: "service",
      priority: "normal",
      attachments: ["statement-of-work.pdf"],
      lines: [
        {
          description: "Quarterly branch network support service",
          quantity: 1,
          unitPriceCents: 250_000,
          glAccount: "6200-IT-SERVICES",
        },
      ],
    },
    requester,
  );
}

function fullyApproveRequest(state = createRequest()) {
  const request = state.requests.at(-1)!;
  let next = submitOperationalRequest(
    state,
    request.id,
    requester,
  );
  for (const [role, userId] of [
    [
      "department_manager",
      "00000000-0000-4000-8000-000000000201",
    ],
    ["it_reviewer", "00000000-0000-4000-8000-000000000202"],
    [
      "purchasing_manager",
      "00000000-0000-4000-8000-000000000203",
    ],
    [
      "finance_reviewer",
      "00000000-0000-4000-8000-000000000204",
    ],
  ] as const) {
    const approval = next.approvals.find(
      (item) =>
        item.requestId === request.id &&
        item.role === role &&
        item.status === "pending",
    )!;
    next = decideOperationalApproval(
      next,
      approval.id,
      "approve",
      "Reviewed request facts, authority, budget, policy, and retained evidence.",
      actor(role, userId),
    );
  }
  return next;
}

describe("operational request lifecycle", () => {
  it("blocks an exact duplicate commitment before a second draft is created", () => {
    const state = createRequest();
    expect(() =>
      createOperationalRequest(
        state,
        {
          title: "A different title cannot evade duplicate detection",
          departmentId: "dept-lending",
          locationId: "loc-riverstone",
          requiredDate: "2026-08-29",
          businessJustification:
            "This second request intentionally repeats the same scoped commitment for duplicate-control testing.",
          requestChannel: "service",
          priority: "normal",
          attachments: ["duplicate-support.pdf"],
          lines: [
            {
              description: "Quarterly branch network support service",
              quantity: 1,
              unitPriceCents: 250_000,
              glAccount: "6200-IT-SERVICES",
            },
          ],
        },
        requester,
      ),
    ).toThrow(/possible duplicate request blocked/i);
    expect(state.requests.filter((request) => request.requestChannel)).toHaveLength(
      1,
    );
  });

  it("creates, revises, submits, parallel-approves, and clones a request", () => {
    let state = createRequest();
    const request = state.requests.at(-1)!;
    expect(request.requesterId).toBe(requester.userId);
    expect(request.recommendedTotalCents).toBe(250_000);

    state = updateOperationalRequest(
      state,
      {
        requestId: request.id,
        title: "Branch network support and monitoring",
        requiredDate: "2026-09-01",
        businessJustification:
          "Provide governed support and monitoring coverage for branch network equipment with documented service acceptance.",
        priority: "high",
        attachments: ["statement-of-work-v2.pdf"],
        lines: [
          {
            description: "Quarterly branch network support and monitoring",
            quantity: 1,
            unitPriceCents: 275_000,
            glAccount: "6200-IT-SERVICES",
          },
        ],
      },
      requester,
    );
    expect(state.requests.at(-1)?.revision).toBe(2);

    state = submitOperationalRequest(state, request.id, requester);
    expect(state.requests.at(-1)?.status).toBe("submitted");
    expect(
      state.approvals.filter((item) => item.requestId === request.id),
    ).toHaveLength(4);

    const decide = (
      role: OperationalActorContext["activeRole"],
      userId: string,
    ) => {
      const approval = state.approvals.find(
        (item) =>
          item.requestId === request.id &&
          item.role === role &&
          item.status === "pending",
      )!;
      state = decideOperationalApproval(
        state,
        approval.id,
        "approve",
        "Reviewed request facts, authority, budget, policy, and retained evidence.",
        actor(role, userId),
      );
    };
    decide("department_manager", "00000000-0000-4000-8000-000000000201");
    decide("it_reviewer", "00000000-0000-4000-8000-000000000202");
    decide("purchasing_manager", "00000000-0000-4000-8000-000000000203");
    expect(state.requests.at(-1)?.status).toBe("submitted");
    decide("finance_reviewer", "00000000-0000-4000-8000-000000000204");
    expect(state.requests.at(-1)?.status).toBe("approved");

    state = cloneOperationalRequest(
      state,
      request.id,
      "2026-10-01",
      requester,
    );
    expect(state.requests.at(-1)?.status).toBe("draft");
    expect(state.requests.at(-1)?.attachments).toEqual([]);
    expect(state.requests.at(-1)?.requesterId).toBe(requester.userId);
    assertDemoIntegrity(state);
  });

  it("withdraws a submitted request and closes every outstanding approval", () => {
    let state = createRequest();
    const request = state.requests.at(-1)!;
    state = submitOperationalRequest(state, request.id, requester);
    state = withdrawOperationalRequest(
      state,
      request.id,
      "The requester documented that the business need ended before any approval or commitment.",
      requester,
    );

    expect(state.requests.at(-1)).toMatchObject({
      status: "withdrawn",
      fieldsLocked: true,
    });
    expect(
      state.approvals
        .filter((approval) => approval.requestId === request.id)
        .every((approval) => approval.status === "rejected"),
    ).toBe(true);
    expect(state.auditEvents.at(-1)?.action).toBe(
      "request.operational_withdrawn",
    );
    expect(() =>
      withdrawOperationalRequest(
        state,
        request.id,
        "A second withdrawal must be rejected without changing retained evidence.",
        requester,
      ),
    ).toThrow(/only a draft, returned, or unapproved submitted request/i);
  });

  it("enforces scope, self-approval, approval limit, and governed special paths", () => {
    expect(() =>
      createOperationalRequest(
        createDemoState(tenantThemes["org-y12-demo"], "2026-07-29"),
        {
          title: "Out of scope equipment",
          departmentId: "dept-it",
          locationId: "loc-riverstone",
          requiredDate: "2026-08-29",
          businessJustification:
            "This request deliberately targets a department outside the assigned role scope.",
          requestChannel: "catalog_goods",
          priority: "normal",
          attachments: [],
          lines: [
            {
              description: "Approved equipment",
              quantity: 1,
              unitPriceCents: 10_000,
              glAccount: "6100-EQUIPMENT",
            },
          ],
        },
        requester,
      ),
    ).toThrow(/outside the active role scope/i);

    let state = createRequest();
    const request = state.requests.at(-1)!;
    state = submitOperationalRequest(state, request.id, requester);
    const first = state.approvals.find(
      (item) => item.requestId === request.id && item.status === "pending",
    )!;
    expect(() =>
      decideOperationalApproval(
        state,
        first.id,
        "approve",
        "The requester must never be able to approve their own request.",
        actor("department_manager", requester.userId),
      ),
    ).toThrow(/cannot approve their own/i);
    expect(() =>
      decideOperationalApproval(
        state,
        first.id,
        "approve",
        "The amount is above this approver's explicitly assigned limit.",
        actor(
          "department_manager",
          "00000000-0000-4000-8000-000000000301",
          100_000,
        ),
      ),
    ).toThrow(/exceeds the active approval limit/i);

    expect(() =>
      createOperationalRequest(
        createDemoState(tenantThemes["org-y12-demo"], "2026-07-29"),
        {
          title: "Emergency branch equipment",
          departmentId: "dept-lending",
          locationId: "loc-riverstone",
          requiredDate: "2026-07-30",
          businessJustification:
            "Replace failed branch equipment needed to maintain approved business operations.",
          requestChannel: "emergency",
          priority: "urgent",
          attachments: ["incident-record.pdf"],
          lines: [
            {
              description: "Emergency replacement equipment",
              quantity: 1,
              unitPriceCents: 100_000,
              glAccount: "6100-EQUIPMENT",
            },
          ],
        },
        requester,
      ),
    ).toThrow(/separate justification/i);

    const recurring = createOperationalRequest(
      createDemoState(tenantThemes["org-y12-demo"], "2026-07-29"),
      {
        title: "Recurring secure media disposal",
        departmentId: "dept-lending",
        locationId: "loc-riverstone",
        requiredDate: "2026-08-15",
        businessJustification:
          "Provide recurring controlled disposal service for approved branch records and media.",
        requestChannel: "recurring",
        priority: "normal",
        recurringSchedule: {
          cadence: "quarterly",
          startsOn: "2026-08-15",
        },
        attachments: ["service-scope.pdf"],
        lines: [
          {
            description: "Quarterly secure media disposal service",
            quantity: 1,
            unitPriceCents: 75_000,
            glAccount: "6200-RECORDS",
          },
        ],
      },
      requester,
    );
    expect(recurring.requests.at(-1)?.recurringSchedule?.nextOccurrence).toBe(
      "2026-11-15",
    );
  });

  it("runs an ordinary approved request through PO, receipt, invoice, match, export, and closure", () => {
    let state = fullyApproveRequest();
    const request = state.requests.at(-1)!;
    const buyer = actor(
      "purchasing_specialist",
      "00000000-0000-4000-8000-000000000401",
    );
    state = createOperationalPurchaseOrder(
      state,
      {
        requestId: request.id,
        vendorId: "vendor-003",
        expectedDate: "2026-09-01",
        shippingCents: 0,
        taxCents: 0,
        contractReference: "",
      },
      buyer,
    );
    const purchaseOrder = state.purchaseOrders[0]!;
    state = issueOperationalPurchaseOrder(
      state,
      purchaseOrder.id,
      buyer,
    );
    state = acknowledgeOperationalPurchaseOrder(
      state,
      purchaseOrder.id,
      "Supplier portal acknowledgment ACK-9001",
      buyer,
    );
    const receiver = actor(
      "receiving_clerk",
      "00000000-0000-4000-8000-000000000402",
    );
    state = recordOperationalReceipt(
      state,
      {
        purchaseOrderId: purchaseOrder.id,
        packingSlip: "service-acceptance-9001.pdf",
        notes:
          "Quarterly support service was reviewed against the statement of work and accepted.",
        lines: purchaseOrder.lines.map((line) => ({
          lineId: line.id,
          quantity: line.purchaseQuantity,
          acceptedQuantity: line.purchaseQuantity,
          damagedQuantity: 0,
          rejectedQuantity: 0,
          returnedQuantity: 0,
          serialNumbers: [],
          lotNumbers: [],
          serviceAccepted: true,
          serviceAcceptanceEvidence:
            "service-acceptance-9001.pdf",
        })),
      },
      receiver,
    );
    const accountsPayable = actor(
      "accounts_payable",
      "00000000-0000-4000-8000-000000000403",
    );
    state = recordOperationalInvoice(
      state,
      {
        purchaseOrderId: purchaseOrder.id,
        invoiceNumber: "BRNS-9001",
        invoiceDate: "2026-09-02",
        dueDate: "2026-10-02",
        shippingCents: 0,
        taxCents: 0,
        uploadedDocument: "BRNS-9001.pdf",
        lines: purchaseOrder.lines.map((line) => ({
          lineId: line.id,
          quantity: line.purchaseQuantity,
          unitPriceCents: line.unitPriceCents,
        })),
      },
      accountsPayable,
    );
    const invoice = state.invoices[0]!;
    state = matchOperationalInvoice(
      state,
      {
        invoiceId: invoice.id,
        matchMode: "three_way",
        amountToleranceCents: 0,
        quantityTolerance: 0,
      },
      accountsPayable,
    );
    expect(state.invoices[0]?.paymentStatus).toBe("ready");
    state = exportOperationalPaymentReadiness(
      state,
      invoice.id,
      accountsPayable,
    );
    state = recordOperationalCredit(
      state,
      {
        invoiceId: invoice.id,
        creditNumber: "BRNS-CREDIT-9001",
        creditCents: 25_000,
        reason:
          "Supplier issued a documented service-level credit against the accepted invoice.",
        uploadedDocument: "BRNS-CREDIT-9001.pdf",
      },
      accountsPayable,
    );
    const credit = state.invoices[0]!;
    state = exportOperationalPaymentReadiness(
      state,
      credit.id,
      accountsPayable,
    );
    state = closeOperationalPurchaseOrder(
      state,
      purchaseOrder.id,
      "Receiving, match, and payment-readiness export reconcile with retained evidence.",
      actor(
        "purchasing_manager",
        "00000000-0000-4000-8000-000000000404",
      ),
    );

    expect(state.purchaseOrders[0]?.status).toBe("closed");
    expect(
      state.invoices
        .filter(
          (candidate) =>
            candidate.purchaseOrderId === purchaseOrder.id,
        )
        .every(
          (candidate) => candidate.paymentStatus === "exported",
        ),
    ).toBe(true);
    expect(credit.invoiceType).toBe("credit");
    expect(
      state.auditEvents.some(
        (event) => event.action === "po.operational_closed",
      ),
    ).toBe(true);
    state = reopenOperationalPurchaseOrder(
      state,
      purchaseOrder.id,
      "A documented administrative correction requires authorized reopening without removing prior evidence.",
      actor(
        "purchasing_manager",
        "00000000-0000-4000-8000-000000000404",
      ),
    );
    expect(state.purchaseOrders[0]?.status).toBe("invoiced");
    expect(state.auditEvents.at(-1)?.action).toBe("po.operational_reopened");
    expect(() =>
      reopenOperationalPurchaseOrder(
        state,
        purchaseOrder.id,
        "A non-manager role cannot reopen a purchase order under any circumstances.",
        accountsPayable,
      ),
    ).toThrow(/requires one of these active roles/i);
    assertDemoIntegrity(state);
  });

  it("blocks over-receipt, non-service two-way matching, and duplicate acceptance", () => {
    let state = fullyApproveRequest();
    const request = state.requests.at(-1)!;
    const buyer = actor(
      "purchasing_manager",
      "00000000-0000-4000-8000-000000000501",
    );
    state = createOperationalPurchaseOrder(
      state,
      {
        requestId: request.id,
        vendorId: "vendor-003",
        expectedDate: "2026-09-01",
        shippingCents: 0,
        taxCents: 0,
        contractReference: "",
      },
      buyer,
    );
    const purchaseOrder = state.purchaseOrders[0]!;
    state = issueOperationalPurchaseOrder(
      state,
      purchaseOrder.id,
      buyer,
    );
    const receiver = actor(
      "receiving_clerk",
      "00000000-0000-4000-8000-000000000502",
    );
    expect(() =>
      recordOperationalReceipt(
        state,
        {
          purchaseOrderId: purchaseOrder.id,
          packingSlip: "overage.pdf",
          notes:
            "This receipt deliberately attempts to accept more than the ordered quantity.",
          lines: purchaseOrder.lines.map((line) => ({
            lineId: line.id,
            quantity: line.purchaseQuantity + 1,
            acceptedQuantity: line.purchaseQuantity + 1,
            damagedQuantity: 0,
            rejectedQuantity: 0,
            returnedQuantity: 0,
            serialNumbers: [],
            lotNumbers: [],
            serviceAccepted: true,
            serviceAcceptanceEvidence: "service-acceptance.pdf",
          })),
        },
        receiver,
      ),
    ).toThrow(/exceeds the remaining purchase order quantity/i);
    const routedOverage = recordOperationalReceipt(
      state,
      {
        purchaseOrderId: purchaseOrder.id,
        packingSlip: "overage-routed.pdf",
        notes:
          "Ordered quantity is accepted while the additional delivered unit is rejected and routed for disposition.",
        overToleranceAction: "route_for_approval",
        overToleranceRationale:
          "The supplier delivered one unrequested extra unit that must remain controlled pending approval.",
        lines: purchaseOrder.lines.map((line) => ({
          lineId: line.id,
          quantity: line.purchaseQuantity + 1,
          acceptedQuantity: line.purchaseQuantity,
          damagedQuantity: 0,
          rejectedQuantity: 1,
          returnedQuantity: 1,
          serialNumbers: [],
          lotNumbers: [],
          serviceAccepted: true,
          serviceAcceptanceEvidence: "service-acceptance.pdf",
        })),
      },
      receiver,
    );
    expect(routedOverage.receipts.at(-1)?.lifecycleStatus).toBe(
      "pending_inspection",
    );
    expect(
      routedOverage.auditEvents.at(-1)?.action,
    ).toBe("receipt.operational_over_tolerance_routed");

    const accountsPayable = actor(
      "accounts_payable",
      "00000000-0000-4000-8000-000000000503",
    );
    const invoiceInput = {
      purchaseOrderId: purchaseOrder.id,
      invoiceNumber: "DUP-9001",
      invoiceDate: "2026-09-02",
      dueDate: "2026-10-02",
      shippingCents: 0,
      taxCents: 0,
      uploadedDocument: "DUP-9001.pdf",
      lines: purchaseOrder.lines.map((line) => ({
        lineId: line.id,
        quantity: line.purchaseQuantity,
        unitPriceCents: line.unitPriceCents,
      })),
    };
    state = recordOperationalInvoice(
      state,
      invoiceInput,
      accountsPayable,
    );
    state = recordOperationalInvoice(
      state,
      invoiceInput,
      accountsPayable,
    );
    const duplicate = state.invoices[0]!;
    expect(duplicate.duplicateRisk).toBe("possible");
    expect(() =>
      resolveOperationalInvoice(
        state,
        duplicate.id,
        "accept",
        "The duplicate control should prevent this attempted acceptance.",
        actor(
          "finance_reviewer",
          "00000000-0000-4000-8000-000000000504",
        ),
      ),
    ).toThrow(/duplicate cannot be accepted/i);
  });
});
