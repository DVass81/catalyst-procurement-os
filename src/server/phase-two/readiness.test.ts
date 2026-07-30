import { describe, expect, it } from "vitest";

import { combineOperationalReadiness } from "@/server/phase-two/readiness";

const kernel = {
  ready: true,
  snapshot_revision: 12,
  ledger_revision: 12,
  mismatch_reasons: [],
};

const sourcing = {
  ready: true,
  snapshot_revision: 12,
  sourcing_revision: 12,
  mismatch_reasons: [],
};

const audit = {
  ready: true,
  event_count: 12,
  latest_revision: 12,
  first_broken_revision: null,
  mismatch_reasons: [],
};

describe("authoritative operational readiness", () => {
  it("requires transaction, sourcing, and audit-chain agreement", () => {
    expect(
      combineOperationalReadiness({
        kernel,
        sourcing,
        audit,
        checkedAt: "2026-07-29T00:00:00.000Z",
      }),
    ).toEqual({
      ready: true,
      mode: "normalized_kernel",
      checkedAt: "2026-07-29T00:00:00.000Z",
      reasons: [],
      snapshotRevision: 12,
      ledgerRevision: 12,
      auditRevision: 12,
    });
  });

  it("fails closed when the audit chain is unavailable", () => {
    expect(
      combineOperationalReadiness({
        kernel,
        sourcing,
        audit: null,
      }),
    ).toMatchObject({
      ready: false,
      mode: "blocked",
      reasons: ["audit_chain_not_initialized"],
    });
  });

  it("fails closed when audit history lags the snapshot", () => {
    expect(
      combineOperationalReadiness({
        kernel,
        sourcing,
        audit: { ...audit, latest_revision: 11 },
      }),
    ).toMatchObject({
      ready: false,
      mode: "blocked",
      reasons: ["audit_snapshot_revision_mismatch"],
      auditRevision: 11,
    });
  });

  it("preserves database integrity reasons without duplicates", () => {
    expect(
      combineOperationalReadiness({
        kernel: {
          ...kernel,
          ready: false,
          mismatch_reasons: ["request_count_mismatch"],
        },
        sourcing: {
          ...sourcing,
          ready: false,
          mismatch_reasons: ["request_count_mismatch"],
        },
        audit: {
          ...audit,
          ready: false,
          mismatch_reasons: ["audit_event_hash_mismatch"],
        },
      }),
    ).toMatchObject({
      ready: false,
      reasons: [
        "request_count_mismatch",
        "audit_event_hash_mismatch",
      ],
    });
  });
});
