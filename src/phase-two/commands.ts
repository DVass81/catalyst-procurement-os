import { z } from "zod";

import type { DemoRole, WorkflowStage } from "@/demo/model";

export const phaseTwoCommandSchema = z.discriminatedUnion("type", [
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
  command: phaseTwoCommandSchema,
});

export interface PhaseTwoStateEnvelope {
  state: import("@/demo/model").DemoState;
  revision: number;
  persistence: "supabase" | "preview";
  durability: "authoritative" | "temporary";
  presenter?: boolean;
  lastCommandId?: string;
}
