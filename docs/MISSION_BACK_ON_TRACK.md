# Catalyst Procurement OS — Mission Back on Track

Status: Active implementation program
Program baseline date: 2026-07-29
Official baseline audit score: **62/100**
Recovery branch: `codex/mission-back-on-track`
Authoritative Phase 3 comparison commit: `a0608d11a884aefd55841dd3f5d29011df8b7ff1`
Source-tree hash: `ac2cdb79f620f3c04e828a2a4dd4662c3c1696e1`
Phase 2 rollback commit: `0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0`

## Objective

Convert the current synthetic prospect demonstration into a release-qualified,
credit-union-first pilot candidate without weakening the truthful demonstration
boundary. The program targets an independently verified pilot score of at least
95, with no unresolved Critical, High, or Medium findings.

The 78/100 result is retained as historical context only. The 62/100 audit is
the official recovery baseline because it was based on direct inspection of the
deployed application and its failed authoritative workflow.

## Locked architecture decisions

- Supabase is the authoritative transaction and identity service.
- Browser state, URL parameters, and presenter controls are never authority.
- The normalized procurement record and append-only command/audit ledgers are
  authoritative. The existing JSON snapshot is retained temporarily as a
  compatibility view during shadow migration.
- Every protected mutation is tenant-scoped, authenticated, authorized,
  revision-checked, idempotent, correlated, and audited.
- Idempotency records are retained for the lifetime of their underlying
  procurement records.
- Controlled commands fail closed before a user can act when authoritative
  services are unavailable.
- The product remains synthetic until a separately approved pilot activation.
- CATE is advisory. It cannot approve, award, receive, waive, change banking
  information, execute payment, or make final legal/compliance decisions.
- The legacy source is intentionally unknown. Migration is source-agnostic and
  accepts governed CSV/XLSX mapping profiles rather than hard-coded vendor
  logic.
- When no ERP exists, Catalyst can operate as the procurement system of record
  and provide controlled procurement CSV/JSON plus governed report
  PDF/XLSX/CSV exports. ERP connectivity is an optional adapter, not a
  prerequisite.

## Mission gates

| Mission | Outcome | Entry condition | Exit condition |
|---|---|---|---|
| M0 — Recovery baseline | One auditable branch, environment inventory, requirement map, and release controls | Phase 3 source preserved | Baseline identities reconcile; no secrets; branch and traceability map exist |
| M1 — Transaction kernel | Normalized authoritative records, typed commands, durable idempotency, hash-chained audit, health/readiness blocking | M0 passed | Shadow records reconcile exactly with approved synthetic state and failure modes fail closed |
| M2 — Identity and authority | Pre-provisioned SAML-ready internal access, invite-only supplier access, AAL2, active-role selection, dual control, SoD | M1 passed | Every role/persona allowed and denied action passes across two tenants and suppliers |
| M3 — Procure-to-pay | Complete request, RFQ, award, approval, PO, receipt/service acceptance, invoice, exception, and audit flow | M2 passed | Representative scenarios complete with zero lost, duplicated, or ambiguous commits |
| M4 — CATE accuracy | Intent-aware, evidence-cited, permission-aware advice with calibrated confidence and human review | M3 passed | Evaluation thresholds pass; outages produce no unsupported CATE answer |
| M5 — Runtime and experience | Hydration-safe, accessible, responsive, role-focused enterprise experience | M4 passed | Target browser/device/WCAG checks pass and no dead or misleading controls remain |
| M6 — Data mobility and operations | Flexible legacy migration, controlled exports, API sandbox, monitoring, backup, and recovery | M5 passed | Import reconciliation, recovery objectives, operational evidence, and rollback drills pass |
| M7 — Independent qualification | Fixed-commit security, accessibility, performance, recovery, rehearsal, and owner sign-off | M6 passed | Score target and zero-open-severity gate pass; exact release manifest is signed |

Missions are sequential release gates. Engineering may prepare later mission
assets, but no later mission is release-qualified until its predecessor passes.

