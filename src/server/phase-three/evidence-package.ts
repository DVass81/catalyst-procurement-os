import "server-only";

import { createHash } from "node:crypto";

import type { DemoState } from "@/demo/model";
import type { PhaseThreeEvidencePackage } from "@/phase-three/commands";
import { verifyPhaseThreeIntegrity } from "@/phase-three/integrity";

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildPhaseThreeEvidencePackage(
  tenantId: string,
  state: DemoState,
): PhaseThreeEvidencePackage {
  const phaseThree = state.phaseThree;
  const integrity = verifyPhaseThreeIntegrity(phaseThree);
  const base = {
    packageId: `commercialization-evidence-${phaseThree.dataset.version}`,
    tenantId,
    generatedAt:
      phaseThree.auditEvents.at(-1)?.timestamp ??
      `${state.sessionDate}T08:00:00-04:00`,
    datasetVersion: phaseThree.dataset.version,
    datasetHash: phaseThree.dataset.contentHash,
    capabilityRegistry: phaseThree.capabilityRegistry.map((capability) => ({
      capabilityId: capability.capabilityId,
      name: capability.name,
      status: capability.status,
      limitation: capability.knownLimitations,
      activationRequirements: capability.activationRequirements,
    })),
    selectedEvidence: [
      ...phaseThree.auditEvents.slice(-20).map(
        (event) =>
          `${event.timestamp} · ${event.action} · ${event.recordType}:${event.recordId} · ${event.correlationId}`,
      ),
      ...phaseThree.preflightChecks.map(
        (check) => `${check.name}: ${check.status} · ${check.evidence}`,
      ),
      `Integrity: ${integrity.valid ? "valid" : "invalid"}; ${[
        ...integrity.errors,
        ...integrity.warnings,
      ].join(" ")}`,
    ],
    securityAccessibilityOperationsOverview: [
      ...phaseThree.assuranceControls.map(
        (control) =>
          `${control.domain} · ${control.name} · ${control.status} · ${control.limitation}`,
      ),
      ...phaseThree.operationsSignals.map(
        (signal) =>
          `${signal.domain} · ${signal.status} · ${signal.truthStatus} · ${signal.message}`,
      ),
    ],
    knownLimitations: [
      ...new Set(
        phaseThree.capabilityRegistry.map(
          (capability) => capability.knownLimitations,
        ),
      ),
      ...phaseThree.truthDisclosures,
    ],
    pilotActivationOutline: [
      "Select the design-partner tenant, approved use cases, named owners, and outcome measures.",
      "Complete customer-specific security, privacy, accessibility, retention, recovery, and vendor reviews.",
      "Configure isolated customer environments, approved identity, integration sandboxes, and synthetic-to-customer data transition controls.",
      "Validate roles, Row Level Security, supplier isolation, workflows, reports, fallbacks, rollback, and support responsibilities.",
      "Approve the pilot release manifest only after all Critical and High findings are closed.",
    ],
  };
  return {
    ...base,
    contentHash: sha256(JSON.stringify(base)),
  };
}
