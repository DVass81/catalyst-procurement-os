# Audit Phase 2 release status

## Current result

Audit Phase 2 is implemented, deployed as a release candidate, and verified in
the connected demonstration environment at commit
`a9147c0d1b70bb0d002677d9b1a6133db9909fda`.

Verified release evidence includes:

- 56 of 56 Vitest tests across 7 files
- 23 of 23 legacy Streamlit Python tests
- strict TypeScript, ESLint, and Next.js 16.2.12 production build
- GitHub Actions `Audit Phase 2 quality` run 44
- four applied Supabase release migrations
- direct same-tenant and cross-tenant RLS checks
- private Storage isolation and signed-link checks
- primary and adverse receiving end-to-end stories
- CSV and XLSX staging, duty separation, posting, and reversal
- private versioned PDF, CSV, and JSON audit packages
- live CATE response, usage-ledger record, and immutable evaluation record
- desktop semantic accessibility and keyboard checks
- normal 25-concurrent-user performance target
- DigitalOcean deployment and controlled application rollback

The dated evidence record is
`docs/PHASE2_RELEASE_EVIDENCE_2026-07-28.md`.

## Implemented

- Server-authoritative, tenant-scoped, revisioned demo commands
- Idempotency and concurrent-change conflicts
- Database-authoritative tenant assignments
- RLS and explicit Data API grants
- Hash-chained immutable workflow events
- Versioned configuration controls
- CSV/XLSX import staging and reconciliation
- Private versioned document storage and access logging
- Request, approval, sourcing, PO, and revision flows
- Partial/damaged receiving, return, replacement, and reversal
- Invoice exception and payment-readiness-only boundary
- Queues, deduplicated outbox, retry/dead-letter, and simulated email labels
- CATE identity, evidence contract, fallback, usage, and evaluation ledger
- 32 certified KPI definitions and role scorecards
- Versioned private PDF/CSV/JSON audit packages with hashes and signed downloads
- CI dependency audit and CycloneDX SBOM

## Open Phase 2 release decisions

Four strict gates require additional evidence or an explicit, named, dated,
expiring demo-only risk acceptance:

1. Supabase database backup restoration is unavailable on the current Free
   plan.
2. The complete high-cardinality capacity envelope has not been materialized.
3. Physical mobile/tablet and assistive-technology screen-reader runs remain
   outstanding.
4. The complete story has passed functionally, but a human-paced 12–15 minute
   presenter rehearsal has not been witnessed and timed.

Until those four decisions are closed, describe the product as “Phase 2
deployed release candidate,” not “pilot ready” or “production ready.”
