# Audit Phase 3 implementation and traceability map

Status: implementation baseline
Source specification: `docs/PHASE3_COMMERCIALIZATION_DEMO_SPEC.md`
Inherited baseline: Audit Phase 2 at `0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0`
Delivery branch: `codex/phase3-commercialization-demo`

## Architecture decision

Phase 3 extends the existing Next.js and Supabase modular monolith. The existing
tenant-scoped demonstration snapshot remains the aggregate used by the
connected story, while normalized Phase 3 registries and ledgers provide
durable capability, integration, supplier, contract, workflow, assurance,
operations, and release evidence. Protected state transitions remain
server-authoritative and use the existing revision, idempotency, tenant,
correlation, and audit controls.

The historical guided-demo branch is reference material only. Reusable guide,
voice, tour, and presenter behavior already present in the Phase 2 baseline is
adapted in place. Historical deployment configuration is not imported.

## Planned implementation surfaces

| Surface | Responsibility |
| --- | --- |
| `src/phase-three/` | Types, approved synthetic dataset, capability registry, domain rules, persona authority, state transitions, reconciliation, CATE evidence, and integrity checks |
| `src/server/phase-three/` | Server command execution, authorization, evidence-package generation, and persistence coordination |
| `src/app/api/phase-three/` | Authenticated tenant-scoped state, protected command, preflight, and evidence-package interfaces |
| `src/components/commercialization/` | Integration, enterprise access, supplier, contract, workflow/mobile, reporting, assurance, operations, and Golden Thread experiences |
| `src/demo/`, `src/phase-two/`, `src/server/phase-two/` | Phase 2 aggregate extension, deterministic reset, shared revision store, and regression-safe command contract |
| `supabase/migrations/` | Phase 3 tables, indexes, explicit grants, RLS, append-only evidence, and transactional commit support |
| `docs/` | Architecture, traceability, capability registry, runbooks, findings, release evidence, limitations, and pilot activation handoff |

## Public interface contract

- Phase 3 state is returned inside the existing authoritative demo envelope.
- Every protected command includes tenant ID, expected revision, UUID
  idempotency key, typed command payload, server-derived actor, active persona,
  rationale where required, and a correlation ID.
- Capability status is exactly one of `Live`, `Functional Demo`,
  `Simulated Integration`, `Concept Preview`, or `Future Activation`.
- Simulated external actions are disclosed before confirmation and produce
  simulation-specific audit events; they never claim an external action
  occurred.
- CATE outputs include evidence, governing definition or policy, assumptions,
  missing information, confidence, risks, required human action, provider mode,
  truth status, as-of time, evaluation version, and correlation ID.
- Every exposed Phase 3 table has explicit grants and tenant-aware RLS.
  Supplier-facing records additionally enforce supplier organization scope.

## Requirement-to-implementation map

