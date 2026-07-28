# Catalyst Procurement OS — Audit Phase 2 Architecture

## Product boundary

The Next.js 16 application is the primary Phase 2 demonstration. It operates
only on synthetic procurement records. It does not execute payments, send real
transactional email, synchronize an ERP, or imply a customer endorsement.
Streamlit remains a separately labeled deterministic presentation fallback; it
does not duplicate the Phase 2 backend.

## Runtime and authority map

```text
Browser
  PhaseTwoPage / CATE workspace
          |
          | validated command + tenant + expected revision + idempotency key
          v
Next.js Route Handlers
  authenticated session -> database tenant assignment -> command authorization
          |
          v
Server command engine
  state preconditions -> role/SoD rules -> integrity validation
          |
          v
private.commit_demo_command()
  atomic revision check -> snapshot update -> hash-chained workflow event
          |
          v
Supabase Postgres + private Storage
```

The browser stores only theme and active-demo-tenant preferences. Procurement
records are loaded from and changed through the server. When Supabase is not
configured, development uses a visibly labeled temporary server store. If the
server API itself is unavailable, the UI becomes a visibly labeled read-only
deterministic fallback.

## Trust boundaries

- Supabase Auth establishes the named account.
- `public.tenant_assignments` is authoritative for tenant membership and the
  presenter/administrator boundary. Editable user metadata is not used.
- Synthetic persona switching is a server command available only to a
  presenter or administrator and cannot grant access to another tenant.
- The service key is imported only by `server-only` modules.
- Authenticated clients receive read-only table grants. Mutations occur through
  validated server commands and a private service-role transaction.
- RLS is enabled for every exposed Phase 2 table and private Storage object.
- Completed workflow events, document versions, access events, CATE
  evaluations, and action confirmations are immutable.

## Domain slices

1. Foundation: tenant membership, command schema, revision conflicts,
   idempotency, server-owned state, hash-chained audit.
2. Configuration: versioned validation, simulation, independent review,
   approval, activation, supersession, and protected zero-tolerance defaults.
3. Imports/documents: CSV and macro-free XLSX quarantine, row/value controls,
   duplicate flags, original hashes, private files, version metadata, content
   checks, simulated scanning label, and signed access logging.
4. Request-to-PO: request analysis, inventory reuse, standards substitution,
   sourcing gates, human selection, sequential approval, issuance,
   acknowledgment, and controlled PO revision.
5. Receiving: full or cumulative partial receipt, inspection, rejection,
   quarantine/return, replacement, reversal, and accepted-quantity matching.
6. Invoice: cumulative three-way match, duplicate-risk field, zero tolerance,
   typed freight exception, payment hold, independent disposition, and
   exportable payment readiness without payment execution.
7. Work management: authoritative queues, in-app notices, simulated email,
   deduplication, retries, dead letter visibility, escalation, and
   acknowledgment.
8. CATE: evidence citations, policy/version, assumptions, gaps, qualitative
   confidence, risks, alternatives, next action, human boundary, deterministic
   fallback, usage ledger, and immutable evaluation ledger.
9. Analytics: 32 certified outcome/driver/guardrail definitions with
   role-specific scorecards and record-level drilldown.
10. Audit/hardening: reproducible package versions, PDF/CSV/JSON manifest
    contract, hashes, security headers, rate limits, CI audit, SBOM, reset, and
    operational runbooks.

## Data and financial integrity

- Money is integer cents in the application and `bigint`/`numeric` in
  Postgres.
- Quantities are nonnegative integers; accepted receipt quantities cannot
  exceed ordered quantities.
- Reversed records remain in history and are excluded from active totals.
- Request, PO, receipt, invoice, and dashboard calculations run on the server
  before persistence and pass a whole-dataset reconciliation check.
- UTC event timestamps are stored by Postgres; business dates and the tenant
  display timezone remain distinct.
- Payment-ready/exported is not paid. There is no payment tool or rail.

## Degraded operation

CATE, email, scanning, import, and export failures do not block the core
procurement workflow. The UI labels whether state is authoritative, temporary,
or read-only. Live CATE failures return the deterministic contract; simulated
email and scanning never masquerade as live providers.

## Key files

- `src/phase-two/commands.ts`
- `src/server/phase-two/command-engine.ts`
- `src/server/phase-two/repository.ts`
- `src/app/api/phase-two/state/route.ts`
- `src/server/phase-two/documents.ts`
- `src/server/phase-two/imports.ts`
- `src/analytics/kpi-catalog.ts`
- `supabase/migrations/202607270001_audit_phase2_foundation.sql`
