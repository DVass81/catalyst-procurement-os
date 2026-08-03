import { describe, expect, it } from "vitest";

import { tenantThemes } from "@/config/organizations";
import { createDemoState } from "@/demo/seed";
import {
  canRoleUsePrivateDocument,
  hasVisibleDocumentParent,
} from "@/server/phase-two/document-authority";

describe("private document authority", () => {
  it("separates mutation roles from read-only audit access", () => {
    expect(canRoleUsePrivateDocument("requester", "request", "upload")).toBe(
      true,
    );
    expect(canRoleUsePrivateDocument("auditor", "request", "read")).toBe(
      true,
    );
    expect(canRoleUsePrivateDocument("auditor", "request", "upload")).toBe(
      false,
    );
    expect(canRoleUsePrivateDocument("supplier_user", "invoice", "read")).toBe(
      false,
    );
    expect(
      canRoleUsePrivateDocument("receiving_clerk", "receipt", "upload"),
    ).toBe(true);
  });

  it("requires the parent record to exist in the server-authorized projection", () => {
    const state = createDemoState(
      tenantThemes["org-y12-demo"],
      "2026-07-29",
    );
    expect(
      hasVisibleDocumentParent(
        state,
        "request",
        state.featuredRequestId,
      ),
    ).toBe(true);
    expect(
      hasVisibleDocumentParent(state, "request", "request-other-tenant"),
    ).toBe(false);
    expect(
      hasVisibleDocumentParent(
        state,
        "sourcing_event",
        state.phaseThree.rfqs[0]!.id,
      ),
    ).toBe(true);
  });
});
