# Audit Phase 2 demo-only risk acceptance

Status: Approved  
Approver: Daniel Vass, demonstration sponsor  
Effective date: 2026-07-28  
Expiration date: 2026-09-30  
Product boundary: fictional, invite-only Catalyst Procurement OS demonstration

## Approval record

Daniel Vass explicitly approved the Phase 2 demo-only risk acceptance as
written in the controlling Codex task on 2026-07-28.

This acceptance closes the Audit Phase 2 demonstration release decision. It
does not claim that the underlying evidence gaps were completed, and it does
not authorize a paid pilot, production use, real customer data, public access,
or a certification claim.

## Accepted demonstration risks

### P2-025 — Physical-device and assistive-technology verification

Accepted gap:

- physical mobile/tablet and actual screen-reader core-flow runs were not
  completed.

Compensating controls:

- desktop semantic checks found no unnamed controls, missing image
  alternatives, duplicate identifiers, heading skips, headerless data tables,
  detected text-contrast failures, or horizontal overflow on tested routes;
- keyboard search, navigation, dismissal, focus behavior, and practical target
  sizes were verified;
- the demonstration is restricted to the known desktop presentation
  environment;
- no WCAG certification or broad device-compatibility claim is permitted.

### P2-027 — Supabase backup restoration

Accepted gap:

- a provider database backup could not be restored because the connected
  Supabase project is on the Free plan.

Compensating controls:

- all data is fictional demonstration data;
- the authoritative seed and repeatable reset were exercised;
- migrations are versioned in source control;
- two complete workflow stories and their audit artifacts were reconciled;
- DigitalOcean application rollback and restoration were exercised;
- access remains invite-only with one accepted demonstration account;
- no recoverability, RPO, RTO, or production-resilience claim is permitted.

### P2-028 — Complete high-cardinality capacity envelope

Accepted gap:

- the entire documented high-cardinality data envelope was not materialized.

Compensating controls:

- the normal 25-concurrent-user target completed 200 requests with zero errors
  and a 0.714-second p95;
- the 50-concurrent-user resilience run completed 200 requests with zero
  errors, while its 2.201-second p95 overage is recorded;
- the authoritative snapshot query completed in 0.099 milliseconds with no
  disk reads;
- the invite-only demonstration roster and dataset remain bounded;
- no enterprise-scale capacity or production-sizing claim is permitted.

### P2-029 — Human-paced presenter rehearsal

Accepted gap:

- the full story was not witnessed and timed as a human-paced 12–15-minute
  rehearsal.

Compensating controls:

- the primary and adverse receiving stories both completed in the deployed
  environment without manual data repair;
- authoritative reset and presenter-stage controls were verified;
- the final application, CATE, imports, documents, audit packages, and
  rollback were verified independently;
- a pre-demonstration smoke check remains required;
- no claim is made that every presenter will finish within 12–15 minutes.

## Automatic expiration and prohibited expansion

This acceptance expires at the earliest of:

1. 2026-09-30;
2. immediately before any paid pilot;
3. immediately before any real customer, employee, supplier, financial, or
   regulated data is used;
4. immediately before public or unrestricted access;
5. immediately before representing the product as production ready,
   accessibility certified, enterprise-scale validated, or recoverability
   certified.

After expiration, each accepted gap becomes release-blocking again until
supported by direct evidence or replaced by another explicitly approved,
named, dated, scoped, and expiring acceptance.

## Release decision

Within the boundary above, Audit Phase 2 is approved for the fictional,
invite-only product demonstration. The product must continue to be described
as a demonstration release, not as a paid pilot or production deployment.
