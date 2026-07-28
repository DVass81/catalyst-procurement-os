# Audit Phase 2 requirement-to-file and test map

Status legend:

- **Implemented**: source and automated application verification exist.
- **Release verification**: implementation exists; connected-environment
  evidence is still required.
- **Deferred**: explicitly outside Phase 2.

| ID | Status | Implementation | Verification |
| --- | --- | --- | --- |
| P2-001 | Implemented | Persistent disclosures in workspace, login, AI, upload, and footer surfaces | Phase 1 credibility tests; UI source scan |
| P2-002 | Implemented | `reset_demo` is an authoritative command using the frozen session date and approved seed | Workflow reset tests |
| P2-003 | Release verification | Server state route, repository, private commit function, Postgres snapshot | TypeScript tests pass; migration application pending |
| P2-004 | Release verification | RLS on all public Phase 2 tables and private Storage; DB assignments used in policies | Direct target-database positive/negative tests pending |
| P2-005 | Implemented / release verification | Database tenant membership, server presenter boundary, domain-role command rules | Role-denial tests; target RLS tests pending |
| P2-006 | Implemented | Requester self-approval, buyer receipt, receiver invoice match, and same-actor revision blocks | Workflow and Audit Phase 2 tests |
| P2-007 | Implemented | Draft, validation, simulation, review, approval, activation, supersession | Audit Phase 2 configuration test |
| P2-008 | Implemented / release verification | CSV/XLSX staging, mapping, quarantine, duplicate flag, hash, row/value controls, split duties, post/reversal | Pure workflow tests; connected import integration pending |
| P2-009 | Implemented / release verification | Private bucket, content checks, version metadata, simulated scan label, signed access, access audit | Route compile; connected Storage isolation pending |
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
| P2-022 | Implemented / release verification | Controlled route creates and privately stores a readable PDF summary, CSV event extract, and JSON manifest with source/artifact hashes and signed downloads | Workflow/hash tests and route compile; connected Storage generation/download test pending |
| P2-023 | Implemented | Integer cents, quantity bounds, cumulative acceptance, zero tolerance, immutable corrections | Integrity and boundary tests |
| P2-024 | Implemented | Authoritative, temporary, read-only, working, failed, denied, and empty states | Provider and route source; browser evidence pending |
| P2-025 | Release verification | Semantic headings/tables, labels, status regions, keyboard controls, focus styles | Automated/browser WCAG evidence pending |
| P2-026 | Release verification | RLS, explicit grants, server-only secrets, rate limits, CSP, validation, CI audit/SBOM | Target scans and exception review pending |
| P2-027 | Release verification | Idempotency, retry/dead letter, degraded state, runbook | Backup/restore and rollback exercises pending |
| P2-028 | Release verification | Indexed schema and capacity-conscious chunking | Synthetic load test pending |
| P2-029 | Release verification | Primary story and presenter stage commands remain implemented | Post-deployment 12–15 minute run pending |
| P2-030 | Implemented | Streamlit remains a deterministic, labeled fallback without backend duplication | Existing Python tests |
| P2-031 | Implemented | Deferred integrations and payment are absent or explicitly labeled | Scope register |
| P2-032 | Implemented | Architecture, implementation map, runbook, status, KPI and security documentation | Document inventory |

## Migration inventory

1. `202607250001_phase4_live_concierge.sql` — authentication-era tenant
   configuration and private provider ledgers.
2. `202607270001_audit_phase2_foundation.sql` — authoritative Phase 2 state,
   roles/scopes, control domains, RLS/grants, private Storage, immutable events,
   and transactional command commit.

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
