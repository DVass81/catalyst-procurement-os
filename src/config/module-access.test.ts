import { describe, expect, it } from "vitest";

import {
  canAccessWorkspacePath,
  canAccessWorkspaceSection,
  workspaceSections,
} from "@/config/module-access";

describe("role-focused module access", () => {
  it("gives administrators the complete module directory", () => {
    expect(
      workspaceSections.every((section) =>
        canAccessWorkspaceSection("system_administrator", section),
      ),
    ).toBe(true);
  });

  it("limits supplier identities to their isolated collaboration surface", () => {
    expect(canAccessWorkspacePath("supplier_user", "/rfqs")).toBe(true);
    expect(
      canAccessWorkspacePath(
        "supplier_user",
        "/supplier-onboarding",
      ),
    ).toBe(true);
    expect(canAccessWorkspacePath("supplier_user", "/invoices")).toBe(
      false,
    );
    expect(
      canAccessWorkspacePath("supplier_user", "/administration"),
    ).toBe(false);
  });

  it("does not expose operational administration to requesters", () => {
    expect(canAccessWorkspaceSection("requester", "purchase-requests")).toBe(
      true,
    );
    expect(canAccessWorkspaceSection("requester", "operations-center")).toBe(
      false,
    );
  });
});
