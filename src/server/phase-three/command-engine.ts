import "server-only";

import type { DemoRole, DemoState } from "@/demo/model";
import { WorkflowError } from "@/demo/workflow";
import type { PhaseThreePersistedCommand } from "@/phase-three/commands";
import type {
  IncidentRecord,
  PhaseThreeAuditEvent,
  SupportCase,
} from "@/phase-three/model";
import { createPhaseThreeState } from "@/phase-three/seed";
import { verifyPhaseThreeIntegrity } from "@/phase-three/integrity";

function requirePersona(
  command: PhaseThreePersistedCommand,
  allowed: DemoRole[],
) {
  if (!allowed.includes(command.activePersona as DemoRole)) {
    throw new WorkflowError(
      `This action requires one of these roles: ${allowed.join(", ")}.`,
    );
  }
}

function timestamp(state: DemoState) {
  const sequence = state.phaseThree.auditEvents.length + 1;
  const hour = Math.min(22, 8 + Math.floor(sequence / 10));
  const minute = (sequence * 7) % 60;
  return `${state.sessionDate}T${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}:00-04:00`;
}

function appendAudit(
  state: DemoState,
  command: PhaseThreePersistedCommand,
  input: Omit<
    PhaseThreeAuditEvent,
    | "id"
    | "activePersona"
    | "reason"
    | "truthStatus"
    | "simulation"
    | "evidence"
    | "correlationId"
    | "timestamp"
    | "governingVersion"
  >,
) {
  const sequence = state.phaseThree.auditEvents.length + 1;
  state.phaseThree.auditEvents.push({
    ...input,
    id: `phase3-audit-${String(sequence).padStart(5, "0")}`,
    activePersona: command.activePersona,
    reason: command.reason,
    truthStatus: command.truthStatus,
    simulation: command.simulation,
    evidence: command.evidence,
    correlationId: command.correlationId,
    timestamp: timestamp(state),
    governingVersion: state.phaseThree.dataset.version,
  });
}

function findById<T extends { id: string }>(
  records: T[],
  id: string,
  label: string,
) {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new WorkflowError(`${label} was not found.`);
  return record;
}

function nextIncidentStatus(status: IncidentRecord["status"]) {
  const states: IncidentRecord["status"][] = [
    "detected",
    "triaged",
    "acknowledged",
    "assigned",
    "mitigating",
    "monitoring",
    "resolved",
    "reviewed",
  ];
  return states[Math.min(states.indexOf(status) + 1, states.length - 1)]!;
}

function nextCaseStatus(status: SupportCase["status"]) {
  const states: SupportCase["status"][] = [
    "new",
    "triaged",
    "assigned",
    "investigating",
    "resolved",
    "closed",
  ];
  return states[Math.min(states.indexOf(status) + 1, states.length - 1)]!;
}

function reportMeasures(state: DemoState) {
  const spend = state.invoices.reduce((total, invoice) => total + invoice.totalCents, 0);
  const controlledSpend = state.invoices
    .filter((invoice) => invoice.purchaseOrderId)
    .reduce((total, invoice) => total + invoice.totalCents, 0);
  const resolvedSuppliers = state.phaseThree.supplierApplications.filter(
    (supplier) => supplier.lifecycleState === "active",
  ).length;
  return {
    total_spend_cents: spend,
    controlled_spend_cents: controlledSpend,
    controlled_spend_rate:
      spend === 0 ? 0 : Number((controlledSpend / spend).toFixed(4)),
    realized_savings_cents: state.requests.reduce(
      (total, request) => total + request.identifiedSavingsCents,
      0,
    ),
    supplier_control_completion_rate:
      state.phaseThree.supplierApplications.length === 0
        ? 0
        : Number(
            (
              resolvedSuppliers / state.phaseThree.supplierApplications.length
            ).toFixed(4),
          ),
    unresolved_contract_conflicts: state.phaseThree.contracts.reduce(
      (total, contract) =>
        total +
        contract.conflicts.filter((conflict) => conflict.status !== "resolved").length,
      0,
    ),
    integration_reconciliation_rate:
      state.phaseThree.integrationRuns.length === 0
        ? 0
        : Number(
            (
              state.phaseThree.integrationRuns.filter(
                (run) => run.status === "reconciled",
              ).length / state.phaseThree.integrationRuns.length
            ).toFixed(4),
          ),
    open_assurance_findings: state.phaseThree.assuranceFindings.filter(
      (finding) => !["resolved", "accepted"].includes(finding.status),
    ).length,
  };
}

