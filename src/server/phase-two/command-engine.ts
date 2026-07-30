import "server-only";

import { assertDemoIntegrity } from "@/demo/integrity";
import type { DemoState } from "@/demo/model";
import {
  acceptInventoryRecommendation,
  acceptStandardsSubstitution,
  analyzeFeaturedRequest,
  confirmBudgetAndCoding,
  completePartialFeaturedReceipt,
  createFeaturedPurchaseOrder,
  decidePurchaseOrderRevision,
  decideApproval,
  delegateApproval,
  decideVendorException,
  activateConfigurationVersion,
  approveConfigurationVersion,
  approveImportBatch,
  generateFeaturedAuditPackage,
  exportPaymentReadiness,
  issueFeaturedPurchaseOrder,
  issuePurchaseOrderRevision,
  jumpToStage,
  postImportBatch,
  proposePurchaseOrderRevision,
  recordPartialFeaturedReceipt,
  receiveFeaturedOrder,
  recordVendorAcknowledgment,
  requestVendorException,
  retryNotificationDelivery,
  sendApprovalReminder,
  escalateApproval,
  bulkApproveLowRisk,
  cancelFeaturedPurchaseOrder,
  closeFeaturedPurchaseOrder,
  resetDemo,
  reverseFeaturedReceipt,
  reverseImportBatch,
  resolveInvoiceException,
  runThreeWayMatch,
  selectVendor,
  submitRequest,
  acknowledgeMandatoryNotification,
  switchRole,
  toggleHighlights,
  toggleNotice,
  submitConfigurationForReview,
  validateConfigurationVersion,
  createOperationalRequest,
  updateOperationalRequest,
  cloneOperationalRequest,
  submitOperationalRequest,
  decideOperationalApproval,
  createOperationalPurchaseOrder,
  issueOperationalPurchaseOrder,
  acknowledgeOperationalPurchaseOrder,
  recordOperationalReceipt,
  recordOperationalInvoice,
  matchOperationalInvoice,
  recordOperationalCredit,
  resolveOperationalInvoice,
  exportOperationalPaymentReadiness,
  cancelOperationalPurchaseOrder,
  closeOperationalPurchaseOrder,
  type OperationalActorContext,
} from "@/demo/workflow";
import type { PhaseTwoCommand } from "@/phase-two/commands";

