# Catalyst pilot-readiness fixed baseline

Baseline date: 2026-07-29
Baseline audit score: **62/100**
Baseline decision: No-go for production; conditional controlled-pilot candidate

## Source identity

| Item | Baseline |
| --- | --- |
| Published recovery branch | `codex/mission-back-on-track` |
| Published recovery commit | `2adaec0355f78789424b1a6a5a240df89d15ebbf` |
| Local pilot program branch | `codex/pilot-readiness-95` |
| Phase 3 DigitalOcean app | `ad312d8b-5da8-437c-829a-7f8d5aeed99b` |
| Phase 3 deployed URL | `https://catalyst-phase3-staging-aj3de.ondigitalocean.app` |
| Last verified Phase 3 deployment | `fcc98d02-5932-4a64-a676-afd50f98860a` |
| Phase 3 Supabase project | `vqbugilydhhaszarbgto` |
| Phase 2 rollback commit | `0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0` |
| Phase 2 URL | `https://catalyst-procurement-os-demo-6jouh.ondigitalocean.app` |

The local recovery commit and published recovery commit have different commit
IDs but the same Git source-tree hash. The pilot program branch starts from the
exact published commit.

## Audit-evidence limitation

The 62/100 audit identifies a staging demonstration workspace but does not
record its tested URL, commit, deployment, migration ledger, dataset hash, or
test-session identifier. It is therefore the official requirements baseline
but not proof that every finding exists in the current published recovery
commit.

Phase 1 must re-run the cited behaviors against the exact current deployment.
Until that re-test is recorded, findings may be marked only:

- `confirmed`;
- `corrected-but-unverified`;
- `not-applicable-by-frozen-rubric`; or
- `open`.

## Exact-deployment re-test

Re-test timestamp: `2026-07-29T19:41:15Z`
Tested URL: `https://catalyst-phase3-staging-aj3de.ondigitalocean.app`
Tested commit: `2adaec0355f78789424b1a6a5a240df89d15ebbf`
Release channel: `development-preview`
Data classification: `synthetic-only`

Observed evidence:

- `/api/health` reported the exact published commit, active time-limited
  staging bypass, authoritative Supabase workflow, and deterministic CATE
  fallback.
- Both tenant transaction kernels and sourcing projections passed database
  reconciliation. Y-12 was at revision 10; Catalyst Community was at revision
  27 before the re-test commands.
- The workflow-event hash chain independently recomputed successfully for all
  10 Y-12 events and all 30 Catalyst Community events after the re-test.
- The browser loaded authoritative state and exposed nine semantic presenter
  buttons. Mouse activation moved the Community workflow to Request and
  keyboard Enter moved it to Inventory; both commands persisted without
  runtime errors.
- A requester-role posted-spend question was correctly refused. After an
  explicit governed switch to Purchasing Manager, CATE returned
  `$342,675.00`, 29 records, the formula, filters, as-of date, citations,
  confidence rationale, and the human-decision boundary.
- The dedicated RFQ workspace was present in primary navigation.
- The command ledger contained 10 Y-12 and 31 Catalyst Community command
  records after the presenter navigation checks. One completed audit package
  existed for Catalyst Community.
- A separate deployed Golden Thread run at `2026-07-29T19:56:23Z` executed 28
  consecutive authoritative commands from reset through request analysis,
  inventory, standards, vendor, budget, four role-separated approvals, PO
  creation and issuance, supplier acknowledgement, receiving, three-way
  matching, exception routing, Finance disposition, and Accounts Payable
  payment-readiness export. Revisions advanced exactly from 30 to 58, the
  final reload retained the result, and no payment was executed.
- After that run, all 58 Catalyst Community workflow-event links and hashes
  recomputed successfully and the latest audit revision equaled the snapshot
  revision.

This evidence updates individual dispositions; it does not replace the
100-scenario, target-matrix, sustained-reliability, or independent-review exit
gates.

## Current source-candidate reconciliation

The Supabase project migration ledger was re-read on 2026-07-29. Its latest
applied migration is
`20260729171156_phase3_second_tenant_bootstrap_order`. The seventeen
`20260729200000` through `20260729240000` pilot-readiness migrations exist only
in the local source candidate. They have not been applied to staging, a
qualification branch, sales, or pilot.