| Requirements | Implementation | Data objects | Verification |
| --- | --- | --- | --- |
| P3-001–P3-007 | Phase terminology, truth statuses, capability registry, persistent disclosures, prohibited-claim review, and simulation audit | Capability registry, truth disclosures, audit events | Registry completeness, source-copy scan, simulation-event tests |
| P3-008–P3-011 | Connected Golden Thread, presenter controls, reset/preflight, and post-demo package | Scene manifest, rehearsal state, evidence package | Clean-reset story test, presenter-boundary test, package redaction test |
| P3-012–P3-017 | Ten-persona model, independent scopes, separation of duties, supplier isolation, presenter switching, and CATE permission filtering | Persona assignments, authority scopes, access decisions | Allowed/denied matrix, cross-tenant and cross-supplier tests, CATE access tests |
| P3-018–P3-022 | Canonical integration model, reference file flow, reliability controls, source ownership, and ERP/accounting simulators | Connections, mappings, batches, records, reconciliation, dead letters | Adapter contract, duplicate, mismatch, stale, retry, replay, and control-total tests |
| P3-023–P3-025 | Entra, Okta, and SAML templates; Catalyst authorization boundary; emergency access demonstration | SSO templates, mappings, test results, emergency-access policy | Simulation-label, claim-tampering, access-review, and emergency-use tests |
| P3-026–P3-029 | Supplier onboarding lifecycle, validation, multi-domain review, remediation, isolation, and banking-change dual control | Supplier applications, documents, reviews, risk findings, banking-change requests | Success, blocked, expiration, unauthorized access, and dual-approval tests |
| P3-030–P3-033 | Contract versioning, hashes, citations, obligations, deadlines, amendment and price/commitment conflicts | Contract versions, citations, extractions, obligations, conflicts | Exact-citation, human-validation, deadline, price, invoice, and commitment tests |
| P3-034–P3-036 | Responsive mobile approval and receiving, rationale, inspection, discrepancies, and truthful scanner/offline simulation | Mobile assignments, approval decisions, receipt evidence, simulation events | Responsive source checks, authority tests, quantity reconciliation, simulation-label tests |
| P3-037–P3-040 | Governed workflow blocks, validation, lifecycle, versioning, simulation, approval, activation, and rollback | Workflow definitions, versions, simulations, instances | Cycle, dead-end, owner, SoD, protected-control, version, and hero-scenario tests |
| P3-041–P3-045 | Governed report library, certified semantic catalog, drillthrough, snapshots, exports, and CATE narrative | Metric definitions, report definitions, snapshots, annotations, exports | Record/report/export reconciliation, access filtering, narrative evidence tests |
| P3-046–P3-049 | CATE identity, human-authority boundary, complete evidence contract, and deterministic fallback | CATE evaluations, evidence references, provider mode, fallback record | Identity scan, prohibited-action tests, prompt-injection tests, provider failure tests |
| P3-050–P3-052 | Security and Trust Center with evidence-backed statuses and governed findings | Controls, validation evidence, security findings | RLS/RBAC/session/API/upload/export/audit checks and findings completeness |
| P3-053–P3-056 | WCAG 2.2 AA internal target, keyboard/screen-reader path, visual/responsive checks, and findings | Accessibility checks and findings | Automated semantics plus recorded manual device/assistive-technology matrix |
| P3-057–P3-060 | Operations Center, alert/incident lifecycle, support cases, observability, and runbooks | Health signals, alerts, incidents, support cases, runbooks | Provider-failure, incident-lifecycle, redaction, and runbook-link tests |
| P3-061–P3-063 | Versioned synthetic dataset, deterministic reset, and expanded audit contract | Dataset versions/hashes, expected totals, audit events | Hash stability, reset equality, event-field completeness, reconciliation tests |
| P3-064 | Cohesive navigation, readable statuses, complete states, and accessible controls | Status catalog and view-state definitions | Dead-control/copy scans, loading/empty/failed/denied/fallback UI checks |
| P3-065–P3-068 | Exact deployment proof, secret protection, critical-route suite, and performance budgets | Deployment and performance evidence | Build/CI, secret scan, deployed smoke, p50/p95 report and rollback test |
| P3-069–P3-072 | Three rehearsals, severity gate, release manifest, and release freeze | Rehearsal records, findings register, release manifest, freeze record | Three consecutive deployed passes and sign-off validation |
| P3-073–P3-075 | Scope and pilot boundaries plus complete implementation handoff | Limitations, activation checklist, catalogs and inventories | Prohibited-scope scan, real-data boundary check, artifact inventory |

## Ordered exit gates

1. Foundation is present, truthfully labeled, and Phase 2 regression remains
   green.
2. Integration reference records reconcile and adverse retry/replay cases pass.
3. Supplier success/blocked paths and isolation pass; SSO remains simulated.
4. Every material contract finding reaches exact synthetic evidence.
5. A governed workflow controls a new transaction and mobile routes reconcile.
6. Reports reconcile to source records and CATE separates fact from inference.
7. Trust, accessibility, and operations evidence is complete and traceable.
8. Three deployed Golden Thread rehearsals pass without data repair.
9. All applicable P3 requirements, release gates, evidence, sign-offs, exact
   deployment proof, and rollback verification pass.

## Environment and rollout

- Phase 2 production demonstration remains on `main`.
- Phase 3 staging uses a separate DigitalOcean application and separate
  Supabase project containing synthetic data only.
- Staging tracks `codex/phase3-commercialization-demo`.
- Production promotion uses the exact verified merge commit. The Phase 2
  baseline remains the rollback target until Phase 3 is accepted.
- The Phase 2 demo-only risk acceptance does not automatically approve any
  Phase 3 gap.