export function executePhaseTwoCommand(
  current: DemoState,
  command: PhaseTwoCommand,
  actor?: OperationalActorContext,
): DemoState {
  let next: DemoState;
  switch (command.type) {
    case "create_operational_request":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = createOperationalRequest(current, command, actor);
      break;
    case "update_operational_request":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = updateOperationalRequest(current, command, actor);
      break;
    case "clone_operational_request":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = cloneOperationalRequest(
        current,
        command.sourceRequestId,
        command.requiredDate,
        actor,
      );
      break;
    case "submit_operational_request":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = submitOperationalRequest(current, command.requestId, actor);
      break;
    case "decide_operational_approval":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = decideOperationalApproval(
        current,
        command.approvalId,
        command.decision,
        command.comments,
        actor,
      );
      break;
    case "create_operational_purchase_order":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = createOperationalPurchaseOrder(current, command, actor);
      break;
    case "issue_operational_purchase_order":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = issueOperationalPurchaseOrder(
        current,
        command.purchaseOrderId,
        actor,
      );
      break;
    case "acknowledge_operational_purchase_order":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = acknowledgeOperationalPurchaseOrder(
        current,
        command.purchaseOrderId,
        command.acknowledgmentReference,
        actor,
      );
      break;
    case "record_operational_receipt":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = recordOperationalReceipt(current, command, actor);
      break;
    case "record_operational_invoice":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = recordOperationalInvoice(current, command, actor);
      break;
    case "match_operational_invoice":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = matchOperationalInvoice(current, command, actor);
      break;
    case "record_operational_credit":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = recordOperationalCredit(current, command, actor);
      break;
    case "resolve_operational_invoice":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = resolveOperationalInvoice(
        current,
        command.invoiceId,
        command.decision,
        command.justification,
        actor,
      );
      break;
    case "export_operational_payment_readiness":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = exportOperationalPaymentReadiness(
        current,
        command.invoiceId,
        actor,
      );
      break;
    case "cancel_operational_purchase_order":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = cancelOperationalPurchaseOrder(
        current,
        command.purchaseOrderId,
        command.reason,
        actor,
      );
      break;
    case "close_operational_purchase_order":
      if (!actor) throw new Error("COMMAND_ACTOR_CONTEXT_REQUIRED");
      next = closeOperationalPurchaseOrder(
        current,
        command.purchaseOrderId,
        command.reason,
        actor,
      );
      break;
    case "analyze_request":
      next = analyzeFeaturedRequest(current);
      break;
    case "accept_inventory_recommendation":
      next = acceptInventoryRecommendation(current);
      break;
    case "accept_standards_substitution":
      next = acceptStandardsSubstitution(current);
      break;
    case "select_vendor":
      next = selectVendor(current, command.vendorId);
      break;
    case "request_vendor_exception":
      next = requestVendorException(
        current,
        command.vendorId,
        command.businessJustification,
        command.evidence,
      );
      break;
    case "decide_vendor_exception":
      next = decideVendorException(
        current,
        command.exceptionId,
        command.decision,
      );
      break;
    case "confirm_budget_and_coding":
      next = confirmBudgetAndCoding(current);
      break;
    case "submit_request":
      next = submitRequest(current);
      break;
    case "decide_approval":
      next = decideApproval(current, command.decision, command.comments);
      break;
    case "delegate_approval":
      next = delegateApproval(current, {
        approvalId: command.approvalId,
        delegateRole: command.delegateRole,
        delegationType: command.delegationType,
        startsOn: command.startsOn,
        expiresOn: command.expiresOn,
        reason: command.reason,
      });
      break;
    case "send_approval_reminder":
      next = sendApprovalReminder(current, command.approvalId);
      break;
    case "escalate_approval":
      next = escalateApproval(
        current,
        command.approvalId,
        command.reason,
      );
      break;
    case "bulk_decide_approvals":
      next = bulkApproveLowRisk(
        current,
        command.approvalIds,
        command.rationale,
      );
      break;
    case "create_purchase_order":
      next = createFeaturedPurchaseOrder(current);
      break;
    case "issue_purchase_order":
      next = issueFeaturedPurchaseOrder(current);
      break;
    case "record_vendor_acknowledgment":
      next = recordVendorAcknowledgment(current);
      break;
    case "receive_order":
      next = receiveFeaturedOrder(current);
      break;
    case "record_partial_receipt":
      next = recordPartialFeaturedReceipt(current);
      break;
    case "complete_partial_receipt":
      next = completePartialFeaturedReceipt(current);
      break;
    case "reverse_receipt":
      next = reverseFeaturedReceipt(current, command.receiptId, command.reason);
      break;
    case "propose_po_revision":
      next = proposePurchaseOrderRevision(
        current,
        command.reason,
        command.proposedTotalCents,
      );
      break;
    case "decide_po_revision":
      next = decidePurchaseOrderRevision(
        current,
        command.revisionId,
        command.decision,
      );
      break;
    case "issue_po_revision":
      next = issuePurchaseOrderRevision(current, command.revisionId);
      break;
    case "cancel_purchase_order":
      next = cancelFeaturedPurchaseOrder(current, command.reason);
      break;
    case "close_purchase_order":
      next = closeFeaturedPurchaseOrder(current, command.reason);
      break;
    case "run_invoice_match":
      next = runThreeWayMatch(current);
      break;
    case "resolve_invoice_exception":
      next = resolveInvoiceException(
        current,
        command.decision,
        command.justification,
      );
      break;
    case "export_payment_readiness":
      next = exportPaymentReadiness(current);
      break;
    case "switch_role":
      next = switchRole(current, command.role);
      break;
    case "jump_to_stage":
      next = jumpToStage(command.stage, current);
      break;
    case "reset_demo":
      next = resetDemo(current);
      break;
    case "toggle_notice":
      next = toggleNotice(current);
      break;
    case "toggle_highlights":
      next = toggleHighlights(current);
      break;
    case "validate_configuration":
      next = validateConfigurationVersion(current, command.configurationId);
      break;
    case "submit_configuration_review":
      next = submitConfigurationForReview(current, command.configurationId);
      break;
    case "approve_configuration":
      next = approveConfigurationVersion(current, command.configurationId);
      break;
    case "activate_configuration":
      next = activateConfigurationVersion(current, command.configurationId);
      break;
    case "approve_import":
      next = approveImportBatch(current, command.batchId);
      break;
    case "post_import":
      next = postImportBatch(current, command.batchId);
      break;
    case "reverse_import":
      next = reverseImportBatch(current, command.batchId, command.reason);
      break;
    case "generate_audit_package":
      next = generateFeaturedAuditPackage(current);
      break;
    case "retry_notification":
      next = retryNotificationDelivery(current, command.notificationId);
      break;
    case "acknowledge_notification":
      next = acknowledgeMandatoryNotification(current, command.notificationId);
      break;
  }
  if (
    next.organization.organizationId !== current.organization.organizationId
  ) {
    throw new Error("TENANT_STATE_MISMATCH");
  }
  assertDemoIntegrity(next);
  return next;
}