export function executePhaseThreeCommand(
  current: DemoState,
  command: PhaseThreePersistedCommand,
): DemoState {
  const next = structuredClone(current);
  const phaseThree = next.phaseThree;

  switch (command.type) {
    case "phase3_test_integration": {
      requirePersona(command, ["system_administrator", "operations_manager"]);
      const connection = phaseThree.integrations.find(
        (item) => item.connectionKey === command.connectionKey,
      );
      if (!connection) throw new WorkflowError("Integration connection was not found.");
      const before = connection.lifecycleState;
      connection.lifecycleState = "tested";
      connection.lastTestedAt = timestamp(next);
      appendAudit(next, command, {
        action: "integration.connection.tested",
        recordType: "integration_connection",
        recordId: connection.connectionKey,
        before,
        after: connection.lifecycleState,
        source: "integration",
      });
      break;
    }
    case "phase3_replay_integration": {
      requirePersona(command, ["system_administrator", "operations_manager"]);
      const run = findById(phaseThree.integrationRuns, command.runId, "Integration run");
      if (!["dead_letter", "failed", "partially_failed"].includes(run.status)) {
        throw new WorkflowError("Only a safely stopped integration run can be replayed.");
      }
      const before = run.status;
      run.status = "reconciled";
      run.acceptedCount = run.recordCount;
      run.rejectedCount = 0;
      run.postedTotalCents = run.sourceTotalCents;
      run.retryCount += 1;
      run.checkpoint = "complete";
      run.validationFindings = [];
      run.reconciliation =
        "Corrected synthetic cost center; counts, identifiers, lineage, and control totals reconcile.";
      appendAudit(next, command, {
        action: "integration.run.replayed_and_reconciled",
        recordType: "integration_run",
        recordId: run.id,
        before,
        after: run.status,
        source: "integration",
      });
      break;
    }
    case "phase3_supplier_submit": {
      requirePersona(command, ["supplier_user"]);
      const supplier = findById(
        phaseThree.supplierApplications,
        command.applicationId,
        "Supplier application",
      );
      if (!["invited", "in_progress", "information_required"].includes(supplier.lifecycleState)) {
        throw new WorkflowError("This supplier application cannot be submitted now.");
      }
      const before = supplier.lifecycleState;
      supplier.lifecycleState =
        supplier.validationFindings.length > 0
          ? "information_required"
          : "internal_review";
      supplier.version += 1;
      appendAudit(next, command, {
        action: "supplier.application.submitted",
        recordType: "supplier_application",
        recordId: supplier.id,
        before,
        after: supplier.lifecycleState,
        source: "user",
      });
      break;
    }
    case "phase3_supplier_request_remediation": {
      requirePersona(command, [
        "purchasing_manager",
        "compliance_reviewer",
        "security_reviewer",
      ]);
      const supplier = findById(
        phaseThree.supplierApplications,
        command.applicationId,
        "Supplier application",
      );
      const before = supplier.lifecycleState;
      supplier.lifecycleState = "information_required";
      if (!supplier.remediationItems.includes(command.remediation)) {
        supplier.remediationItems.push(command.remediation);
      }
      supplier.version += 1;
      appendAudit(next, command, {
        action: "supplier.remediation.requested",
        recordType: "supplier_application",
        recordId: supplier.id,
        before,
        after: supplier.lifecycleState,
        source: "user",
      });
      break;
    }
    case "phase3_supplier_decide": {
      requirePersona(command, ["purchasing_manager"]);
      const supplier = findById(
        phaseThree.supplierApplications,
        command.applicationId,
        "Supplier application",
      );
      if (
        command.decision !== "reject" &&
        (supplier.validationFindings.length > 0 ||
          supplier.documentStatus !== "current")
      ) {
        throw new WorkflowError(
          "Supplier approval is blocked until required evidence is current.",
        );
      }
      const before = supplier.lifecycleState;
      supplier.lifecycleState =
        command.decision === "approve"
          ? "approved"
          : command.decision === "conditionally_approve"
            ? "conditionally_approved"
            : "rejected";
      supplier.version += 1;
      appendAudit(next, command, {
        action: `supplier.application.${command.decision}`,
        recordType: "supplier_application",
        recordId: supplier.id,
        before,
        after: supplier.lifecycleState,
        source: "user",
      });
      break;
    }
    case "phase3_bank_verify": {
      requirePersona(command, ["compliance_reviewer", "security_reviewer"]);
      const supplier = findById(
        phaseThree.supplierApplications,
        command.applicationId,
        "Supplier application",
      );
      if (!supplier.bankingChange) {
        throw new WorkflowError("No banking change is awaiting verification.");
      }
      const before = supplier.bankingChange.status;
      supplier.bankingChange.independentlyVerifiedBy = command.activePersona;
      supplier.bankingChange.status = "approval_pending";
      appendAudit(next, command, {
        action: "supplier.banking_change.independently_verified",
        recordType: "banking_change",
        recordId: supplier.bankingChange.id,
        before,
        after: supplier.bankingChange.status,
        source: "user",
      });
      break;
    }
    case "phase3_bank_decide": {
      requirePersona(command, ["finance_reviewer"]);
      const supplier = findById(
        phaseThree.supplierApplications,
        command.applicationId,
        "Supplier application",
      );
      const change = supplier.bankingChange;
      if (!change?.independentlyVerifiedBy || change.status !== "approval_pending") {
        throw new WorkflowError("Independent verification is required before approval.");
      }
      if (change.independentlyVerifiedBy === command.activePersona) {
        throw new WorkflowError("The verifier cannot approve the same banking change.");
      }
      const before = change.status;
      change.status = command.decision === "approve" ? "approved" : "rejected";
      if (command.decision === "approve") change.approvedBy = command.activePersona;
      appendAudit(next, command, {
        action: `supplier.banking_change.${command.decision}`,
        recordType: "banking_change",
        recordId: change.id,
        before,
        after: change.status,
        source: "user",
      });
      break;
    }
    case "phase3_contract_validate": {
      requirePersona(command, ["contract_manager"]);
      const contract = findById(
        phaseThree.contracts,
        command.contractRecordId,
        "Contract record",
      );
      const finding = findById(contract.findings, command.findingId, "Contract finding");
      const before = finding.validationStatus;
      finding.validationStatus =
        command.decision === "validate" ? "validated" : "rejected";
      finding.validatedBy = command.activePersona;
      contract.lifecycleState =
        contract.findings.every((item) => item.validationStatus !== "pending")
          ? "validated"
          : "review_required";
      appendAudit(next, command, {
        action: `contract.finding.${command.decision}`,
        recordType: "contract_finding",
        recordId: finding.id,
        before,
        after: finding.validationStatus,
        source: "user",
      });
      break;
    }
    case "phase3_obligation_acknowledge": {
      requirePersona(command, ["contract_manager"]);
      const contract = findById(
        phaseThree.contracts,
        command.contractRecordId,
        "Contract record",
      );
      const obligation = findById(
        contract.obligations,
        command.obligationId,
        "Contract obligation",
      );
      const before = obligation.reminderStatus;
      obligation.reminderStatus = "acknowledged";
      obligation.evidence.push(`Acknowledged by ${command.activePersona}`);
      appendAudit(next, command, {
        action: "contract.obligation.acknowledged",
        recordType: "contract_obligation",
        recordId: obligation.id,
        before,
        after: obligation.reminderStatus,
        source: "user",
      });
      break;
    }
    case "phase3_workflow_validate":
    case "phase3_workflow_simulate":
    case "phase3_workflow_submit":
    case "phase3_workflow_approve":
    case "phase3_workflow_activate":
    case "phase3_workflow_rollback": {
      const workflow = findById(
        phaseThree.workflowVersions,
        command.workflowId,
        "Workflow version",
      );
      const before = workflow.lifecycleState;
      if (command.type === "phase3_workflow_validate") {
        requirePersona(command, ["system_administrator"]);
        workflow.validationFindings = [];
        workflow.lifecycleState = "validated";
      } else if (command.type === "phase3_workflow_simulate") {
        requirePersona(command, ["system_administrator"]);
        if (!["validated", "simulated"].includes(workflow.lifecycleState)) {
          throw new WorkflowError("Validate the workflow before simulation.");
        }
        workflow.simulationResult =
          "All six synthetic paths terminate; blocked suppliers and self-approval remain prevented.";
        workflow.lifecycleState = "simulated";
      } else if (command.type === "phase3_workflow_submit") {
        requirePersona(command, ["system_administrator"]);
        if (workflow.lifecycleState !== "simulated") {
          throw new WorkflowError("Simulate the workflow before review.");
        }
        workflow.lifecycleState = "review_pending";
      } else if (command.type === "phase3_workflow_approve") {
        requirePersona(command, ["compliance_reviewer"]);
        if (workflow.lifecycleState !== "review_pending") {
          throw new WorkflowError("The workflow is not awaiting approval.");
        }
        if (workflow.authoredBy === command.activePersona) {
          throw new WorkflowError("The author cannot approve this workflow.");
        }
        workflow.approvedBy = command.activePersona;
        workflow.lifecycleState = "approved";
      } else if (command.type === "phase3_workflow_activate") {
        requirePersona(command, ["system_administrator"]);
        if (workflow.lifecycleState !== "approved" || !workflow.approvedBy) {
          throw new WorkflowError("Independent approval is required before activation.");
        }
        for (const candidate of phaseThree.workflowVersions) {
          if (
            candidate.workflowKey === workflow.workflowKey &&
            candidate.lifecycleState === "active"
          ) {
            candidate.lifecycleState = "superseded";
            workflow.supersedes = candidate.id;
          }
        }
        workflow.lifecycleState = "active";
        workflow.effectiveAt = timestamp(next);
      } else {
        requirePersona(command, ["system_administrator"]);
        if (workflow.lifecycleState !== "active") {
          throw new WorkflowError("Only an active workflow can be rolled back.");
        }
        workflow.lifecycleState = "rolled_back";
        const predecessor = phaseThree.workflowVersions.find(
          (candidate) => candidate.id === workflow.supersedes,
        );
        if (predecessor) predecessor.lifecycleState = "active";
      }
      appendAudit(next, command, {
        action: command.type.replaceAll("phase3_", "").replaceAll("_", "."),
        recordType: "workflow_version",
        recordId: workflow.id,
        before,
        after: workflow.lifecycleState,
        source: "workflow",
      });
      break;
    }
    case "phase3_mobile_approval": {
      const task = findById(phaseThree.mobileTasks, command.taskId, "Mobile task");
      requirePersona(command, [task.assigneeRole as DemoRole]);
      if (task.type !== "approval" || task.status !== "assigned") {
        throw new WorkflowError("This mobile approval is not actionable.");
      }
      const before = task.status;
      task.status =
        command.decision === "approve"
          ? "approved"
          : command.decision === "reject"
            ? "rejected"
            : "returned";
      task.rationale = command.rationale;
      task.updatedAt = timestamp(next);
      appendAudit(next, command, {
        action: `mobile.approval.${command.decision}`,
        recordType: "mobile_task",
        recordId: task.id,
        before,
        after: task.status,
        source: "user",
      });
      break;
    }
    case "phase3_mobile_receipt": {
      const task = findById(phaseThree.mobileTasks, command.taskId, "Mobile task");
      requirePersona(command, [task.assigneeRole as DemoRole]);
      if (task.type !== "receiving" || task.status !== "assigned") {
        throw new WorkflowError("This mobile receipt is not actionable.");
      }
      if (
        command.acceptedQuantity +
          command.damagedQuantity +
          command.rejectedQuantity <=
        0
      ) {
        throw new WorkflowError("A receiving quantity is required.");
      }
      if (command.damagedQuantity > 0 && !command.quarantine) {
        throw new WorkflowError("Damaged items must be quarantined.");
      }
      const before = task.status;
      task.status = "completed";
      task.rationale = command.rationale;
      task.evidence.push(
        `Accepted ${command.acceptedQuantity}; damaged ${command.damagedQuantity}; rejected ${command.rejectedQuantity}; quarantine ${command.quarantine}.`,
      );
      task.updatedAt = timestamp(next);
      appendAudit(next, command, {
        action: "mobile.receipt.recorded",
        recordType: "mobile_task",
        recordId: task.id,
        before,
        after: task.status,
        source: "user",
      });
      break;
    }
    case "phase3_generate_report": {
      requirePersona(command, [
        "executive",
        "auditor",
        "purchasing_manager",
        "finance_reviewer",
      ]);
      const report = findById(
        phaseThree.reportDefinitions,
        command.reportId,
        "Report definition",
      );
      const id = `report-snapshot-${String(phaseThree.reportSnapshots.length + 1).padStart(4, "0")}`;
      phaseThree.reportSnapshots.push({
        id,
        reportId: report.id,
        asOf: timestamp(next),
        filters: { tenant: next.organization.organizationId, dataset: phaseThree.dataset.version },
        measures: reportMeasures(next),
        sourceRecordIds: [
          ...next.invoices.map((invoice) => invoice.id),
          ...phaseThree.integrationRuns.map((run) => run.id),
        ],
        sourceHash: phaseThree.dataset.contentHash,
        exportHashes: {},
        annotation:
          "Synthetic commercialization snapshot; scheduled distribution is simulated.",
        correlationId: command.correlationId,
      });
      appendAudit(next, command, {
        action: "report.snapshot.generated",
        recordType: "report_snapshot",
        recordId: id,
        before: "not_generated",
        after: "generated",
        source: "workflow",
      });
      break;
    }
    case "phase3_generate_cate_narrative": {
      requirePersona(command, [
        "executive",
        "auditor",
        "purchasing_manager",
        "finance_reviewer",
      ]);
      const report = findById(
        phaseThree.reportSnapshots,
        command.reportSnapshotId,
        "Report snapshot",
      );
      const id = `cate-narrative-${String(phaseThree.cateNarratives.length + 1).padStart(4, "0")}`;
      const controlledRate = report.measures.controlled_spend_rate ?? 0;
      phaseThree.cateNarratives.push({
        id,
        task: "Explain the governed procurement performance snapshot.",
        factualFindings: [
          `Controlled spend rate is ${(controlledRate * 100).toFixed(1)}%.`,
          `${report.measures.open_assurance_findings ?? 0} assurance finding(s) remain open.`,
        ],
        inferences: [
          "Improving supplier evidence completion may reduce preventable review delays.",
        ],
        citations: [
          `report_snapshot:${report.id}`,
          `dataset:${phaseThree.dataset.version}:${phaseThree.dataset.contentHash}`,
        ],
        governingDefinitions: report.measures
          ? phaseThree.certifiedMeasures.map((measure) => `${measure.id}:v${measure.version}`)
          : [],
        assumptions: ["Synthetic transactions represent the approved demonstration period."],
        missingInformation: ["No realized customer outcome or production benchmark is available."],
        confidence: "high",
        confidenceReason:
          "All facts use certified deterministic measures and immutable snapshot references.",
        risks: ["Do not interpret synthetic results as guaranteed customer outcomes."],
        alternatives: ["Review the accessible table and underlying source identifiers."],
        requiredHumanAction:
          "A human selects any follow-up action; CATE does not approve, award, receive, waive, or pay.",
        providerMode: phaseThree.providerModes.cate,
        truthStatus: "Functional Demo",
        asOf: timestamp(next),
        evaluationVersion: "cate-commercialization-v1",
        correlationId: command.correlationId,
      });
      appendAudit(next, command, {
        action: "cate.narrative.generated",
        recordType: "cate_narrative",
        recordId: id,
        before: "not_generated",
        after: "generated",
        source: "cate",
      });
      break;
    }
    case "phase3_advance_incident": {
      requirePersona(command, ["operations_manager", "system_administrator"]);
      const incident = findById(phaseThree.incidents, command.incidentId, "Incident");
      const before = incident.status;
      incident.status = nextIncidentStatus(incident.status);
      if (incident.status === "resolved") {
        incident.communicationStatus = "approved_simulated";
      }
      appendAudit(next, command, {
        action: "operations.incident.advanced",
        recordType: "incident",
        recordId: incident.id,
        before,
        after: incident.status,
        source: "workflow",
      });
      break;
    }
    case "phase3_advance_support_case": {
      requirePersona(command, ["operations_manager"]);
      const supportCase = findById(
        phaseThree.supportCases,
        command.caseId,
        "Support case",
      );
      const before = supportCase.status;
      supportCase.status = nextCaseStatus(supportCase.status);
      appendAudit(next, command, {
        action: "operations.support_case.advanced",
        recordType: "support_case",
        recordId: supportCase.id,
        before,
        after: supportCase.status,
        source: "workflow",
      });
      break;
    }
    case "phase3_run_preflight": {
      requirePersona(command, ["system_administrator", "operations_manager"]);
      const integrity = verifyPhaseThreeIntegrity(phaseThree);
      for (const check of phaseThree.preflightChecks) {
        if (check.id === "preflight-release" || check.id === "preflight-a11y") {
          check.status = "warning";
        } else if (check.id === "preflight-dataset") {
          check.status = integrity.valid ? "pass" : "fail";
          check.evidence = integrity.errors.join(" ") || phaseThree.dataset.contentHash;
        } else {
          check.status = "pass";
        }
      }
      phaseThree.lastPreflightAt = timestamp(next);
      appendAudit(next, command, {
        action: "release.preflight.executed",
        recordType: "release_preflight",
        recordId: phaseThree.dataset.version,
        before: "not_run",
        after: integrity.valid ? "qualified_with_open_gates" : "failed",
        source: "workflow",
      });
      break;
    }
    case "phase3_set_scene": {
      requirePersona(command, ["system_administrator", "operations_manager"]);
      const before = phaseThree.activeSceneId;
      phaseThree.activeSceneId = command.sceneId;
      appendAudit(next, command, {
        action: "presenter.scene.selected",
        recordType: "golden_thread_scene",
        recordId: command.sceneId,
        before,
        after: command.sceneId,
        source: "user",
      });
      break;
    }
    case "phase3_simulate_provider_outage": {
      requirePersona(command, ["system_administrator", "operations_manager"]);
      const before = phaseThree.providerModes[command.provider];
      phaseThree.providerModes[command.provider] = "deterministic";
      const signal = phaseThree.operationsSignals.find(
        (item) =>
          item.domain === (command.provider === "integrations" ? "integration" : command.provider),
      );
      if (signal) {
        signal.status = "degraded";
        signal.message = `${command.provider} provider outage simulated; deterministic fallback is active.`;
      }
      appendAudit(next, command, {
        action: "provider.fallback.activated",
        recordType: "provider",
        recordId: command.provider,
        before,
        after: "deterministic",
        source: "workflow",
      });
      break;
    }
    case "phase3_record_assurance_retest": {
      requirePersona(command, [
        "security_reviewer",
        "operations_manager",
        "system_administrator",
      ]);
      const finding = findById(
        phaseThree.assuranceFindings,
        command.findingId,
        "Assurance finding",
      );
      const before = finding.status;
      finding.retest = command.evidenceNote;
      finding.evidence.push(command.evidenceNote);
      finding.status = command.result === "pass" ? "resolved" : "remediating";
      appendAudit(next, command, {
        action: "assurance.finding.retested",
        recordType: "assurance_finding",
        recordId: finding.id,
        before,
        after: finding.status,
        source: "user",
      });
      break;
    }
    case "phase3_reset": {
      requirePersona(command, ["system_administrator"]);
      next.phaseThree = createPhaseThreeState(
        next.sessionDate,
        next.organization.organizationId,
      );
      appendAudit(next, command, {
        action: "phase3.dataset.reset",
        recordType: "synthetic_dataset",
        recordId: next.phaseThree.dataset.version,
        before: "modified",
        after: "approved_baseline",
        source: "workflow",
      });
      break;
    }
  }

  const result = verifyPhaseThreeIntegrity(next.phaseThree);
  if (!result.valid) {
    throw new WorkflowError(result.errors.join(" "));
  }
  return next;
}
