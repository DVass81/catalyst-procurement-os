import { describe, expect, it } from "vitest";

import {
  CATALYST_SCIM_EXTENSION,
  normalizeScimRoles,
  scimUser,
} from "@/server/auth/scim";

describe("SCIM identity contract", () => {
  it("accepts only distinct Catalyst operational roles", () => {
    expect(
      normalizeScimRoles(["requester", "auditor", "requester"]),
    ).toEqual(["auditor", "requester"]);
    expect(() => normalizeScimRoles(["presenter"])).toThrow(
      "SCIM_ROLE_INVALID",
    );
  });

  it("returns a tenant-bound SCIM resource without authority secrets", () => {
    const result = scimUser(
      {
        id: "7fa2844c-f7ec-4a08-b0ce-0658e913a4b7",
        provider_key: "entra",
        external_id: "entra-object-1",
        tenant_id: "tenant-one",
        auth_user_id: "2e9c93f2-b4d8-4ddd-8d9b-5e0bcdd6fbd6",
        email: "pilot@example.test",
        display_name: "Pilot User",
        active: true,
        roles: ["requester"],
        provisioning_version: 3,
        last_provisioned_at: "2026-07-29T16:00:00.000Z",
      },
      "https://pilot.example",
    );
    expect(result[CATALYST_SCIM_EXTENSION]).toEqual({
      tenantId: "tenant-one",
      provisioningVersion: 3,
    });
    expect(result).not.toHaveProperty("auth_user_id");
  });
});
