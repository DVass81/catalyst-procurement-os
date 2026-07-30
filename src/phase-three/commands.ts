import { z } from "zod";

import {
  capabilityStatuses,
  type CapabilityStatus,
  type GoldenThreadSceneId,
} from "@/phase-three/model";

const common = {
  correlationId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(2_000)
    .default("Authorized Phase 3 demonstration action."),
  evidence: z.array(z.string().trim().min(1).max(500)).max(40).default([]),
  truthStatus: z
    .enum(capabilityStatuses)
    .default("Functional Demo" satisfies CapabilityStatus),
  simulation: z.boolean().default(false),
};

export const phaseThreeCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("phase3_test_integration"),
    connectionKey: z.string().min(1).max(120),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_replay_integration"),
    runId: z.string().min(1).max(120),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_supplier_submit"),
    applicationId: z.string().min(1).max(120),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_create"),
    rfqId: z.string().min(1).max(160),
    rfqNumber: z.string().trim().min(3).max(80),
    requestId: z.string().min(1).max(160),
    title: z.string().trim().min(5).max(240),
    description: z.string().trim().min(20).max(2_000),
    sourcingMethod: z.enum(["rfq", "rfp"]),
    responseDeadline: z.string().date(),
    sealedUntil: z.string().datetime(),
    retentionUntil: z.string().date(),
    termsVersion: z.string().trim().min(1).max(120),
    evaluationVersion: z.string().trim().min(1).max(120),
    lines: z
      .array(
        z.object({
          id: z.string().min(1).max(160),
          requestLineId: z.string().min(1).max(160),
          description: z.string().trim().min(1).max(500),
          quantity: z.number().positive(),
          unitOfMeasure: z.string().trim().min(1).max(80),
          requiredByDate: z.string().date(),
          specification: z.string().trim().min(5).max(2_000),
        }),
      )
      .min(1)
      .max(100),
    supplierIds: z.array(z.string().min(1).max(160)).min(2).max(25),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_update_draft"),
    rfqId: z.string().min(1).max(160),
    title: z.string().trim().min(5).max(240),
    description: z.string().trim().min(20).max(2_000),
    responseDeadline: z.string().date(),
    sealedUntil: z.string().datetime(),
    termsVersion: z.string().trim().min(1).max(120),
    evaluationVersion: z.string().trim().min(1).max(120),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_release"),
    rfqId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_amend"),
    rfqId: z.string().min(1).max(160),
    changes: z.array(z.string().trim().min(3).max(500)).min(1).max(30),
    responseDeadline: z.string().date(),
    sealedUntil: z.string().datetime(),
    rationale: z.string().trim().min(20).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_submit_question"),
    rfqId: z.string().min(1).max(160),
    supplierId: z.string().min(1).max(160),
    question: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_answer_question"),
    rfqId: z.string().min(1).max(160),
    questionId: z.string().min(1).max(200),
    answer: z.string().trim().min(10).max(4_000),
    addendumTitle: z.string().trim().min(5).max(240),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_decline"),
    rfqId: z.string().min(1).max(160),
    supplierId: z.string().min(1).max(160),
    rationale: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_withdraw_response"),
    rfqId: z.string().min(1).max(160),
    supplierId: z.string().min(1).max(160),
    rationale: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_disclose_conflict"),
    rfqId: z.string().min(1).max(160),
    supplierId: z.string().min(1).max(160).optional(),
    description: z.string().trim().min(20).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_resolve_conflict"),
    rfqId: z.string().min(1).max(160),
    conflictId: z.string().min(1).max(200),
    disposition: z.enum(["mitigated", "recused"]),
    resolution: z.string().trim().min(20).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_record_negotiation"),
    rfqId: z.string().min(1).max(160),
    supplierId: z.string().min(1).max(160),
    summary: z.string().trim().min(20).max(2_000),
    negotiationEvidence: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(30),
    ...common,
  }),
  z.object({
    type: z.enum([
      "phase3_rfq_submit_response",
      "phase3_rfq_submit_bafo",
    ]),
    rfqId: z.string().min(1).max(160),
    supplierId: z.string().min(1).max(160),
    freightCents: z.number().int().nonnegative(),
    paymentTerms: z.string().trim().min(1).max(160),
    validityDate: z.string().date(),
    offers: z
      .array(
        z.object({
          rfqLineId: z.string().min(1).max(160),
          unitPriceCents: z.number().int().nonnegative(),
          promisedDate: z.string().date(),
          exception: z.string().trim().min(1).max(500).optional(),
        }),
      )
      .min(1)
      .max(100),
    attachments: z.array(z.string().trim().min(1).max(240)).max(20),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_close"),
    rfqId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_evaluate"),
    rfqId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_request_bafo"),
    rfqId: z.string().min(1).max(160),
    supplierIds: z.array(z.string().min(1).max(160)).min(2).max(10),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_award"),
    rfqId: z.string().min(1).max(160),
    supplierId: z.string().min(1).max(160),
    rationale: z.string().trim().min(20).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_rfq_cancel"),
    rfqId: z.string().min(1).max(160),
    rationale: z.string().trim().min(20).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_supplier_request_remediation"),
    applicationId: z.string().min(1).max(120),
    remediation: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_supplier_decide"),
    applicationId: z.string().min(1).max(120),
    decision: z.enum(["approve", "conditionally_approve", "reject"]),
    rationale: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_bank_verify"),
    applicationId: z.string().min(1).max(120),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_bank_propose"),
    applicationId: z.string().min(1).max(120),
    accountLastFour: z.string().regex(/^[0-9]{4}$/),
    routingLastFour: z.string().regex(/^[0-9]{4}$/),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_bank_decide"),
    applicationId: z.string().min(1).max(120),
    decision: z.enum(["approve", "reject"]),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_contract_validate"),
    contractRecordId: z.string().min(1).max(160),
    findingId: z.string().min(1).max(160),
    decision: z.enum(["validate", "reject"]),
    rationale: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_obligation_acknowledge"),
    contractRecordId: z.string().min(1).max(160),
    obligationId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_workflow_validate"),
    workflowId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_workflow_simulate"),
    workflowId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_workflow_submit"),
    workflowId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_workflow_approve"),
    workflowId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_workflow_activate"),
    workflowId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_workflow_rollback"),
    workflowId: z.string().min(1).max(160),
    rationale: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_mobile_approval"),
    taskId: z.string().min(1).max(160),
    decision: z.enum(["approve", "reject", "return"]),
    rationale: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_mobile_receipt"),
    taskId: z.string().min(1).max(160),
    acceptedQuantity: z.number().int().nonnegative(),
    damagedQuantity: z.number().int().nonnegative(),
    rejectedQuantity: z.number().int().nonnegative(),
    quarantine: z.boolean(),
    rationale: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_generate_report"),
    reportId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_create_report_schedule"),
    reportId: z.string().min(1).max(160),
    cadence: z.enum(["weekly", "monthly"]),
    exportFormat: z.enum(["PDF", "XLSX", "CSV"]),
    recipientRoles: z
      .array(
        z.enum([
          "purchasing_manager",
          "finance_reviewer",
          "accounts_payable",
          "executive",
          "auditor",
        ]),
      )
      .min(1)
      .max(5),
    secureLinkExpiresHours: z.number().int().min(1).max(168),
    retentionDays: z.number().int().min(365).max(2_920),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_deliver_report"),
    scheduleId: z.string().min(1).max(160),
    snapshotId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_generate_cate_narrative"),
    reportSnapshotId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_advance_incident"),
    incidentId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_advance_support_case"),
    caseId: z.string().min(1).max(160),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_run_preflight"),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_set_scene"),
    sceneId: z.enum([
      "executive_signal",
      "cate_evidence",
      "supplier_response",
      "supplier_control",
      "contract_deadline",
      "request_evaluation",
      "workflow_routing",
      "mobile_approval",
      "receiving_discrepancy",
      "invoice_exception",
      "integration_reconciliation",
      "executive_report",
      "trust_evidence",
      "accessibility_evidence",
      "operations_fallback",
      "pilot_activation",
    ] satisfies [GoldenThreadSceneId, ...GoldenThreadSceneId[]]),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_simulate_provider_outage"),
    provider: z.enum(["cate", "voice", "integrations"]),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_record_assurance_retest"),
    findingId: z.string().min(1).max(160),
    result: z.enum(["pass", "fail"]),
    evidenceNote: z.string().trim().min(10).max(2_000),
    ...common,
  }),
  z.object({
    type: z.literal("phase3_reset"),
    ...common,
  }),
]);

export type PhaseThreeCommand = z.infer<typeof phaseThreeCommandSchema>;

export type PhaseThreePersistedCommand = PhaseThreeCommand & {
  activePersona: string;
};

export const phaseThreeCommandRequestSchema = z.object({
  tenantId: z.string().min(1).max(80),
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  requestedAt: z.string().datetime({ offset: true }),
  command: phaseThreeCommandSchema,
});

export interface PhaseThreeEvidencePackage {
  packageId: string;
  tenantId: string;
  generatedAt: string;
  datasetVersion: string;
  datasetHash: string;
  capabilityRegistry: Array<{
    capabilityId: string;
    name: string;
    status: CapabilityStatus;
    limitation: string;
    activationRequirements: string;
  }>;
  selectedEvidence: string[];
  securityAccessibilityOperationsOverview: string[];
  knownLimitations: string[];
  pilotActivationOutline: string[];
  contentHash: string;
}
