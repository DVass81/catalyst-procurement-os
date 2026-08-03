import { z } from "zod";

import type { DemoRole, WorkflowStage } from "@/demo/model";

export const phaseTwoCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_operational_request"),
    title: z.string().trim().min(5).max(160),
    departmentId: z.string().min(1).max(120),
    locationId: z.string().min(1).max(120),
    requiredDate: z.string().date(),
    businessJustification: z.string().trim().min(20).max(2_000),
    requestChannel: z.enum([
      "catalog_goods",
      "non_catalog_goods",
      "service",
      "recurring",
      "emergency",
    ]),
    priority: z.enum(["normal", "high", "urgent"]),
    emergencyJustification: z.string().trim().min(20).max(2_000).optional(),
    recurringSchedule: z
      .object({
        cadence: z.enum(["monthly", "quarterly", "annually"]),
        startsOn: z.string().date(),
        endsOn: z.string().date().optional(),
      })
      .optional(),
    attachments: z
      .array(
        z.string()
          .trim()
          .min(1)
          .max(180)
          .regex(/^[\w .()&,'+-]+\.(pdf|png|jpg|jpeg|docx|xlsx|csv)$/i),
      )
      .max(10),
    lines: z
      .array(
        z.object({
          catalogItemId: z.string().min(1).max(120).optional(),
          description: z.string().trim().min(3).max(500),
          quantity: z.number().int().positive().max(100_000),
          unitPriceCents: z.number().int().nonnegative().max(1_000_000_000),
          glAccount: z.string().trim().min(1).max(80),
        }),
      )
      .min(1)
      .max(100),
  }),
  z.object({
    type: z.literal("update_operational_request"),
    requestId: z.string().min(1).max(120),
    title: z.string().trim().min(5).max(160),
    requiredDate: z.string().date(),
    businessJustification: z.string().trim().min(20).max(2_000),
    priority: z.enum(["normal", "high", "urgent"]),
    attachments: z
      .array(
        z.string()
          .trim()
          .min(1)
          .max(180)
          .regex(/^[\w .()&,'+-]+\.(pdf|png|jpg|jpeg|docx|xlsx|csv)$/i),
      )
      .max(10),
    lines: z
      .array(
        z.object({
          catalogItemId: z.string().min(1).max(120).optional(),
          description: z.string().trim().min(3).max(500),
          quantity: z.number().int().positive().max(100_000),
          unitPriceCents: z.number().int().nonnegative().max(1_000_000_000),
          glAccount: z.string().trim().min(1).max(80),
        }),
      )
      .min(1)
      .max(100),
  }),
  z.object({
    type: z.literal("clone_operational_request"),
    sourceRequestId: z.string().min(1).max(120),
    requiredDate: z.string().date(),
  }),
  z.object({
    type: z.literal("submit_operational_request"),
    requestId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("withdraw_operational_request"),
    requestId: z.string().min(1).max(120),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("decide_operational_approval"),
    approvalId: z.string().min(1).max(120),
    decision: z.enum(["approve", "return", "reject"]),
    comments: z.string().trim().min(10).max(2_000),
  }),
  z.object({
    type: z.literal("create_operational_purchase_order"),
    requestId: z.string().min(1).max(120),
    vendorId: z.string().min(1).max(120),
    expectedDate: z.string().date(),
    shippingCents: z.number().int().nonnegative().max(1_000_000_000),
    taxCents: z.number().int().nonnegative().max(1_000_000_000),
    contractReference: z.string().trim().max(160).default(""),
  }),
  z.object({
    type: z.literal("issue_operational_purchase_order"),
    purchaseOrderId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("acknowledge_operational_purchase_order"),
    purchaseOrderId: z.string().min(1).max(120),
    acknowledgmentReference: z.string().trim().min(5).max(240),
  }),
  z.object({
    type: z.literal("record_operational_receipt"),
    purchaseOrderId: z.string().min(1).max(120),
    packingSlip: z.string().trim().min(3).max(240),
    carrierReference: z.string().trim().max(160).optional(),
    notes: z.string().trim().min(10).max(2_000),
    overToleranceAction: z
      .enum(["reject", "route_for_approval"])
      .default("reject"),
    overToleranceRationale: z
      .string()
      .trim()
      .min(20)
      .max(2_000)
      .optional(),
    lines: z
      .array(
        z.object({
          lineId: z.string().min(1).max(120),
          quantity: z.number().int().positive().max(100_000),
          acceptedQuantity: z.number().int().nonnegative().max(100_000),
          damagedQuantity: z.number().int().nonnegative().max(100_000),
          rejectedQuantity: z.number().int().nonnegative().max(100_000),
          returnedQuantity: z.number().int().nonnegative().max(100_000),
          conditionNote: z.string().trim().max(500).optional(),
          serialNumbers: z.array(z.string().trim().min(1).max(120)).max(1_000),
          lotNumbers: z.array(z.string().trim().min(1).max(120)).max(100),
          serviceAccepted: z.boolean().optional(),
          serviceAcceptanceEvidence: z
            .string()
            .trim()
            .max(240)
            .optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
  z.object({
    type: z.literal("record_operational_invoice"),
    purchaseOrderId: z.string().min(1).max(120),
    invoiceNumber: z.string().trim().min(3).max(120),
    invoiceDate: z.string().date(),
    dueDate: z.string().date(),
    shippingCents: z.number().int().nonnegative().max(1_000_000_000),
    taxCents: z.number().int().nonnegative().max(1_000_000_000),
    uploadedDocument: z.string().trim().min(3).max(240),
    lines: z
      .array(
        z.object({
          lineId: z.string().min(1).max(120),
          quantity: z.number().int().positive().max(100_000),
          unitPriceCents: z.number().int().nonnegative().max(1_000_000_000),
        }),
      )
      .min(1)
      .max(100),
  }),
  z.object({
    type: z.literal("match_operational_invoice"),
    invoiceId: z.string().min(1).max(120),
    matchMode: z.enum(["two_way", "three_way"]),
    amountToleranceCents: z.number().int().nonnegative().max(1_000_000),
    quantityTolerance: z.number().int().nonnegative().max(100),
  }),
  z.object({
    type: z.literal("record_operational_credit"),
    invoiceId: z.string().min(1).max(120),
    creditNumber: z.string().trim().min(3).max(120),
    creditCents: z.number().int().positive().max(1_000_000_000),
    reason: z.string().trim().min(20).max(2_000),
    uploadedDocument: z.string().trim().min(3).max(240),
  }),
  z.object({
    type: z.literal("resolve_operational_invoice"),
    invoiceId: z.string().min(1).max(120),
    decision: z.enum(["accept", "request_correction"]),
    justification: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("export_operational_payment_readiness"),
    invoiceId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("cancel_operational_purchase_order"),
    purchaseOrderId: z.string().min(1).max(120),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("close_operational_purchase_order"),
    purchaseOrderId: z.string().min(1).max(120),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("reopen_operational_purchase_order"),
    purchaseOrderId: z.string().min(1).max(120),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({ type: z.literal("analyze_request") }),
  z.object({ type: z.literal("accept_inventory_recommendation") }),
  z.object({ type: z.literal("accept_standards_substitution") }),
  z.object({
    type: z.literal("select_vendor"),
    vendorId: z.string().min(1).max(120).optional(),
  }),
  z.object({
    type: z.literal("request_vendor_exception"),
    vendorId: z.string().min(1).max(120),
    businessJustification: z.string().trim().min(20).max(2_000),
    evidence: z.array(z.string().trim().min(1).max(240)).min(1).max(20),
  }),
  z.object({
    type: z.literal("decide_vendor_exception"),
    exceptionId: z.string().min(1).max(120),
    decision: z.enum(["approve", "reject"]),
  }),
  z.object({ type: z.literal("confirm_budget_and_coding") }),
  z.object({ type: z.literal("submit_request") }),
  z.object({
    type: z.literal("decide_approval"),
    decision: z.enum(["approve", "return", "reject"]),
    comments: z.string().trim().max(2_000).default(""),
  }),
  z.object({
    type: z.literal("delegate_approval"),
    approvalId: z.string().min(1).max(120),
    delegateRole: z.enum([
      "department_manager",
      "it_reviewer",
      "purchasing_manager",
      "finance_reviewer",
      "compliance_reviewer",
    ]),
    delegationType: z.enum(["manual", "out_of_office"]),
    startsOn: z.string().date(),
    expiresOn: z.string().date(),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("send_approval_reminder"),
    approvalId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("escalate_approval"),
    approvalId: z.string().min(1).max(120),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("bulk_decide_approvals"),
    approvalIds: z.array(z.string().min(1).max(120)).min(1).max(25),
    decision: z.literal("approve"),
    rationale: z.string().trim().min(20).max(2_000),
  }),
  z.object({ type: z.literal("create_purchase_order") }),
  z.object({ type: z.literal("issue_purchase_order") }),
  z.object({ type: z.literal("record_vendor_acknowledgment") }),
  z.object({ type: z.literal("receive_order") }),
  z.object({ type: z.literal("record_partial_receipt") }),
  z.object({ type: z.literal("complete_partial_receipt") }),
  z.object({
    type: z.literal("reverse_receipt"),
    receiptId: z.string().min(1).max(120),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("propose_po_revision"),
    reason: z.string().trim().min(20).max(2_000),
    proposedTotalCents: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("decide_po_revision"),
    revisionId: z.string().min(1).max(120),
    decision: z.enum(["approve", "reject"]),
  }),
  z.object({
    type: z.literal("issue_po_revision"),
    revisionId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("cancel_purchase_order"),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({
    type: z.literal("close_purchase_order"),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({ type: z.literal("run_invoice_match") }),
  z.object({
    type: z.literal("resolve_invoice_exception"),
    decision: z.enum(["route", "accept", "corrected_invoice"]),
    justification: z.string().trim().max(2_000).default(""),
  }),
  z.object({ type: z.literal("export_payment_readiness") }),
  z.object({
    type: z.literal("switch_role"),
    role: z.enum([
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
    ] satisfies [DemoRole, ...DemoRole[]]),
  }),
  z.object({
    type: z.literal("jump_to_stage"),
    stage: z.enum([
      "draft",
      "analyzed",
      "inventory_reviewed",
      "standards_reviewed",
      "vendor_selected",
      "budget_confirmed",
      "submitted",
      "manager_approved",
      "it_approved",
      "purchasing_approved",
      "approved",
      "po_draft",
      "po_issued",
      "acknowledged",
      "fully_received",
      "invoice_exception",
      "exception_routed",
      "correction_requested",
      "variance_accepted",
      "resolved",
    ] satisfies [WorkflowStage, ...WorkflowStage[]]),
  }),
  z.object({ type: z.literal("reset_demo") }),
  z.object({ type: z.literal("toggle_notice") }),
  z.object({ type: z.literal("toggle_highlights") }),
  z.object({
    type: z.literal("validate_configuration"),
    configurationId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("submit_configuration_review"),
    configurationId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("approve_configuration"),
    configurationId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("activate_configuration"),
    configurationId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("approve_import"),
    batchId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("post_import"),
    batchId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("reverse_import"),
    batchId: z.string().min(1).max(120),
    reason: z.string().trim().min(20).max(2_000),
  }),
  z.object({ type: z.literal("generate_audit_package") }),
  z.object({
    type: z.literal("retry_notification"),
    notificationId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("acknowledge_notification"),
    notificationId: z.string().min(1).max(120),
  }),
]);

export type PhaseTwoCommand = z.infer<typeof phaseTwoCommandSchema>;

export const phaseTwoCommandRequestSchema = z.object({
  tenantId: z.string().min(1).max(80),
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  correlationId: z.string().uuid(),
  requestedAt: z.string().datetime({ offset: true }),
  rationale: z.string().trim().min(10).max(2_000),
  command: phaseTwoCommandSchema,
});

export type PhaseTwoPersistedCommand = PhaseTwoCommand & {
  correlationId: string;
  requestedAt: string;
  rationale: string;
  activePersona: DemoRole;
  identityAudit: {
    assuranceLevel: string;
    activeRole: DemoRole;
    assignmentType: string;
    protectedAction: boolean;
    simulation: boolean;
  };
};

export interface PhaseTwoStateEnvelope {
  state: import("@/demo/model").DemoState;
  revision: number;
  persistence: "supabase" | "preview";
  durability: "authoritative" | "temporary" | "read_only";
  operationalReadiness: {
    ready: boolean;
    mode: "normalized_kernel" | "preview" | "blocked";
    checkedAt: string;
    reasons: string[];
    snapshotRevision?: number;
    ledgerRevision?: number;
    auditRevision?: number;
  };
  presenter?: boolean;
  availableRoles?: DemoRole[];
  lastCommandId?: string;
  commandResult?: {
    idempotencyKey: string;
    correlationId: string;
    auditReference: string;
    resultingRevision: number;
    replayed: boolean;
    committedAt: string;
  };
}
