import { describe, expect, it } from "vitest";

import {
  authorizeDataIntake,
  authorizeMachineDataIntake,
} from "@/security/data-intake-policy";

const syntheticInput = {
  environmentKind: "sales_demo" as const,
  environmentReady: true,
  syntheticOnly: true,
  classification: "synthetic_demo" as const,
  syntheticDataAttestation: true,
  prohibitedDataAttestation: false,
  assuranceLevel: "aal1" as const,
  simulation: true,
};

describe("data intake isolation policy", () => {
  it("allows attested synthetic data only in a ready synthetic environment", () => {
    expect(authorizeDataIntake(syntheticInput)).toEqual({
      classification: "synthetic_demo",
      attestationType: "synthetic_demonstration_data",
    });
    expect(() =>
      authorizeDataIntake({
        ...syntheticInput,
        environmentReady: false,
      }),
    ).toThrow("DATA_INTAKE_ENVIRONMENT_NOT_READY");
    expect(() =>
      authorizeDataIntake({
        ...syntheticInput,
        environmentKind: "secure_pilot",
        syntheticOnly: false,
      }),
    ).toThrow("SYNTHETIC_DATA_ENVIRONMENT_MISMATCH");
  });

  it("allows approved pilot procurement data only with AAL2 and retained approval", () => {
    expect(
      authorizeDataIntake({
        environmentKind: "secure_pilot",
        environmentReady: true,
        syntheticOnly: false,
        classification: "approved_pilot_procurement",
        syntheticDataAttestation: false,
        prohibitedDataAttestation: true,
        pilotDataApprovalReference: "PILOT-APPROVAL-2026-001",
        assuranceLevel: "aal2",
        simulation: false,
      }),
    ).toEqual({
      classification: "approved_pilot_procurement",
      approvalReference: "PILOT-APPROVAL-2026-001",
      attestationType:
        "approved_pilot_procurement_without_prohibited_data",
    });
  });

  it("rejects pilot data in demos, presenter simulation, AAL1, or without attestations", () => {
    const pilotInput = {
      environmentKind: "secure_pilot" as const,
      environmentReady: true,
      syntheticOnly: false,
      classification: "approved_pilot_procurement" as const,
      syntheticDataAttestation: false,
      prohibitedDataAttestation: true,
      pilotDataApprovalReference: "PILOT-APPROVAL-2026-001",
      assuranceLevel: "aal2" as const,
      simulation: false,
    };
    expect(() =>
      authorizeDataIntake({
        ...pilotInput,
        environmentKind: "sales_demo",
        syntheticOnly: true,
      }),
    ).toThrow("PILOT_DATA_ENVIRONMENT_MISMATCH");
    expect(() =>
      authorizeDataIntake({ ...pilotInput, simulation: true }),
    ).toThrow("PILOT_DATA_SIMULATION_PROHIBITED");
    expect(() =>
      authorizeDataIntake({ ...pilotInput, assuranceLevel: "aal1" }),
    ).toThrow("PILOT_DATA_AAL2_REQUIRED");
    expect(() =>
      authorizeDataIntake({
        ...pilotInput,
        prohibitedDataAttestation: false,
      }),
    ).toThrow("PILOT_DATA_PROHIBITED_DATA_ATTESTATION_REQUIRED");
  });

  it("binds machine integration data to the same environment classification", () => {
    expect(
      authorizeMachineDataIntake({
        environmentKind: "secure_pilot",
        environmentReady: true,
        syntheticOnly: false,
        classification: "approved_pilot_procurement",
        synthetic: false,
        prohibitedDataAttestation: true,
        pilotDataApprovalReference: "PILOT-INTEGRATION-2026-001",
      }),
    ).toEqual({
      classification: "approved_pilot_procurement",
      approvalReference: "PILOT-INTEGRATION-2026-001",
    });
    expect(() =>
      authorizeMachineDataIntake({
        environmentKind: "sales_demo",
        environmentReady: true,
        syntheticOnly: true,
        classification: "approved_pilot_procurement",
        synthetic: false,
        prohibitedDataAttestation: true,
        pilotDataApprovalReference: "PILOT-INTEGRATION-2026-001",
      }),
    ).toThrow("PILOT_DATA_ENVIRONMENT_MISMATCH");
  });
});
