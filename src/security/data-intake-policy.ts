import type { CatalystEnvironmentKind } from "@/config/runtime-environment";
import type { AssuranceLevel } from "@/server/auth/authority";

export const dataIntakeClassifications = [
  "synthetic_demo",
  "approved_pilot_procurement",
] as const;

export type DataIntakeClassification =
  (typeof dataIntakeClassifications)[number];

export interface DataIntakeDecision {
  classification: DataIntakeClassification;
  approvalReference?: string;
  attestationType:
    | "synthetic_demonstration_data"
    | "approved_pilot_procurement_without_prohibited_data";
}

const approvalReferencePattern =
  /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/;

function approvedPilotReference(input: {
  approvalReference?: string;
  prohibitedDataAttestation: boolean;
}) {
  const approvalReference = input.approvalReference?.trim();
  if (
    !approvalReference ||
    !approvalReferencePattern.test(approvalReference)
  ) {
    throw new Error("PILOT_DATA_APPROVAL_REFERENCE_REQUIRED");
  }
  if (!input.prohibitedDataAttestation) {
    throw new Error("PILOT_DATA_PROHIBITED_DATA_ATTESTATION_REQUIRED");
  }
  return approvalReference;
}

export function authorizeDataIntake(input: {
  environmentKind: CatalystEnvironmentKind;
  environmentReady: boolean;
  syntheticOnly: boolean;
  classification: DataIntakeClassification;
  syntheticDataAttestation: boolean;
  prohibitedDataAttestation: boolean;
  pilotDataApprovalReference?: string;
  assuranceLevel: AssuranceLevel;
  simulation: boolean;
}): DataIntakeDecision {
  if (!input.environmentReady) {
    throw new Error("DATA_INTAKE_ENVIRONMENT_NOT_READY");
  }

  if (input.classification === "synthetic_demo") {
    if (
      input.environmentKind === "secure_pilot" ||
      !input.syntheticOnly
    ) {
      throw new Error("SYNTHETIC_DATA_ENVIRONMENT_MISMATCH");
    }
    if (!input.syntheticDataAttestation) {
      throw new Error("SYNTHETIC_DATA_ATTESTATION_REQUIRED");
    }
    return {
      classification: "synthetic_demo",
      attestationType: "synthetic_demonstration_data",
    };
  }

  if (
    input.environmentKind !== "secure_pilot" ||
    input.syntheticOnly
  ) {
    throw new Error("PILOT_DATA_ENVIRONMENT_MISMATCH");
  }
  if (input.simulation) {
    throw new Error("PILOT_DATA_SIMULATION_PROHIBITED");
  }
  if (input.assuranceLevel !== "aal2") {
    throw new Error("PILOT_DATA_AAL2_REQUIRED");
  }
  const approvalReference = approvedPilotReference({
    approvalReference: input.pilotDataApprovalReference,
    prohibitedDataAttestation: input.prohibitedDataAttestation,
  });
  return {
    classification: "approved_pilot_procurement",
    approvalReference,
    attestationType:
      "approved_pilot_procurement_without_prohibited_data",
  };
}

export function authorizeMachineDataIntake(input: {
  environmentKind: CatalystEnvironmentKind;
  environmentReady: boolean;
  syntheticOnly: boolean;
  classification: DataIntakeClassification;
  synthetic: boolean;
  prohibitedDataAttestation: boolean;
  pilotDataApprovalReference?: string;
}) {
  if (!input.environmentReady) {
    throw new Error("DATA_INTAKE_ENVIRONMENT_NOT_READY");
  }
  if (input.classification === "synthetic_demo") {
    if (
      !input.synthetic ||
      !input.syntheticOnly ||
      input.environmentKind === "secure_pilot"
    ) {
      throw new Error("SYNTHETIC_DATA_ENVIRONMENT_MISMATCH");
    }
    return {
      classification: input.classification,
      approvalReference: undefined,
    };
  }
  if (
    input.synthetic ||
    input.syntheticOnly ||
    input.environmentKind !== "secure_pilot"
  ) {
    throw new Error("PILOT_DATA_ENVIRONMENT_MISMATCH");
  }
  return {
    classification: input.classification,
    approvalReference: approvedPilotReference({
      approvalReference: input.pilotDataApprovalReference,
      prohibitedDataAttestation: input.prohibitedDataAttestation,
    }),
  };
}
