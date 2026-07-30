import { afterEach, describe, expect, it } from "vitest";

import type { AppSession } from "@/server/auth/session";
import {
  requireRequestRoleCapability,
  resolveRequestRole,
} from "@/server/auth/request-role";

const originalSynthetic = process.env.CATALYST_SYNTHETIC_ONLY;

function session(): AppSession {
  return {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "buyer@example.test",
    role: "user",
    tenantIds: ["tenant-a"],
    presenter: false,
    assuranceLevel: "aal2",
    nextAssuranceLevel: "aal2",
    authenticationMethods: ["sso"],
    identityProvider: "entra",
    phishingResistant: true,
    mode: "supabase",
    authorities: {
      "tenant-a": {
        tenantId: "tenant-a",
        policy: {
          internalAccessMode: "saml_required",
          supplierAccessMode: "invite_magic_link",
          provisioningMode: "scim",
          requireAal2ForProtectedActions: true,
          allowSyntheticPresenterAal1: false,
          status: "active",
          version: 1,
        },
        roles: [
          {
            role: "requester",
            assignmentType: "direct",
            departmentIds: ["dept-a"],
            locationIds: ["location-a"],
            categoryIds: [],
            workflowOwnerIds: [],
            startsAt: "2026-01-01T00:00:00.000Z",
            emergencyAccess: false,
          },
          {
            role: "purchasing_manager",
            assignmentType: "direct",
            departmentIds: [],
            locationIds: [],
            categoryIds: [],
            workflowOwnerIds: [],
            startsAt: "2026-01-01T00:00:00.000Z",
            emergencyAccess: false,
          },
        ],
        supplierAccess: [],
      },
    },
  };
}

afterEach(() => {
  if (originalSynthetic === undefined) {
    delete process.env.CATALYST_SYNTHETIC_ONLY;
  } else {
    process.env.CATALYST_SYNTHETIC_ONLY = originalSynthetic;
  }
});

describe("request active-role authority", () => {
  it("requires explicit active-role selection when several roles are assigned", () => {
    expect(() =>
      resolveRequestRole({
        request: new Request("https://example.test/export"),
        session: session(),
        tenantId: "tenant-a",
        presenterRole: "requester",
      }),
    ).toThrow("ACTIVE_ROLE_REQUIRED");
  });

  it("uses the selected assigned role and enforces capability plus assurance", () => {
    const context = resolveRequestRole({
      request: new Request("https://example.test/export", {
        headers: { "x-catalyst-active-role": "purchasing_manager" },
      }),
      session: session(),
      tenantId: "tenant-a",
      presenterRole: "requester",
    });
    expect(context.activeRole).toBe("purchasing_manager");
    expect(() =>
      requireRequestRoleCapability({
        context,
        session: { ...session(), assuranceLevel: "aal1" },
        allowedRoles: ["purchasing_manager"],
        requireAal2: true,
      }),
    ).toThrow("AAL2_REQUIRED");
    expect(() =>
      requireRequestRoleCapability({
        context,
        session: session(),
        allowedRoles: ["auditor"],
        requireAal2: false,
      }),
    ).toThrow("COMMAND_ROLE_DENIED");
  });

  it("accepts the server-validated active-role cookie for download links", () => {
    const context = resolveRequestRole({
      request: new Request("https://example.test/export", {
        headers: {
          cookie: "other=value; catalyst-active-role=purchasing_manager",
        },
      }),
      session: session(),
      tenantId: "tenant-a",
      presenterRole: "requester",
    });
    expect(context.activeRole).toBe("purchasing_manager");
  });

  it("does not treat a presenter flag as authority outside synthetic simulation", () => {
    const presenter = session();
    presenter.presenter = true;
    presenter.authorities["tenant-a"]!.roles = [
      {
        ...presenter.authorities["tenant-a"]!.roles[0]!,
        role: "auditor",
        assignmentType: "presenter_simulation",
      },
    ];
    process.env.CATALYST_SYNTHETIC_ONLY = "0";
    expect(() =>
      resolveRequestRole({
        request: new Request("https://example.test/evidence"),
        session: presenter,
        tenantId: "tenant-a",
        presenterRole: "auditor",
      }),
    ).toThrow("PRESENTER_SIMULATION_DENIED");
  });
});
