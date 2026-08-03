import { describe, expect, it } from "vitest";

import { tenantThemes, type TenantId } from "@/config/organizations";
import { assertDemoIntegrity } from "@/demo/integrity";
import { createDemoState } from "@/demo/seed";
import {
  acknowledgeOperationalPurchaseOrder,
  cloneOperationalRequest,
  closeOperationalPurchaseOrder,
  createOperationalPurchaseOrder,
  createOperationalRequest,
  decideOperationalApproval,
  exportOperationalPaymentReadiness,
  issueOperationalPurchaseOrder,
  matchOperationalInvoice,
  recordOperationalInvoice,
  recordOperationalReceipt,
  reopenOperationalPurchaseOrder,
  resolveOperationalInvoice,
  submitOperationalRequest,
  updateOperationalRequest,
  withdrawOperationalRequest,
  type OperationalActorContext,
} from "@/demo/workflow";
import {
  naturalWorkflowProfiles,
  type NaturalWorkflowProfile,
} from "@/qualification/natural-workflows";

const tenants: TenantId[] = [
  "org-y12-demo",
  "org-catalyst-community-demo",
];

function actor(
  tenantId: TenantId,
  role: OperationalActorContext["activeRole"],
  suffix: string,
): OperationalActorContext {
  return {
    userId: `${tenantId}:${role}:${suffix}`,
    activeRole: role,
    departmentIds: ["dept-lending"],
    locationIds: ["loc-riverstone"],
    approvalLimitCents: 10_000_000,
  };
}

function requestInput(profile: NaturalWorkflowProfile) {
  return {
    title: profile.title,
    departmentId: "dept-lending",
    locationId: "loc-riverstone",
    requiredDate: profile.requiredDate,
    businessJustification: profile.businessJustification,
    requestChannel: profile.requestChannel,
    priority: profile.priority,
    emergencyJustification: profile.emergencyJustification,
    recurringSchedule: profile.recurringSchedule,
    attachments: profile.attachments,
    lines: profile.lines,
  };
}