## Current engineering qualification

As of 2026-07-29, the recovery branch has a passing local engineering baseline:

- ESLint passes.
- TypeScript type checking passes.
- 16 automated test files and 112 tests pass.
- The Next.js 16.2.12 production build compiles, type-checks, and generates all
  54 application routes, including the controlled standalone export route.
- The production dependency audit reports no known vulnerabilities after
  reconciling npm and pnpm dependency overrides.
- A focused secret scan reports no candidate private keys, OpenAI keys, or
  Supabase secret-key patterns in application, migration, deployment, and
  planning files.
- Local browser validation reports no React hydration mismatch across the
  Dashboard, RFQ, and CATE routes. The presenter rail updates its governed
  current/completed state after interaction. One development-only CSP/eval
  diagnostic remains expected in Next.js development mode and is not emitted
  by the production build.
- The flexible migration surface now exposes all nine canonical import domains,
  source-neutral starter aliases, optional versioned JSON mapping profiles,
  immutable file hashing/quarantine, row validation, duplicate detection, and
  control totals.
- The Integration Center now states and demonstrates that Catalyst can be the
  standalone system of record. Authorized, authoritative sessions can export
  supplier, catalog, budget, request, PO, receipt, invoice, contract, and audit
  datasets as schema-stable CSV or JSON with synthetic markers, row counts,
  content hashes, and correlation identifiers.

This is engineering evidence, not release approval. The branch is not
release-qualified until the fixed commit is deployed and the remaining
authentication, multi-user, accessibility, performance, recovery, rehearsal,
and independent M7 gates pass.

## Flexible legacy migration contract

The migration framework must support an unknown source without modifying the
transaction core:

1. Accept only allowlisted CSV and XLSX files within configured size, row, and
   expansion limits.
2. Quarantine the original immutable file in tenant-scoped private storage and
   record its SHA-256 hash.
3. Normalize headers without assuming a source vendor.
4. Apply a versioned mapping profile from source columns to canonical entities
   and fields.
5. Support explicit transforms such as trim, case normalization, date parsing,
   decimal-to-cents conversion, code lookup, defaulting, and controlled
   concatenation. Arbitrary code, SQL, macros, and formulas are prohibited.
6. Validate required fields, types, lengths, enumerations, relationships,
   control totals, duplicate keys, and prohibited sensitive-data headers.
7. Preserve every source row, normalized row, warning, rejection, duplicate
   disposition, and identifier crosswalk.
8. Require an independent approval before posting.
9. Post through the same authoritative command boundary used by application
   actions; direct browser writes are prohibited.
10. Produce accepted-row, rejected-row, reconciliation, crosswalk, and audit
    exports and support a governed reversal without deleting lineage.

The first real customer export will create a new mapping-profile version. It
will not cause a source-specific fork of Catalyst.

## Release policy

- `main` remains unchanged until M7 approval.
- Phase 2 remains the immutable emergency rollback and is not the public
  demonstration after promotion.
- Each mission produces a fixed-commit evidence bundle.
- No demo-only risk acceptance carries into the pilot automatically.
- No real customer, member, supplier, banking, tax, identity-provider,
  contract, ERP, accounting, or payment data is permitted before pilot
  activation approval.
- NCUA language is limited to “NCUA-aligned controls” until an independent
  compliance determination is completed for a defined customer deployment.

## M0 baseline evidence

- The local closeout commit
  `e1bec9e1af26b050f82ae02a2ac40440df0e5b81` and deployed comparison commit
  `a0608d11a884aefd55841dd3f5d29011df8b7ff1` have the exact same source-tree
  hash.
- `main` remains at the verified Phase 2 merge commit.
- The existing untracked `.codex-spreadsheet/` and `outputs/` directories were
  preserved and excluded from the recovery baseline.
- Historical public-testing commits remain in Git history for evidence but are
  not the target operating mode. Authentication must fail closed in deployed
  qualification environments.
