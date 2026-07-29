import "server-only";

import type { DemoState } from "@/demo/model";
import { PHASE_THREE_RELEASE_BASELINE } from "@/phase-three/seed";
import { createSupabaseServiceClient } from "@/server/supabase/admin";

function ensureNoError(
  result: { error: { code?: string; message?: string } | null },
  label: string,
) {
  if (result.error) {
    throw new Error(
      `PHASE3_PROJECTION_FAILED:${label}:${result.error.code ?? "UNKNOWN"}`,
    );
  }
}

export async function syncPhaseThreeProjection(
  tenantId: string,
  state: DemoState,
) {
  const client = createSupabaseServiceClient();
  const phaseThree = state.phaseThree;

  const results = await Promise.all([
    client.from("phase3_capability_registry").upsert(
      phaseThree.capabilityRegistry.map((capability) => ({
        tenant_id: tenantId,
        capability_id: capability.capabilityId,
        name: capability.name,
        description: capability.description,
        owning_module: capability.owningModule,
        status: capability.status,
        implementation_evidence: capability.implementationEvidence,
        data_source: capability.dataSource,
        provider_dependency: capability.providerDependency,
        customer_dependency: capability.customerDependency,
        security_considerations: capability.securityConsiderations,
        known_limitations: capability.knownLimitations,
        activation_requirements: capability.activationRequirements,
        release_first_verified: capability.releaseFirstVerified,
        last_verification_result: capability.lastVerificationResult,
        owner: capability.owner,
        version: capability.version,
      })),
      { onConflict: "tenant_id,capability_id" },
    ),
    client.from("phase3_dataset_versions").upsert(
      {
        tenant_id: tenantId,
        dataset_version: phaseThree.dataset.version,
        schema_version: phaseThree.dataset.schemaVersion,
        content_hash: phaseThree.dataset.contentHash,
        effective_release: PHASE_THREE_RELEASE_BASELINE,
        demonstration_date: phaseThree.dataset.demonstrationDate,
        expected_record_counts: phaseThree.dataset.expectedRecordCounts,
        expected_totals: phaseThree.dataset.expectedTotals,
        expected_outcomes: phaseThree.dataset.expectedOutcomes,
      },
      { onConflict: "tenant_id,dataset_version" },
    ),
    client.from("phase3_integration_connections").upsert(
      phaseThree.integrations.map((connection) => ({
        tenant_id: tenantId,
        connection_key: connection.connectionKey,
        adapter_key: connection.adapterKey,
        name: connection.name,
        truth_status: connection.truthStatus,
        lifecycle_state: connection.lifecycleState,
        mapping_version: connection.mappingVersion,
        source_of_truth: connection.sourceOfTruth,
        configuration: { mappings: connection.mappings },
        activation_requirements: connection.activationRequirements,
        last_tested_at: connection.lastTestedAt,
      })),
      { onConflict: "tenant_id,connection_key" },
    ),
    client.from("phase3_integration_runs").upsert(
      phaseThree.integrationRuns.map((run) => ({
        tenant_id: tenantId,
        connection_key: run.connectionKey,
        batch_id: run.batchId,
        direction: run.direction,
        status: run.status,
        record_count: run.recordCount,
        accepted_count: run.acceptedCount,
        rejected_count: run.rejectedCount,
        source_total_cents: run.sourceTotalCents,
        posted_total_cents: run.postedTotalCents,
        mapping_version: run.mappingVersion,
        source_timestamp: run.sourceTimestamp,
        ingestion_timestamp: run.ingestionTimestamp,
        content_hash: run.contentHash,
        checkpoint: run.checkpoint,
        retry_count: run.retryCount,
        validation_findings: run.validationFindings,
        reconciliation: { summary: run.reconciliation },
        correlation_id: run.correlationId,
        simulated: true,
      })),
      { onConflict: "tenant_id,connection_key,batch_id" },
    ),
    client.from("phase3_supplier_applications").upsert(
      phaseThree.supplierApplications.map((supplier) => ({
        tenant_id: tenantId,
        supplier_id: supplier.supplierId,
        supplier_organization_id: supplier.supplierOrganizationId,
        lifecycle_state: supplier.lifecycleState,
        risk_tier: supplier.riskTier,
        document_status: supplier.documentStatus,
        review_domains: {
          supplierName: supplier.supplierName,
          documents: supplier.documents,
          reviews: supplier.reviews,
          validationFindings: supplier.validationFindings,
        },
        remediation_items: supplier.remediationItems,
        banking_change: supplier.bankingChange,
        version: supplier.version,
        correlation_id: supplier.correlationId,
      })),
      { onConflict: "tenant_id,supplier_id" },
    ),
    client.from("phase3_contract_intelligence").upsert(
      phaseThree.contracts.map((contract) => ({
        tenant_id: tenantId,
        contract_id: contract.contractId,
        document_version: contract.documentVersion,
        document_hash: contract.documentHash,
        storage_path: contract.storagePath,
        lifecycle_state: contract.lifecycleState,
        extraction_method: contract.extractionMethod,
        findings: contract.findings,
        obligations: contract.obligations,
        conflicts: contract.conflicts,
        correlation_id: contract.correlationId,
      })),
      { onConflict: "tenant_id,contract_id,document_version" },
    ),
    client.from("phase3_workflow_versions").upsert(
      phaseThree.workflowVersions.map((workflow) => ({
        tenant_id: tenantId,
        workflow_key: workflow.workflowKey,
        version: workflow.version,
        lifecycle_state: workflow.lifecycleState,
        definition: {
          id: workflow.id,
          name: workflow.name,
          family: workflow.family,
          blocks: workflow.blocks,
          authoredBy: workflow.authoredBy,
          approvedBy: workflow.approvedBy,
          supersedes: workflow.supersedes,
        },
        validation_findings: workflow.validationFindings,
        simulation_result: workflow.simulationResult
          ? { summary: workflow.simulationResult }
          : null,
        effective_at: workflow.effectiveAt,
        correlation_id: workflow.correlationId,
      })),
      { onConflict: "tenant_id,workflow_key,version" },
    ),
    phaseThree.reportSnapshots.length > 0
      ? client.from("phase3_report_snapshots").upsert(
          phaseThree.reportSnapshots.map((snapshot) => ({
            tenant_id: tenantId,
            snapshot_key: snapshot.id,
            report_key: snapshot.reportId,
            report_version:
              phaseThree.reportDefinitions.find(
                (definition) => definition.id === snapshot.reportId,
              )?.version ?? 1,
            as_of: snapshot.asOf,
            filters: snapshot.filters,
            certified_measures: snapshot.measures,
            source_record_ids: snapshot.sourceRecordIds,
            source_hash: snapshot.sourceHash,
            export_hashes: snapshot.exportHashes,
            narrative:
              phaseThree.cateNarratives.find(
                (narrative) =>
                  narrative.correlationId === snapshot.correlationId,
              ) ?? null,
            correlation_id: snapshot.correlationId,
          })),
          { onConflict: "tenant_id,snapshot_key" },
        )
      : Promise.resolve({ error: null }),
    client.from("phase3_assurance_findings").upsert(
      phaseThree.assuranceFindings.map((finding) => ({
        tenant_id: tenantId,
        finding_key: finding.id,
        domain: finding.domain,
        control_id: finding.controlId,
        severity: finding.severity,
        status: finding.status,
        evidence: finding.evidence,
        failure_scenario: finding.failureScenario,
        owner: finding.owner,
        remediation: finding.remediation,
        due_date: finding.dueDate,
        retest: finding.retest ? { result: finding.retest } : null,
        residual_risk: finding.residualRisk,
        acceptance_authority: finding.acceptanceAuthority,
        release_effect: finding.releaseEffect,
        correlation_id: finding.correlationId,
      })),
      { onConflict: "tenant_id,finding_key" },
    ),
    client.from("phase3_operations_records").upsert(
      [
        ...phaseThree.operationsSignals.map((signal) => ({
          tenant_id: tenantId,
          record_type: "health_signal",
          record_key: signal.id,
          status: signal.status,
          severity: null,
          owner: "Operations owner",
          payload: signal,
          correlation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        })),
        ...phaseThree.incidents.map((incident) => ({
          tenant_id: tenantId,
          record_type: "incident",
          record_key: incident.id,
          status: incident.status,
          severity: incident.severity,
          owner: incident.owner,
          payload: incident,
          correlation_id: incident.correlationId,
        })),
        ...phaseThree.supportCases.map((supportCase) => ({
          tenant_id: tenantId,
          record_type: "support_case",
          record_key: supportCase.id,
          status: supportCase.status,
          severity: supportCase.priority,
          owner: supportCase.assignee,
          payload: supportCase,
          correlation_id: supportCase.correlationId,
        })),
        ...phaseThree.runbooks.map((runbook, index) => ({
          tenant_id: tenantId,
          record_type: "runbook",
          record_key: runbook.id,
          status: runbook.status,
          severity: null,
          owner: runbook.owner,
          payload: runbook,
          correlation_id: `eeeeeeee-eeee-4eee-8eee-${String(index + 1).padStart(12, "0")}`,
        })),
      ],
      { onConflict: "tenant_id,record_type,record_key" },
    ),
  ]);

  results.forEach((result, index) =>
    ensureNoError(result, `projection-${index + 1}`),
  );
}
