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
} from "@/demo/workflow";
import type { PhaseTwoCommand } from "@/phase-two/commands";

export function executePhaseTwoCommand(
  current: DemoState,
  command: PhaseTwoCommand,
): DemoState {
  let next: DemoState;
  switch (command.type) {
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
