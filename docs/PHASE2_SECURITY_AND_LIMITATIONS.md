# Audit Phase 2 security, risk, and deferred-scope register

## Implemented security controls

- Invite-only Supabase authentication; no public registration
- Database-authoritative tenant assignments
- Deny-by-default server commands and domain role checks
- RLS on every exposed Phase 2 table and private Storage
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

## Open release risks

| Risk | Severity | Owner | Mitigation / exit evidence | Expiration |
| --- | --- | --- | --- | --- |
| Migration and RLS not yet exercised in target project | High | Platform Owner | Apply migration and pass positive/negative tenant tests | Before deployment |
| Backup restore not yet exercised | High | Platform Owner | Isolated restore and reconciliation report | Before demo release gate |
| Browser accessibility evidence incomplete | Medium | Product Owner | WCAG 2.2 AA automated and manual core-flow report | Before demo release gate |
| Capacity envelope not measured | Medium | Platform Owner | Synthetic p95 load report | Before demo release gate |
| Scanning/OCR is simulated | Low for demo | Security Owner | Persistent label; activate reviewed provider before real files | Before paid pilot |
| Transactional email is simulated | Low for demo | Process Owner | Persistent label; activate reviewed adapter before pilot notifications | Before paid pilot |
| Signed links expire after 60 seconds rather than supporting provider-side instant revocation | Medium | Security Owner | Keep TTL short; add application proxy/revocation service for pilot | Before paid pilot |
| Audit-package rendering and download have not been exercised against target private Storage | High | Records and Evidence Owner | Generate PDF/CSV/JSON, validate hashes, and run same/cross-tenant download tests | Before demo release gate |

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
