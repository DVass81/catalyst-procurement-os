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

## Open release risks

| Risk | Severity | Owner | Mitigation / exit evidence | Expiration |
| --- | --- | --- | --- | --- |
| Database backup restore is unavailable on the current Supabase Free plan | High | Platform Owner | Upgrade, obtain a provider backup, restore it in isolation, and reconcile; or approve a named, dated, expiring demo-only exception | Before Phase 2 merge |
| Full high-cardinality capacity envelope has not been materialized | Medium | Platform Owner | Run the documented synthetic envelope and record p95/error/resource results; or approve a bounded demo-only exception | Before Phase 2 merge |
| Physical mobile/tablet and actual screen-reader runs remain outstanding | Medium | Product Owner | Complete device and assistive-technology core-flow checks; or approve a bounded demo-only exception | Before Phase 2 merge |
| Human-paced 12–15 minute presenter rehearsal has not been witnessed and timed | Medium | Demo Owner | Run the complete scripted story with a presenter and record duration/issues; or approve a bounded demo-only exception | Before Phase 2 merge |
| Scanning/OCR is simulated | Low for demo | Security Owner | Persistent label; activate a reviewed provider before real files | Before paid pilot |
| Transactional email is simulated | Low for demo | Process Owner | Persistent label; activate a reviewed adapter before pilot notifications | Before paid pilot |
| Signed links expire after 60 seconds rather than supporting provider-side instant revocation | Medium | Security Owner | Keep TTL short; add an application proxy/revocation service for pilot | Before paid pilot |

No risk is accepted merely by appearing in this table. A real risk acceptance
requires a named approver, date, reason, compensating controls, and expiration.

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
