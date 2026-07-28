# Audit Phase 2 requirement-to-file and test map

Status legend:

- **Implemented**: source and automated application verification exist.
- **Verified**: implementation and connected-environment evidence exist.
- **Partial**: implementation exists, but the strict gate still needs stronger
  evidence or explicit demo-only risk acceptance.
- **Deferred**: explicitly outside Phase 2.

| ID | Status | Implementation | Verification |
| --- | --- | --- | --- |
| P2-001 | Implemented | Persistent disclosures in workspace, login, AI, upload, and footer surfaces | Phase 1 credibility tests; UI source scan |
| P2-002 | Implemented | `reset_demo` is an authoritative command using the frozen session date and approved seed | Workflow reset tests |
| P2-003 | Verified | Server state route, repository, private commit function, Postgres snapshot | TypeScript tests, applied migrations, and connected snapshot |
| P2-004 | Verified | RLS on all public Phase 2 tables and private Storage; DB assignments used in policies | Direct same-tenant and cross-tenant database and Storage tests |
| P2-005 | Verified | Database tenant membership, server presenter boundary, domain-role command rules | Role-denial tests and connected RLS tests |
| P2-006 | Implemented | Requester self-approval, buyer receipt, receiver invoice match, and same-actor revision blocks | Workflow and Audit Phase 2 tests |
| P2-007 | Implemented | Draft, validation, simulation, review, approval, activation, supersession | Audit Phase 2 configuration test |
| P2-008 | Verified | CSV/XLSX staging, mapping, quarantine, duplicate flag, hash, row/value controls, split duties, post/reversal | Workflow tests plus connected CSV/XLSX staging, approval, posting, and reversal |
| P2-009 | Verified | Private bucket, content checks, version metadata, simulated scan label, signed access, access audit | Connected Storage isolation, private upload, signed view/download, and access-event checks |
| P2-010 | Implemented | Request through human selection, approvals, PO, acknowledgment, and revision | Workflow and revision tests |
| P2-011 | Implemented | Complete or cumulative partial receipt, inspection, reject/return/replacement, reversal | Cumulative receiving test |
| P2-012 | Implemented | Cumulative accepted-quantity three-way match, zero tolerance, duplicate-risk field, typed exception | Workflow and integrity tests |
| P2-013 | Implemented | Payment hold, readiness, and exported handoff states; no paid state or payment tool | Workflow tests and prohibited AI tool list |
| P2-014 | Implemented | Work queues, dedupe keys, retry/dead letter, acknowledgment, simulated email label | Integrity and workflow paths |
| P2-015 | Implemented | Active source/UI/prompts/tours use CATE | Case-insensitive source scan |
| P2-016 | Implemented | Citations, policy/version, assumptions, gaps, confidence reason, risk/alternatives, next action | CATE contract test |
| P2-017 | Implemented | Prohibited action list and human-boundary commands | AI and workflow tests |
| P2-018 | Implemented | Deterministic provider and visible fallback badge | AI tests |
| P2-019 | Implemented | 32 versioned KPI definitions with full contracts | KPI catalog test |
| P2-020 | Implemented | Role scorecards and contributing-record accessible table | Component and catalog source |
| P2-021 | Implemented | KPIs calculate from the same state and dashboard projection | KPI reconciliation test |
| P2-022 | Verified | Controlled route creates and privately stores a readable PDF summary, CSV event extract, and JSON manifest with source/artifact hashes and signed downloads | Two connected versioned packages; six private artifacts opened and hashes recorded |
| P2-023 | Implemented | Integer cents, quantity bounds, cumulative acceptance, zero tolerance, immutable corrections | Integrity and boundary tests |
| P2-024 | Verified | Authoritative, temporary, read-only, working, failed, denied, and empty states | Provider and route tests plus connected browser evidence |
| P2-025 | Partial | Semantic headings/tables, labels, status regions, keyboard controls, focus styles | Desktop semantic and keyboard checks pass; physical device and actual screen-reader runs remain open |
| P2-026 | Verified with documented limitation | RLS, explicit grants, server-only secrets, rate limits, CSP, validation, CI audit/SBOM | Target controls, headers, CI, and advisor review pass; Free-plan leaked-password protection remains unavailable |
| P2-027 | Partial | Idempotency, retry/dead letter, degraded state, runbook | DigitalOcean rollback passed; database restore is blocked by the current Free plan |
| P2-028 | Partial | Indexed schema and capacity-conscious chunking | Normal 25-user concurrency passes; complete high-cardinality materialization remains open |
| P2-029 | Partial | Primary story and presenter stage commands remain implemented | Both deployed stories pass; witnessed human-paced 12–15 minute rehearsal remains open |
| P2-030 | Implemented | Streamlit remains a deterministic, labeled fallback without backend duplication | Existing Python tests |
| P2-031 | Implemented | Deferred integrations and payment are absent or explicitly labeled | Scope register |
| P2-032 | Verified | Architecture, implementation map, runbook, status, KPI, security, and dated release-evidence documentation | Document inventory and `PHASE2_RELEASE_EVIDENCE_2026-07-28.md` |

## Migration inventory

1. `202607250001_phase4_live_concierge.sql` — authentication-era tenant
   configuration and private provider ledgers.
2. `202607270001_audit_phase2_foundation.sql` — authoritative Phase 2 state,
   roles/scopes, control domains, RLS/grants, private Storage, immutable events,
   and transactional command commit.
3. `20260728183905_phase2_release_hardening.sql` — explicit grants, indexed
   foreign keys, and RLS initialization-plan hardening.
4. `20260728184701_phase2_service_rpc.sql` — service-only wrappers for
   authoritative command and CATE usage persistence.

## Environment inventory

No secret values belong in documentation.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public endpoint | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Auth and RLS reads |
| `SUPABASE_SECRET_KEY` | Server only | Command transaction, private Storage, ledgers |
| `OPENAI_API_KEY` | Server only | Optional live CATE |
| `CATALYST_AI_MODE` | Server | Live/deterministic selection |
| `ACTION_CONFIRMATION_SECRET` | Server only | Signed external draft confirmations |
| `ELEVENLABS_*` | Server only except no public key | Optional CATE Live narration |
| `GOOGLE_*`, `TOKEN_ENCRYPTION_KEY` | Server only | Optional confirmed draft/calendar adapters |
| `DEMO_AUTH_BYPASS` | Server | Development only; must be `0` in production |

## Automated test inventory

- `src/demo/workflow.test.ts`
- `src/demo/phase-one-credibility.test.ts`
- `src/demo/audit-phase-two.test.ts`
- `src/ai/phase-four.test.ts`
- `src/tour/tours.test.ts`
- `src/lib/*test.ts`
- `tests/test_streamlit_workflow.py`
- `tests/test_streamlit_app.py`
