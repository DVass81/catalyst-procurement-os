import "server-only";

import { createHash } from "node:crypto";

import type { DemoRole, DemoState } from "@/demo/model";
import { WorkflowError } from "@/demo/workflow";
import type { PhaseThreePersistedCommand } from "@/phase-three/commands";
import type {
  IncidentRecord,
  PhaseThreeAuditEvent,
  ReportSnapshot,
  SupportCase,
} from "@/phase-three/model";
import { createPhaseThreeState } from "@/phase-three/seed";
import { verifyPhaseThreeIntegrity } from "@/phase-three/integrity";
import { buildReportExport } from "@/server/phase-three/report-exports";

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

function responseHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function currentRoundResponses(
  rfq: DemoState["phaseThree"]["rfqs"][number],
) {
  return rfq.responses.filter(
    (response) =>
      response.round === rfq.bafoRound &&
      ["submitted", "revealed"].includes(response.status),
  );
}

function ensureRfqGovernanceCollections(
  rfq: DemoState["phaseThree"]["rfqs"][number],
) {
  rfq.amendments ??= [];
  rfq.questions ??= [];
  rfq.addenda ??= [];
  rfq.conflicts ??= [];
  rfq.negotiations ??= [];
  rfq.decisionNotices ??= [];
}

export function executePhaseThreeCommand(
  current: DemoState,
  command: PhaseThreePersistedCommand,
): DemoState {
  const next = structuredClone(current);
  const phaseThree = next.phaseThree;
  phaseThree.rfqs.forEach(ensureRfqGovernanceCollections);

  switch (command.type) {
    case "phase3_rfq_create": {
      requirePersona(command, [
        "purchasing_specialist",
        "purchasing_manager",
      ]);
      if (
        phaseThree.rfqs.some(
          (candidate) =>
            candidate.id === command.rfqId ||
            candidate.rfqNumber === command.rfqNumber,
        )
      ) {
        throw new WorkflowError("The RFQ identifier or number already exists.");
      }
      const request = findById(next.requests, command.requestId, "Request");
      const supplierIds = new Set(command.supplierIds);
      if (supplierIds.size !== command.supplierIds.length) {
        throw new WorkflowError("Each invited supplier must be unique.");
      }
      if (command.responseDeadline > command.retentionUntil) {
        throw new WorkflowError(
          "The RFQ retention date must follow the response deadline.",
        );
      }
      const lineIds = new Set<string>();
      const requestLineIds = new Set<string>();
      for (const line of command.lines) {
        if (lineIds.has(line.id) || requestLineIds.has(line.requestLineId)) {
          throw new WorkflowError(
            "RFQ and request line identifiers must be unique.",
          );
        }
        lineIds.add(line.id);
        requestLineIds.add(line.requestLineId);
        const requestLine = request.lines.find(
          (candidate) => candidate.id === line.requestLineId,
        );
        if (
          !requestLine ||
          requestLine.purchaseQuantity !== line.quantity ||
          requestLine.purchaseQuantity <= 0
        ) {
          throw new WorkflowError(
            "Every RFQ line must reconcile to one external request line.",
          );
        }
      }
      const suppliers = command.supplierIds.map((supplierId) => {
        const vendor = findById(next.vendors, supplierId, "Supplier");
        if (
          vendor.complianceHold ||
          vendor.criticalCorrectiveAction
        ) {
          throw new WorkflowError(
            `${vendor.displayName} is not eligible for an RFQ invitation.`,
          );
        }
        const application = phaseThree.supplierApplications.find(
          (candidate) => candidate.supplierId === supplierId,
        );
        const priorInvitation = phaseThree.rfqs
          .flatMap((candidate) => candidate.suppliers)
          .find((candidate) => candidate.supplierId === supplierId);
        const supplierOrganizationId =
          application?.supplierOrganizationId ??
          priorInvitation?.supplierOrganizationId;
        if (!supplierOrganizationId) {
          throw new WorkflowError(
            `${vendor.displayName} has no authoritative supplier organization.`,
          );
        }
        return {
          supplierId,
          supplierOrganizationId,
          supplierName: vendor.displayName,
          status: "selected" as const,
        };
      });
      phaseThree.rfqs.push({
        id: command.rfqId,
        rfqNumber: command.rfqNumber,
        requestId: command.requestId,
        title: command.title,
        description: command.description,
        sourcingMethod: command.sourcingMethod,
        lifecycleState: "draft",
        currency: "USD",
        responseDeadline: command.responseDeadline,
        sealedUntil: command.sealedUntil,
        retentionUntil: command.retentionUntil,
        termsVersion: command.termsVersion,
        evaluationVersion: command.evaluationVersion,
        lines: command.lines,
        suppliers,
        responses: [],
        evaluations: [],
        amendments: [],
        questions: [],
        addenda: [],
        conflicts: [],
        negotiations: [],
        decisionNotices: [],
        bafoRound: 1,
        version: 1,
        correlationId: command.correlationId,
      });
      appendAudit(next, command, {
        action: "rfq.authored",
        recordType: "rfq",
        recordId: command.rfqId,
        before: "not_created",
        after: "draft",
        source: "user",
      });
      break;
    }
    case "phase3_rfq_update_draft": {
      requirePersona(command, [
        "purchasing_specialist",
        "purchasing_manager",
      ]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (rfq.lifecycleState !== "draft") {
        throw new WorkflowError("Only a draft RFQ can be edited directly.");
      }
      const before = responseHash({
        title: rfq.title,
        description: rfq.description,
        responseDeadline: rfq.responseDeadline,
        termsVersion: rfq.termsVersion,
        evaluationVersion: rfq.evaluationVersion,
      });
      rfq.title = command.title;
      rfq.description = command.description;
      rfq.responseDeadline = command.responseDeadline;
      rfq.sealedUntil = command.sealedUntil;
      rfq.termsVersion = command.termsVersion;
      rfq.evaluationVersion = command.evaluationVersion;
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.draft.updated",
        recordType: "rfq",
        recordId: rfq.id,
        before,
        after: responseHash(rfq),
        source: "user",
      });
      break;
    }
    case "phase3_rfq_release": {
      requirePersona(command, [
        "purchasing_specialist",
        "purchasing_manager",
      ]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (rfq.lifecycleState !== "draft") {
        throw new WorkflowError("Only a draft RFQ can be released.");
      }
      if (next.stage !== "standards_reviewed") {
        throw new WorkflowError(
          "Complete inventory and standards optimization before releasing the RFQ.",
        );
      }
      if (rfq.suppliers.length < 2 || rfq.lines.length === 0) {
        throw new WorkflowError(
          "The RFQ requires at least two eligible suppliers and one line.",
        );
      }
      const before = rfq.lifecycleState;
      const releasedAt = timestamp(next);
      rfq.issueDate = next.sessionDate;
      rfq.lifecycleState = "open";
      rfq.suppliers.forEach((supplier) => {
        supplier.status = "invited";
        supplier.invitedAt = releasedAt;
      });
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.released",
        recordType: "rfq",
        recordId: rfq.id,
        before,
        after: rfq.lifecycleState,
        source: "workflow",
      });
      break;
    }
    case "phase3_rfq_amend": {
      requirePersona(command, [
        "purchasing_specialist",
        "purchasing_manager",
      ]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (
        !["open", "responses_received", "bafo_open"].includes(
          rfq.lifecycleState,
        )
      ) {
        throw new WorkflowError(
          "Only an open response round can be amended.",
        );
      }
      const supersededResponseIds = currentRoundResponses(rfq).map(
        (response) => response.id,
      );
      rfq.responses
        .filter((response) => supersededResponseIds.includes(response.id))
        .forEach((response) => {
          response.status = "superseded";
        });
      const amendmentVersion = rfq.amendments.length + 1;
      rfq.amendments.push({
        id: `${rfq.id}-amendment-${amendmentVersion}`,
        version: amendmentVersion,
        issuedAt: timestamp(next),
        issuedByRole: command.activePersona,
        rationale: command.rationale,
        changes: command.changes,
        responseDeadline: command.responseDeadline,
        supersededResponseIds,
      });
      rfq.responseDeadline = command.responseDeadline;
      rfq.sealedUntil = command.sealedUntil;
      rfq.termsVersion = `${rfq.termsVersion}-a${amendmentVersion}`;
      if (rfq.lifecycleState !== "bafo_open") {
        rfq.lifecycleState = "open";
        rfq.suppliers
          .filter((supplier) => supplier.status !== "declined")
          .forEach((supplier) => {
            supplier.status = "invited";
          });
      }
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.amendment.issued",
        recordType: "rfq_amendment",
        recordId: `${rfq.id}-amendment-${amendmentVersion}`,
        before: supersededResponseIds.join(",") || "no_responses",
        after: `version:${amendmentVersion}`,
        source: "user",
      });
      break;
    }
    case "phase3_rfq_submit_question": {
      requirePersona(command, ["supplier_user"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (!["open", "responses_received", "bafo_open"].includes(rfq.lifecycleState)) {
        throw new WorkflowError("This RFQ is not accepting supplier questions.");
      }
      const supplier = rfq.suppliers.find(
        (candidate) => candidate.supplierId === command.supplierId,
      );
      if (
        !supplier ||
        !["invited", "viewed", "responded", "shortlisted"].includes(
          supplier.status,
        )
      ) {
        throw new WorkflowError("The supplier is not invited to this RFQ.");
      }
      const questionId = `${rfq.id}-question-${command.correlationId}`;
      rfq.questions.push({
        id: questionId,
        supplierId: supplier.supplierId,
        supplierOrganizationId: supplier.supplierOrganizationId,
        question: command.question,
        submittedAt: timestamp(next),
        status: "open",
      });
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.question.submitted",
        recordType: "rfq_question",
        recordId: questionId,
        before: "not_submitted",
        after: "open",
        source: "user",
      });
      break;
    }
    case "phase3_rfq_answer_question": {
      requirePersona(command, [
        "purchasing_specialist",
        "purchasing_manager",
      ]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      const question = findById(
        rfq.questions,
        command.questionId,
        "RFQ question",
      );
      if (question.status !== "open") {
        throw new WorkflowError("This supplier question is already answered.");
      }
      const addendumId = `${rfq.id}-addendum-${rfq.addenda.length + 1}`;
      question.status = "answered";
      question.answer = command.answer;
      question.answeredAt = timestamp(next);
      question.answeredByRole = command.activePersona;
      question.addendumId = addendumId;
      rfq.addenda.push({
        id: addendumId,
        version: rfq.addenda.length + 1,
        issuedAt: timestamp(next),
        issuedByRole: command.activePersona,
        title: command.addendumTitle,
        content: command.answer,
        sourceQuestionId: question.id,
      });
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.addendum.issued",
        recordType: "rfq_addendum",
        recordId: addendumId,
        before: question.id,
        after: "distributed_to_all_invited_suppliers",
        source: "user",
      });
      break;
    }
    case "phase3_rfq_decline": {
      requirePersona(command, ["supplier_user"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (!["open", "responses_received", "bafo_open"].includes(rfq.lifecycleState)) {
        throw new WorkflowError("This RFQ invitation can no longer be declined.");
      }
      const supplier = rfq.suppliers.find(
        (candidate) => candidate.supplierId === command.supplierId,
      );
      if (!supplier || ["awarded", "not_awarded"].includes(supplier.status)) {
        throw new WorkflowError("The supplier has no active invitation.");
      }
      if (
        currentRoundResponses(rfq).some(
          (response) => response.supplierId === command.supplierId,
        )
      ) {
        throw new WorkflowError(
          "Withdraw the current response before declining the invitation.",
        );
      }
      supplier.status = "declined";
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.invitation.declined",
        recordType: "rfq_supplier",
        recordId: `${rfq.id}:${supplier.supplierId}`,
        before: "invited",
        after: "declined",
        source: "user",
      });
      break;
    }
    case "phase3_rfq_withdraw_response": {
      requirePersona(command, ["supplier_user"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (!["open", "responses_received", "bafo_open"].includes(rfq.lifecycleState)) {
        throw new WorkflowError(
          "Responses cannot be withdrawn after the round closes.",
        );
      }
      const response = currentRoundResponses(rfq).find(
        (candidate) =>
          candidate.supplierId === command.supplierId &&
          candidate.status === "submitted",
      );
      if (!response) {
        throw new WorkflowError(
          "No submitted response is available to withdraw.",
        );
      }
      response.status = "withdrawn";
      const supplier = rfq.suppliers.find(
        (candidate) => candidate.supplierId === command.supplierId,
      );
      if (supplier) {
        supplier.status =
          rfq.lifecycleState === "bafo_open" ? "shortlisted" : "invited";
      }
      if (rfq.lifecycleState === "responses_received") {
        rfq.lifecycleState = "open";
      }
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.response.withdrawn",
        recordType: "rfq_response",
        recordId: response.id,
        before: "sealed",
        after: "withdrawn",
        source: "user",
      });
      break;
    }
    case "phase3_rfq_disclose_conflict": {
      requirePersona(command, [
        "purchasing_specialist",
        "purchasing_manager",
      ]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (command.supplierId) {
        if (
          !rfq.suppliers.some(
            (supplier) => supplier.supplierId === command.supplierId,
          )
        ) {
          throw new WorkflowError("RFQ supplier was not found.");
        }
      }
      const conflictId = `${rfq.id}-conflict-${command.correlationId}`;
      rfq.conflicts.push({
        id: conflictId,
        disclosedByRole: command.activePersona,
        supplierId: command.supplierId,
        description: command.description,
        status: "open",
        disclosedAt: timestamp(next),
      });
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.conflict.disclosed",
        recordType: "rfq_conflict",
        recordId: conflictId,
        before: "not_disclosed",
        after: "open",
        source: "user",
      });
      break;
    }
    case "phase3_rfq_resolve_conflict": {
      requirePersona(command, ["compliance_reviewer", "purchasing_manager"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      const conflict = findById(
        rfq.conflicts,
        command.conflictId,
        "RFQ conflict",
      );
      if (conflict.status !== "open") {
        throw new WorkflowError("This conflict has already been dispositioned.");
      }
      if (
        conflict.disclosedByRole === command.activePersona &&
        command.disposition === "mitigated"
      ) {
        throw new WorkflowError(
          "The conflicted role cannot independently approve its mitigation.",
        );
      }
      conflict.status = command.disposition;
      conflict.resolvedAt = timestamp(next);
      conflict.resolvedByRole = command.activePersona;
      conflict.resolution = command.resolution;
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.conflict.resolved",
        recordType: "rfq_conflict",
        recordId: conflict.id,
        before: "open",
        after: conflict.status,
        source: "user",
      });
      break;
    }
    case "phase3_rfq_record_negotiation": {
      requirePersona(command, ["purchasing_manager"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (!["evaluated", "bafo_open"].includes(rfq.lifecycleState)) {
        throw new WorkflowError(
          "Negotiation may be recorded only after governed evaluation.",
        );
      }
      if (
        !rfq.suppliers.some(
          (supplier) =>
            supplier.supplierId === command.supplierId &&
            ["shortlisted", "responded"].includes(supplier.status),
        )
      ) {
        throw new WorkflowError(
          "Negotiation is restricted to an evaluated or shortlisted supplier.",
        );
      }
      const negotiationId = `${rfq.id}-negotiation-${command.correlationId}`;
      rfq.negotiations.push({
        id: negotiationId,
        supplierId: command.supplierId,
        round: rfq.bafoRound,
        recordedAt: timestamp(next),
        recordedByRole: command.activePersona,
        summary: command.summary,
        evidence: command.negotiationEvidence,
      });
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.negotiation.recorded",
        recordType: "rfq_negotiation",
        recordId: negotiationId,
        before: "not_recorded",
        after: `round:${rfq.bafoRound}`,
        source: "user",
      });
      break;
    }
    case "phase3_rfq_submit_response":
    case "phase3_rfq_submit_bafo": {
      requirePersona(command, ["supplier_user"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      const bafo = command.type === "phase3_rfq_submit_bafo";
      if (
        (!bafo &&
          !["open", "responses_received"].includes(rfq.lifecycleState)) ||
        (bafo && rfq.lifecycleState !== "bafo_open")
      ) {
        throw new WorkflowError(
          bafo
            ? "This RFQ is not accepting best-and-final offers."
            : "This RFQ is not accepting supplier responses.",
        );
      }
      const supplier = rfq.suppliers.find(
        (candidate) => candidate.supplierId === command.supplierId,
      );
      if (
        !supplier ||
        (bafo && supplier.status !== "shortlisted") ||
        (!bafo &&
          !["invited", "viewed", "responded"].includes(supplier.status))
      ) {
        throw new WorkflowError(
          "The supplier is not invited for this response round.",
        );
      }
      if (
        rfq.responses.some(
          (response) =>
            response.supplierId === command.supplierId &&
            response.round === rfq.bafoRound &&
            response.status !== "withdrawn",
        )
      ) {
        throw new WorkflowError(
          "This supplier already submitted a response for the current round.",
        );
      }
      const offeredIds = command.offers.map((offer) => offer.rfqLineId);
      if (
        new Set(offeredIds).size !== offeredIds.length ||
        offeredIds.length !== rfq.lines.length ||
        rfq.lines.some((line) => !offeredIds.includes(line.id))
      ) {
        throw new WorkflowError(
          "The response must price every RFQ line exactly once.",
        );
      }
      const lines = rfq.lines.map((line) => {
        const offer = command.offers.find(
          (candidate) => candidate.rfqLineId === line.id,
        )!;
        return {
          rfqLineId: line.id,
          unitPriceCents: offer.unitPriceCents,
          extendedPriceCents: offer.unitPriceCents * line.quantity,
          promisedDate: offer.promisedDate,
          exception: offer.exception,
        };
      });
      const responseBody = {
        supplierId: supplier.supplierId,
        supplierOrganizationId: supplier.supplierOrganizationId,
        round: rfq.bafoRound,
        freightCents: command.freightCents,
        paymentTerms: command.paymentTerms,
        validityDate: command.validityDate,
        lines,
        attachments: command.attachments,
      };
      const response = {
        id: `${rfq.id}-response-${supplier.supplierId}-r${rfq.bafoRound}`,
        ...responseBody,
        status: "submitted" as const,
        submittedAt: timestamp(next),
        totalCents:
          lines.reduce(
            (total, line) => total + line.extendedPriceCents,
            0,
          ) + command.freightCents,
        responseHash: responseHash(responseBody),
      };
      rfq.responses.push(response);
      supplier.status = "responded";
      const expectedSuppliers = rfq.suppliers.filter((candidate) =>
        bafo
          ? candidate.status === "shortlisted" ||
            candidate.supplierId === supplier.supplierId
          : !["declined", "not_awarded"].includes(candidate.status),
      );
      const received = currentRoundResponses(rfq);
      if (!bafo && received.length >= expectedSuppliers.length) {
        rfq.lifecycleState = "responses_received";
      }
      rfq.version += 1;
      appendAudit(next, command, {
        action: bafo ? "rfq.bafo.submitted" : "rfq.response.submitted",
        recordType: "rfq_response",
        recordId: response.id,
        before: "not_submitted",
        after: "sealed",
        source: "user",
      });
      break;
    }
    case "phase3_rfq_close": {
      requirePersona(command, [
        "purchasing_specialist",
        "purchasing_manager",
      ]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (
        !["open", "responses_received", "bafo_open"].includes(
          rfq.lifecycleState,
        )
      ) {
        throw new WorkflowError("This RFQ response round cannot be closed.");
      }
      const responses = currentRoundResponses(rfq);
      if (responses.length < 2) {
        throw new WorkflowError(
          "At least two sealed responses are required before closing.",
        );
      }
      const before = rfq.lifecycleState;
      const revealedAt = timestamp(next);
      responses.forEach((response) => {
        response.status = "revealed";
        response.revealedAt = revealedAt;
      });
      rfq.lifecycleState = "closed";
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.responses.revealed",
        recordType: "rfq",
        recordId: rfq.id,
        before,
        after: rfq.lifecycleState,
        source: "workflow",
      });
      break;
    }
    case "phase3_rfq_evaluate": {
      requirePersona(command, ["purchasing_specialist"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (rfq.lifecycleState !== "closed") {
        throw new WorkflowError(
          "Close and reveal the current response round before evaluation.",
        );
      }
      if (rfq.conflicts.some((conflict) => conflict.status === "open")) {
        throw new WorkflowError(
          "Open conflict disclosures must be mitigated or recused before evaluation.",
        );
      }
      const responses = currentRoundResponses(rfq).filter(
        (response) => response.status === "revealed",
      );
      if (responses.length < 2) {
        throw new WorkflowError(
          "At least two revealed responses are required for evaluation.",
        );
      }
      const lowestTotal = Math.min(
        ...responses.map((response) => response.totalCents),
      );
      const bestDelivery = responses
        .map((response) =>
          response.lines
            .map((line) => line.promisedDate)
            .sort()
            .at(-1)!,
        )
        .sort()[0]!;
      const scored = responses.map((response) => {
        const vendor = next.vendors.find(
          (candidate) => candidate.id === response.supplierId,
        );
        if (!vendor) {
          throw new WorkflowError(
            "A supplier master record is missing for evaluation.",
          );
        }
        const latestDelivery = response.lines
          .map((line) => line.promisedDate)
          .sort()
          .at(-1)!;
        const priceScore = (lowestTotal / response.totalCents) * 50;
        const deliveryScore = latestDelivery === bestDelivery ? 20 : 16;
        const riskScore =
          vendor.complianceHold || vendor.criticalCorrectiveAction
            ? 0
            : vendor.riskTier === "low"
              ? 20
              : vendor.riskTier === "moderate"
                ? 14
                : vendor.riskTier === "high"
                  ? 6
                  : 0;
        const serviceScore = vendor.performanceScore / 10;
        return {
          id: `${rfq.id}-evaluation-${response.supplierId}-r${rfq.bafoRound}`,
          responseId: response.id,
          supplierId: response.supplierId,
          round: rfq.bafoRound,
          priceScore: Number(priceScore.toFixed(2)),
          deliveryScore,
          riskScore,
          serviceScore: Number(serviceScore.toFixed(2)),
          totalScore: Number(
            (
              priceScore +
              deliveryScore +
              riskScore +
              serviceScore
            ).toFixed(2),
          ),
          rank: 0,
          completedByRole: command.activePersona,
          evidence: [
            `response:${response.id}:${response.responseHash}`,
            `supplier-risk:${vendor.id}:${vendor.riskTier}`,
            `supplier-performance:${vendor.id}:${vendor.performanceScore}`,
          ],
        };
      });
      scored
        .sort(
          (left, right) =>
            right.totalScore - left.totalScore ||
            left.supplierId.localeCompare(right.supplierId),
        )
        .forEach((evaluation, index) => {
          evaluation.rank = index + 1;
        });
      rfq.evaluations = [
        ...rfq.evaluations.filter(
          (evaluation) => evaluation.round !== rfq.bafoRound,
        ),
        ...scored,
      ];
      rfq.lifecycleState = "evaluated";
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.evaluation.completed",
        recordType: "rfq",
        recordId: rfq.id,
        before: "closed",
        after: rfq.lifecycleState,
        source: "workflow",
      });
      break;
    }
    case "phase3_rfq_request_bafo": {
      requirePersona(command, ["purchasing_manager"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (rfq.lifecycleState !== "evaluated") {
        throw new WorkflowError(
          "Complete the governed evaluation before requesting BAFO.",
        );
      }
      const selected = new Set(command.supplierIds);
      if (
        selected.size !== command.supplierIds.length ||
        [...selected].some(
          (supplierId) =>
            !rfq.evaluations.some(
              (evaluation) =>
                evaluation.round === rfq.bafoRound &&
                evaluation.supplierId === supplierId,
            ),
        )
      ) {
        throw new WorkflowError(
          "BAFO suppliers must come from the evaluated response round.",
        );
      }
      rfq.responses
        .filter((response) => response.round === rfq.bafoRound)
        .forEach((response) => {
          response.status = "superseded";
        });
      rfq.suppliers.forEach((supplier) => {
        supplier.status = selected.has(supplier.supplierId)
          ? "shortlisted"
          : "not_awarded";
      });
      rfq.bafoRound += 1;
      rfq.lifecycleState = "bafo_open";
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.bafo.requested",
        recordType: "rfq",
        recordId: rfq.id,
        before: "evaluated",
        after: rfq.lifecycleState,
        source: "workflow",
      });
      break;
    }
    case "phase3_rfq_award": {
      requirePersona(command, ["purchasing_manager"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (rfq.lifecycleState !== "evaluated") {
        throw new WorkflowError(
          "The current response round must be evaluated before award.",
        );
      }
      if (rfq.conflicts.some((conflict) => conflict.status === "open")) {
        throw new WorkflowError(
          "Open conflict disclosures must be mitigated or recused before award.",
        );
      }
      const evaluation = rfq.evaluations.find(
        (candidate) =>
          candidate.round === rfq.bafoRound &&
          candidate.supplierId === command.supplierId,
      );
      const response = rfq.responses.find(
        (candidate) =>
          candidate.round === rfq.bafoRound &&
          candidate.supplierId === command.supplierId &&
          candidate.status === "revealed",
      );
      if (!evaluation || !response) {
        throw new WorkflowError(
          "The selected supplier has no evaluated revealed response.",
        );
      }
      if (evaluation.completedByRole === command.activePersona) {
        throw new WorkflowError(
          "The evaluator cannot independently approve the award.",
        );
      }
      const vendor = next.vendors.find(
        (candidate) => candidate.id === command.supplierId,
      );
      const supplierApplication = phaseThree.supplierApplications.find(
        (candidate) => candidate.supplierId === command.supplierId,
      );
      if (
        !vendor ||
        vendor.complianceHold ||
        vendor.criticalCorrectiveAction ||
        vendor.documentationStatus !== "complete" ||
        (supplierApplication &&
          supplierApplication.lifecycleState !== "active")
      ) {
        throw new WorkflowError(
          "Supplier control evidence blocks this award.",
        );
      }
      rfq.award = {
        supplierId: command.supplierId,
        responseId: response.id,
        awardedByRole: command.activePersona,
        awardedAt: timestamp(next),
        rationale: command.rationale,
        totalCents: response.totalCents,
      };
      rfq.suppliers.forEach((supplier) => {
        supplier.status =
          supplier.supplierId === command.supplierId
            ? "awarded"
            : "not_awarded";
        rfq.decisionNotices.push({
          id: `${rfq.id}-${supplier.supplierId}-decision-${rfq.bafoRound}`,
          supplierId: supplier.supplierId,
          noticeType:
            supplier.supplierId === command.supplierId
              ? "award"
              : "non_award",
          issuedAt: timestamp(next),
          issuedByRole: command.activePersona,
          summary:
            supplier.supplierId === command.supplierId
              ? "Award notice issued with the approved decision evidence."
              : "Non-award notice issued without exposing another supplier's confidential response.",
          evidence: [
            `rfq:${rfq.id}`,
            `evaluation-round:${rfq.bafoRound}`,
            `decision-correlation:${command.correlationId}`,
          ],
        });
      });
      rfq.lifecycleState = "awarded";
      rfq.version += 1;
      const request = next.requests.find(
        (candidate) => candidate.id === rfq.requestId,
      );
      const quote = next.quotes.find(
        (candidate) =>
          candidate.requestId === rfq.requestId &&
          candidate.vendorId === command.supplierId,
      );
      if (!request || !quote) {
        throw new WorkflowError(
          "The awarded RFQ is not connected to its request and quote records.",
        );
      }
      for (const responseLine of response.lines) {
        const rfqLine = rfq.lines.find(
          (candidate) => candidate.id === responseLine.rfqLineId,
        );
        const requestLine = request.lines.find(
          (candidate) => candidate.id === rfqLine?.requestLineId,
        );
        if (!rfqLine || !requestLine) {
          throw new WorkflowError(
            "An awarded RFQ line is not connected to its request line.",
          );
        }
        if (requestLine.purchaseQuantity !== rfqLine.quantity) {
          throw new WorkflowError(
            "The awarded RFQ quantity does not reconcile to the external purchase quantity.",
          );
        }
        requestLine.unitPriceCents = responseLine.unitPriceCents;
      }
      const awardedSubtotal = response.lines.reduce(
        (total, line) => total + line.extendedPriceCents,
        0,
      );
      quote.subtotalCents = awardedSubtotal;
      quote.shippingCents = response.totalCents - awardedSubtotal;
      quote.taxCents = 0;
      quote.totalCents = response.totalCents;
      quote.deliveryDate = response.lines
        .map((line) => line.promisedDate)
        .sort()
        .at(-1)!;
      quote.recommendation = "recommended";
      next.quotes
        .filter(
          (candidate) =>
            candidate.requestId === rfq.requestId &&
            candidate.id !== quote.id,
        )
        .forEach((candidate) => {
          candidate.recommendation = "alternative";
        });
      request.selectedVendorId = command.supplierId;
      request.recommendedTotalCents = response.totalCents;
      request.revision += 1;
      next.stage = "vendor_selected";
      appendAudit(next, command, {
        action: "rfq.award.approved",
        recordType: "rfq_award",
        recordId: rfq.id,
        before: "evaluated",
        after: `awarded:${command.supplierId}`,
        source: "user",
      });
      break;
    }
    case "phase3_rfq_cancel": {
      requirePersona(command, ["purchasing_manager"]);
      const rfq = findById(phaseThree.rfqs, command.rfqId, "RFQ");
      if (["awarded", "cancelled"].includes(rfq.lifecycleState)) {
        throw new WorkflowError("This RFQ cannot be cancelled.");
      }
      const before = rfq.lifecycleState;
      rfq.lifecycleState = "cancelled";
      rfq.suppliers
        .filter((supplier) => supplier.status !== "declined")
        .forEach((supplier) => {
          rfq.decisionNotices.push({
            id: `${rfq.id}-${supplier.supplierId}-cancellation-${rfq.version + 1}`,
            supplierId: supplier.supplierId,
            noticeType: "cancellation",
            issuedAt: timestamp(next),
            issuedByRole: command.activePersona,
            summary: command.rationale,
            evidence: [
              `rfq:${rfq.id}`,
              `decision-correlation:${command.correlationId}`,
            ],
          });
        });
      rfq.version += 1;
      appendAudit(next, command, {
        action: "rfq.cancelled",
        recordType: "rfq",
        recordId: rfq.id,
        before,
        after: rfq.lifecycleState,
        source: "user",
      });
      break;
    }
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
    case "phase3_bank_propose": {
      requirePersona(command, ["supplier_user"]);
      const supplier = findById(
        phaseThree.supplierApplications,
        command.applicationId,
        "Supplier application",
      );
      if (
        supplier.bankingChange &&
        ["verification_pending", "approval_pending"].includes(
          supplier.bankingChange.status,
        )
      ) {
        throw new WorkflowError(
          "The current banking proposal must be decided before another is submitted.",
        );
      }
      const before = supplier.bankingChange?.status ?? "not_proposed";
      supplier.bankingChange = {
        id: `${supplier.id}-banking-${command.correlationId}`,
        proposedLastFour: command.accountLastFour,
        proposedBy: command.activePersona,
        status: "verification_pending",
        paymentInitiated: false,
      };
      supplier.version += 1;
      appendAudit(next, command, {
        action: "supplier.banking_change.proposed",
        recordType: "banking_change",
        recordId: supplier.bankingChange.id,
        before,
        after: "verification_pending",
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
      const snapshot: ReportSnapshot = {
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
          "Synthetic governed snapshot retained for role-scoped delivery.",
        correlationId: command.correlationId,
      };
      phaseThree.reportSnapshots.push(snapshot);
      for (const format of ["pdf", "xlsx", "csv"] as const) {
        snapshot.exportHashes[format.toUpperCase() as "PDF" | "XLSX" | "CSV"] =
          buildReportExport(next, id, format).sha256;
      }
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
    case "phase3_create_report_schedule": {
      requirePersona(command, [
        "executive",
        "auditor",
        "purchasing_manager",
        "finance_reviewer",
      ]);
      findById(
        phaseThree.reportDefinitions,
        command.reportId,
        "Report definition",
      );
      const duplicate = phaseThree.reportSchedules.find(
        (schedule) =>
          schedule.reportId === command.reportId &&
          schedule.status === "active",
      );
      if (duplicate) {
        throw new WorkflowError(
          "An active schedule already exists for this governed report.",
        );
      }
      const id = `report-schedule-${String(phaseThree.reportSchedules.length + 1).padStart(4, "0")}`;
      const createdAt = timestamp(next);
      const nextRunAt = `${next.sessionDate}T18:00:00-04:00`;
      phaseThree.reportSchedules.push({
        id,
        reportId: command.reportId,
        cadence: command.cadence,
        exportFormat: command.exportFormat,
        recipientRoles: [...new Set(command.recipientRoles)],
        secureLinkExpiresHours: command.secureLinkExpiresHours,
        retentionDays: command.retentionDays,
        status: "active",
        createdByRole: command.activePersona as DemoRole,
        createdAt,
        nextRunAt,
        correlationId: command.correlationId,
      });
      appendAudit(next, command, {
        action: "report.schedule.created",
        recordType: "report_schedule",
        recordId: id,
        before: "not_configured",
        after: "active",
        source: "user",
      });
      break;
    }
    case "phase3_deliver_report": {
      requirePersona(command, [
        "executive",
        "auditor",
        "purchasing_manager",
        "finance_reviewer",
      ]);
      const schedule = findById(
        phaseThree.reportSchedules,
        command.scheduleId,
        "Report schedule",
      );
      const snapshot = findById(
        phaseThree.reportSnapshots,
        command.snapshotId,
        "Report snapshot",
      );
      if (schedule.status !== "active") {
        throw new WorkflowError("The report schedule is not active.");
      }
      if (snapshot.reportId !== schedule.reportId) {
        throw new WorkflowError(
          "The selected snapshot does not belong to the scheduled report.",
        );
      }
      const contentHash = snapshot.exportHashes[schedule.exportFormat];
      if (!contentHash) {
        throw new WorkflowError(
          "The governed export hash is unavailable; no delivery was recorded.",
        );
      }
      const id = `report-delivery-${String(phaseThree.reportDeliveries.length + 1).padStart(4, "0")}`;
      const deliveredAt = timestamp(next);
      const delivered = new Date(deliveredAt);
      const expiresAt = new Date(
        delivered.getTime() + schedule.secureLinkExpiresHours * 3_600_000,
      ).toISOString();
      const retentionUntil = new Date(
        delivered.getTime() + schedule.retentionDays * 86_400_000,
      ).toISOString();
      phaseThree.reportDeliveries.push({
        id,
        scheduleId: schedule.id,
        snapshotId: snapshot.id,
        recipientRoles: [...schedule.recipientRoles],
        exportFormat: schedule.exportFormat,
        contentHash,
        status: "delivered",
        deliveredAt,
        expiresAt,
        retentionUntil,
        correlationId: command.correlationId,
      });
      appendAudit(next, command, {
        action: "report.delivery.recorded",
        recordType: "report_delivery",
        recordId: id,
        before: "not_delivered",
        after: "delivered",
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
