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
