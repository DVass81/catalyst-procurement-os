# Catalyst 87+ Regression Recovery Plan

Baseline: August 2, 2026 regression audit, 80/100.  Target: at least 87/100 on the same evidence contract before expanding the qualification rubric.

## Phase 1 — Role transaction and bootstrap recovery

- Guarantee JSON responses and correlation identifiers across the role-command boundary.
- Validate response content type before parsing and preserve stable UI state after failures.
- Prove all 16 presenter role transitions, persistence revisions, and command-ledger evidence.
- Hold the workspace behind a neutral resolver until session, tenant, role, permissions, and authoritative state are ready.

Exit: Requester, Purchasing Manager, Receiving Clerk, Supplier User, Accounts Payable, and Finance Reviewer transitions pass in the deployed environment without HTML responses, stale identity, or pre-resolution tenant data.

## Phase 2 — Natural requisition-to-close lifecycle

- Complete and verify request creation, editing, save/reload, submission, return for changes, resubmission, withdrawal, and cloning.
- Complete approvals, PO creation/issue/acknowledgment, partial and final receiving, invoice matching, exception resolution, payment-readiness export, close, and authorized reopen.
- Add explicit disabled-action explanations and record-level audit timelines.

Exit: the full lifecycle completes without presenter stage jumps, with reconciled amounts, revisions, authorization denials, reload persistence, and evidence.

## Phase 3 — Functional Test Mode and authenticated boundaries

- Isolate Development Preview, Sales Demo, and Functional Test configurations.
- Remove public bypass, presenter jumps, synthetic role switching, and artificial completion from Functional Test Mode.
- Use pre-invited authenticated users with fixed server-derived tenant and role assignments.

Exit: functional testing is authenticated, role-fixed, persistent, and production-equivalent while the synthetic sales demo remains separately interactive.

## Phase 4 — Functional RFQ minimum lifecycle

- Implement RFQ creation, line items, specifications, deadlines, publication, supplier invitation, questions, sealed responses, evaluation, approval, award, notification, PO conversion, and audit history.
- Enforce tenant and supplier isolation and keep CATE advisory only.

Exit: one complete buyer/supplier RFQ scenario and its negative access tests pass against authoritative records.

## Phase 5 — 87+ deployed qualification

- Run regression, role/persona, accessibility, security, performance, and natural-workflow tests against one exact deployed commit.
- Record URL, commit, deployment, migrations, dataset, environment fingerprint, timestamps, and evidence.
- Re-audit against the unchanged August 2 scoring method.

Exit: at least 87/100, no unresolved Critical or High defect in the tested scope, and exact GitHub, Supabase, DigitalOcean, and health-manifest agreement.

## Score forecast

- Phase 1: 82–84 by recovering the regression and unblocking role-based verification.
- Phases 1–2: 85–88 through proven requisition, approval, PO, receiving, and invoice behavior.
- Phases 1–3: 87–90 through credible authenticated functional testing and environment separation.
- Phase 4 provides margin above 87 and is required for the longer-term 95+ objective.

The forecast is directional. Only a deployed regression audit may assign the score.
