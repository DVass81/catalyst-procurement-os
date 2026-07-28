# Audit Phase 2 security, risk, and deferred-scope register

## Verified security controls

- Invite-only Supabase authentication; no public registration
- Database-authoritative tenant assignments
- Deny-by-default server commands and domain role checks
- RLS on every exposed Phase 2 table and private Storage
- Direct same-tenant success and cross-tenant denial checks
- Explicit grants required for Data API access
- Service credentials isolated in `server-only` modules
- Server-side Zod validation and rate limiting
- Optimistic concurrency and idempotency
- Hash-chained immutable workflow events
- Immutable evidence versions, access events, confirmations, and CATE records
- Content/type/size checks and private object paths
- Prompt-injection boundary for uploaded evidence
- CSP, clickjacking, MIME-sniffing, referrer, permissions, cache, and robot
  headers
- CI production-dependency audit and CycloneDX SBOM
- No payment rail, email send tool, autonomous award, or autonomous approval

## Closed release risks

- All four release migrations were applied to the target Supabase project.
- Direct positive and negative tenant RLS tests passed.
- Private Storage tenant isolation and 60-second signed access passed.
- Versioned PDF, CSV, and JSON audit packages were generated, hash-checked, and
  opened from private Storage.
- Primary and adverse end-to-end stories passed after authoritative resets.
- CATE generated a live demo response and durable usage and evaluation records.
- Desktop semantic accessibility, keyboard behavior, and target sizes passed.
- The normal 25-concurrent-user performance target passed without errors.
- DigitalOcean deployment, application rollback, restoration, and health checks
  passed.

## Accepted demo-only release risks

| Risk | Severity | Owner | Demonstration decision | Expiration |
| --- | --- | --- | --- | --- |
| Database backup restore is unavailable on the current Supabase Free plan | High | Platform Owner | Accepted only for fictional, invite-only demonstration with versioned migrations, authoritative reset, and application rollback | 2026-09-30 or scope expansion |
| Full high-cardinality capacity envelope has not been materialized | Medium | Platform Owner | Accepted only for the bounded demonstration roster and dataset; no scale claim permitted | 2026-09-30 or scope expansion |
| Physical mobile/tablet and actual screen-reader runs remain outstanding | Medium | Product Owner | Accepted only for the known desktop presentation environment; no accessibility certification claim permitted | 2026-09-30 or scope expansion |
| Human-paced 12–15 minute presenter rehearsal has not been witnessed and timed | Medium | Demo Owner | Accepted for the demonstration with required pre-demo smoke check; no duration guarantee permitted | 2026-09-30 or scope expansion |

The controlling approval, compensating controls, automatic expiration
conditions, and prohibited claims are recorded in
`docs/PHASE2_DEMO_ONLY_RISK_ACCEPTANCE_2026-07-28.md`.

## Paid-pilot limitations

| Risk | Severity | Owner | Mitigation / exit evidence | Expiration |
| --- | --- | --- | --- | --- |
| Scanning/OCR is simulated | Low for demo | Security Owner | Persistent label; activate a reviewed provider before real files | Before paid pilot |
| Transactional email is simulated | Low for demo | Process Owner | Persistent label; activate a reviewed adapter before pilot notifications | Before paid pilot |
| Signed links expire after 60 seconds rather than supporting provider-side instant revocation | Medium | Security Owner | Keep TTL short; add an application proxy/revocation service for pilot | Before paid pilot |

## Explicitly deferred

- Payment execution, banking, purchasing cards
- Bidirectional ERP/accounting/WMS integrations
- Supplier portal and unrestricted external uploads
- SSO, SCIM, public API, marketplace, and webhook ecosystem
- SMS, Slack, Teams, mobile push
- Native mobile, barcode, and RFID
- Electronic signatures and contract authoring
- Full tax engine, general ledger, and WMS
- Unrestricted workflow/form/KPI/report builders
- Autonomous purchasing, award, approval, waiver, or payment decisions
- Automatic CATE retraining or behavior changes
- Multi-region production and customer-managed keys
- Any SOC 2, ISO, regulatory, or customer-endorsement claim