Current source adds normalized operational request, parallel/sequential
approval, PO, receipt, invoice, credit, exception, payment-readiness export,
and closure paths. It also adds environment-enforced intake classification:
synthetic data is accepted only in preview/sales, while approved pilot
procurement data requires a ready secure-pilot environment, AAL2, an approval
reference, prohibited-data attestation, and live malware/DLP clearance.
Direct authenticated Data API privileges are revoked from operational,
sourcing, report, evidence, and AI-evaluation tables so all access must pass
the server-derived active-role and supplier-scope interfaces.
The sourcing candidate also includes authoring, controlled draft editing,
amendments with superseded-response lineage, supplier questions and
equal-access addenda, withdrawal and decline, independent conflict
disposition, negotiation evidence, and award/non-award/cancellation notices
in both the application state and normalized server-only records.
The secure-pilot banking path now fails closed outside a fully ready pilot,
requires an assigned AAL2 supplier identity and an explicit banking scope,
KMS-encrypts before persistence, records only last-four metadata in workflow
state, and atomically commits proposal, out-of-band verification, independent
approval or rejection, and append-only private custody evidence. The
synthetic demonstration retains a separate masked simulation and cannot
enter the pilot custody path.
The identity candidate now derives authentication methods and
phishing-resistant status only from verified server-side claims and AAL,
requires that stronger assurance for privileged pilot actions, and records
unassigned federated identities as governed JIT requests without granting a
tenant or role. A separate phishing-resistant system administrator must
approve the least-privilege mapped role, and self-approval is denied. Domain
mappings, live Entra/SAML claims, JIT approval, SCIM deactivation, and
revocation still require isolated-deployment qualification.
The operations candidate includes an authenticated external-probe endpoint,
append-only probe evidence, per-tenant authoritative readiness, exact-artifact
checks, and a fixed-interval 30-day availability evaluator that counts missing
samples as downtime. It does not manufacture the required elapsed window:
external monitoring, alert delivery, recovery drills, and independent
recovery review remain open.
Authenticated command rejections now fail closed into a separate append-only
ledger containing the fixed actor, active role when authorized, command and
correlation identifiers, expected and observed revisions, rationale, reason
code, request fingerprint, replay status, and rejection timestamp. Rejection
evidence never mutates the procurement snapshot; if its audit record cannot be
preserved, controlled actions return unavailable.
These are `corrected-but-unverified` source changes until the migration set is
validated on an isolated database branch and the fixed deployed scenarios and
independent reviews pass.

## Baseline findings

| ID | Finding | Severity | Initial disposition |
| --- | --- | --- | --- |
| P95-001 | Authoritative transaction state was unavailable | Critical | Corrected and verified on exact deployment; 30-day gate remains |
| P95-002 | End-to-end procure-to-pay could not complete | Critical | One deployed Guided Story path passed; complete Free Play source lifecycle added but all remaining deployed scenarios are open |
| P95-003 | CATE answered posted-spend intent incorrectly | High | Corrected and verified for allowed and denied roles |
| P95-004 | Repeated React hydration error 418 | High | No errors in sampled Dashboard/AI routes; target matrix open |
| P95-005 | Complete RFQ lifecycle absent or undiscoverable | High | Discoverability verified; full buyer/supplier lifecycle open |
| P95-006 | Audit Center showed no operational evidence | High | Ledger and package evidence verified; external retention open |
| P95-007 | Mutations were offered before readiness | High | Source readiness gate exists; outage re-test required |
| P95-008 | Multi-user role enforcement unproven | Medium | Open |
| P95-009 | Tenant and supplier isolation unproven | Medium | Corrected-but-unverified server-authorized Data API boundary and projection probes exist; full deployed attack proof open |
| P95-010 | Supplier-authenticated self-service unproven | Medium | Open |
| P95-011 | SSO, provisioning, deprovisioning, and MFA unproven | Medium | Open |
| P95-012 | Reporting schedules, delivery, and retention incomplete | Medium | Open |
| P95-013 | Enterprise table and bulk controls incomplete | Medium | Open |
| P95-014 | Approval delegation and escalation incomplete | Medium | Open |
| P95-015 | PO change management incomplete | Medium | Corrected-but-unverified in source; deployed multi-role and migration proof open |
| P95-016 | Receiving and invoice exception depth incomplete | Medium | Corrected-but-unverified in source, including service, serial/lot, damage, return, tolerance, duplicate, correction, and credit paths; deployed proof open |
| P95-017 | Integration and reconciliation unproven | Medium | Reference framework exists; deployed proof open |
| P95-018 | Monitoring, recovery, RPO, and RTO unproven | Medium | Open |
| P95-019 | Accessibility, security, and performance qualification incomplete | Medium | Open |
| P95-020 | Terminology, capitalization, mobile overflow, and navigation density issues | Low | Corrected-but-unverified source changes include role-focused navigation, standardized visible labels, and a discoverable mobile workflow scroller; target-device review remains open |

## Baseline rule

No source implementation, automated test, or internal review upgrades the
release status by itself. A finding closes only when its fixed deployed
scenario, evidence, and independent disposition pass.