describe.each(tenants)("six natural workflows: %s", (tenantId) => {
  it.each(naturalWorkflowProfiles)(
    "completes $id without presenter navigation",
    (profile) => {
      const requester = actor(tenantId, "requester", profile.id);
      let state = createOperationalRequest(
        createDemoState(tenantThemes[tenantId], "2026-08-02"),
        requestInput(profile),
        requester,
      );
      const requestId = state.requests.at(-1)!.id;

      if (profile.id === "loan-officer-equipment") {
        state = submitOperationalRequest(state, requestId, requester);
        const managerApproval = state.approvals.find(
          (approval) =>
            approval.requestId === requestId &&
            approval.role === "department_manager" &&
            approval.status === "pending",
        )!;
        state = decideOperationalApproval(
          state,
          managerApproval.id,
          "return",
          "Please clarify the secure workstation specification before resubmission.",
          actor(tenantId, "department_manager", profile.id),
        );
        state = updateOperationalRequest(
          state,
          {
            ...requestInput(profile),
            requestId,
            title: `${profile.title} â€” clarified specification`,
          },
          requester,
        );
        const previousRouteIds = new Set(
          state.approvals
            .filter((approval) => approval.requestId === requestId)
            .map((approval) => approval.id),
        );
        state = submitOperationalRequest(state, requestId, requester);
        const currentRouteIds = state.approvals
          .filter(
            (approval) =>
              approval.requestId === requestId &&
              ["pending", "not_started"].includes(approval.status),
          )
          .map((approval) => approval.id);
        expect(
          currentRouteIds.every((id) => !previousRouteIds.has(id)),
        ).toBe(true);
      } else {
        state = submitOperationalRequest(state, requestId, requester);
      }

      while (state.requests.find((request) => request.id === requestId)?.status === "submitted") {
        const approval = state.approvals
          .filter(
            (candidate) =>
              candidate.requestId === requestId &&
              candidate.status === "pending",
          )
          .sort((left, right) => left.sequence - right.sequence)[0];
        expect(approval).toBeDefined();
        state = decideOperationalApproval(
          state,
          approval!.id,
          "approve",
          "The assigned reviewer validated scope, authority, coding, budget, policy, and retained evidence.",
          actor(tenantId, approval!.role, profile.id),
        );
      }
      expect(
        state.requests.find((request) => request.id === requestId)?.status,
      ).toBe("approved");

      const buyer = actor(tenantId, "purchasing_specialist", profile.id);
      state = createOperationalPurchaseOrder(
        state,
        {
          requestId,
          vendorId: profile.vendorId,
          expectedDate: profile.requiredDate,
          shippingCents: 0,
          taxCents: 0,
          contractReference: profile.contractReference,
        },
        buyer,
      );
      const order = state.purchaseOrders.find(
        (purchaseOrder) => purchaseOrder.sourceRequestId === requestId,
      )!;
      state = issueOperationalPurchaseOrder(state, order.id, buyer);
      state = acknowledgeOperationalPurchaseOrder(
        state,
        order.id,
        `Supplier portal acknowledgment ${profile.id}`,
        {
          ...actor(tenantId, "supplier_user", profile.id),
          supplierIds: [profile.vendorId],
        },
      );

      const receiver = actor(tenantId, "receiving_clerk", profile.id);
      const service = profile.requestChannel === "recurring";
      if (profile.partialReceiving) {
        state = recordOperationalReceipt(
          state,
          {
            purchaseOrderId: order.id,
            packingSlip: `${profile.id}-partial.pdf`,
            notes: "The first shipment was inspected and accepted as a documented partial receipt.",
            lines: order.lines.map((line) => ({
              lineId: line.id,
              quantity: Math.floor(line.purchaseQuantity / 2),
              acceptedQuantity: Math.floor(line.purchaseQuantity / 2),
              damagedQuantity: 0,
              rejectedQuantity: 0,
              returnedQuantity: 0,
              serialNumbers: Array.from(
                { length: Math.floor(line.purchaseQuantity / 2) },
                (_, index) => `${tenantId}-${profile.id}-A-${index + 1}`,
              ),
              lotNumbers: [],
            })),
          },
          receiver,
        );
        expect(
          state.purchaseOrders.find((candidate) => candidate.id === order.id)
            ?.status,
        ).toBe("partially_received");
      }
      state = recordOperationalReceipt(
        state,
        {
          purchaseOrderId: order.id,
          packingSlip: `${profile.id}-complete.pdf`,
          notes: service
            ? "The recurring cybersecurity service was validated against the contract and accepted."
            : "The remaining equipment was inspected and accepted against the issued purchase order.",
          lines: order.lines.map((line) => {
            const priorAccepted = profile.partialReceiving
              ? Math.floor(line.purchaseQuantity / 2)
              : 0;
            const quantity = line.purchaseQuantity - priorAccepted;
            return {
              lineId: line.id,
              quantity,
              acceptedQuantity: quantity,
              damagedQuantity: 0,
              rejectedQuantity: 0,
              returnedQuantity: 0,
              serialNumbers: service
                ? []
                : Array.from(
                    { length: quantity },
                    (_, index) =>
                      `${tenantId}-${profile.id}-B-${index + priorAccepted + 1}`,
                  ),
              lotNumbers: [],
              serviceAccepted: service || undefined,
              serviceAcceptanceEvidence: service
                ? `${profile.id}-service-acceptance.pdf`
                : undefined,
            };
          }),
        },
        receiver,
      );

      const accountsPayable = actor(
        tenantId,
        "accounts_payable",
        profile.id,
      );
      state = recordOperationalInvoice(
        state,
        {
          purchaseOrderId: order.id,
          invoiceNumber: `${tenantId}-${profile.id}-invoice`,
          invoiceDate: "2026-10-02",
          dueDate: "2026-11-01",
          shippingCents: profile.invoiceFreightCents,
          taxCents: 0,
          uploadedDocument: `${profile.id}-invoice.pdf`,
          lines: order.lines.map((line) => ({
            lineId: line.id,
            quantity: line.purchaseQuantity,
            unitPriceCents: line.unitPriceCents,
          })),
        },
        accountsPayable,
      );
      const invoice = state.invoices.find(
        (candidate) => candidate.purchaseOrderId === order.id,
      )!;
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
      if (profile.invoiceFreightCents > 0) {
        state = resolveOperationalInvoice(
          state,
          invoice.id,
          "accept",
          "Finance independently accepted the documented freight variance within delegated authority after reviewing carrier evidence.",
          actor(tenantId, "finance_reviewer", profile.id),
        );
      }
      state = exportOperationalPaymentReadiness(
        state,
        invoice.id,
        accountsPayable,
      );
      state = closeOperationalPurchaseOrder(
        state,
        order.id,
        "All quantities, receipts, invoice results, and payment-readiness evidence reconcile for governed closeout.",
        actor(tenantId, "purchasing_manager", profile.id),
      );
      state = reopenOperationalPurchaseOrder(
        state,
        order.id,
        "An authorized administrative correction requires reopening while preserving the original closeout evidence.",
        actor(tenantId, "purchasing_manager", profile.id),
      );

      state = cloneOperationalRequest(
        state,
        requestId,
        "2027-01-15",
        requester,
      );
      const cloned = state.requests.at(-1)!;
      state = withdrawOperationalRequest(
        state,
        cloned.id,
        "The cloned future need was withdrawn before submission and before any financial commitment was created.",
        requester,
      );

      expect(
        state.auditEvents.some(
          (event) =>
            event.entityId === order.id &&
            event.action === "po.operational_reopened",
        ),
      ).toBe(true);
      expect(
        state.invoices.find((candidate) => candidate.id === invoice.id)
          ?.paymentStatus,
      ).toBe("exported");
      expect(
        state.requests.find((request) => request.id === cloned.id)?.status,
      ).toBe("withdrawn");
      assertDemoIntegrity(state);
    },
  );
});
