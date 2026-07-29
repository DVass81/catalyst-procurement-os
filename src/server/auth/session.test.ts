import { describe, expect, it } from "vitest";

import {
  auditActorRole,
  deriveSessionAuthority,
  type AppSession,
} from "@/server/auth/session";

describe("Phase 3 session authority", () => {
  it("requires protected metadata and an authoritative presenter assignment", () => {
    expect(
      deriveSessionAuthority(
        { presenter: true },
        [{ tenant_id: "org-y12-demo", role: "presenter" }],
      ),
    ).toEqual({ role: "presenter", presenter: true });

    expect(
      deriveSessionAuthority(
        { presenter: true },
        [{ tenant_id: "org-y12-demo", role: "viewer" }],
      ),
    ).toEqual({ role: "viewer", presenter: false });

    expect(
      deriveSessionAuthority(
        {},
        [{ tenant_id: "org-y12-demo", role: "presenter" }],
      ),
    ).toEqual({ role: "presenter", presenter: false });
  });

  it("recognizes an administrator only when metadata and assignment agree", () => {
    expect(
      deriveSessionAuthority(
        { role: "administrator" },
        [{ tenant_id: "org-y12-demo", role: "administrator" }],
      ),
    ).toEqual({ role: "administrator", presenter: true });
  });
});

describe("audit actor role", () => {
  const session = {
    role: "presenter",
  } as AppSession;

  it("records the dedicated staging bypass actor label", () => {
    expect(
      auditActorRole({ ...session, mode: "staging_bypass" }),
    ).toBe("staging_bypass_presenter");
  });

  it("retains the authoritative role for normal sessions", () => {
    expect(auditActorRole({ ...session, mode: "supabase" })).toBe(
      "presenter",
    );
  });
});
