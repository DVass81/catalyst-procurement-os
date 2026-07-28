# Audit Phase 2 release evidence

Evidence date: 2026-07-28  
Product boundary: fictional, invite-only product demonstration  
Repository: `DVass81/catalyst-procurement-os`  
Release branch: `codex/phase-4-live-ai-concierge`  
Pull request: `#2`  
Validated application commit: `a9147c0d1b70bb0d002677d9b1a6133db9909fda`

## Release result

The Phase 2 release candidate is implemented, deployed, and functionally
verified in the connected demonstration environment. It is not represented as
a paid pilot, production customer implementation, customer endorsement, or
regulatory certification.

The strict Phase 2 demo release gate is not yet signed off because four items
still require either stronger evidence or an explicit, dated demo-only risk
acceptance:

1. Supabase backup restoration cannot be exercised on the current Free plan.
2. The complete high-cardinality validation envelope has not been materialized.
3. Physical mobile/tablet and assistive-technology screen-reader runs remain
   outstanding; desktop keyboard and semantic accessibility checks passed.
4. The complete story passed functionally, but a human-paced 12–15 minute
   presenter rehearsal has not been witnessed and timed.

No item above is silently waived by this document.

## Application and CI verification

| Check | Result | Evidence |
| --- | --- | --- |
| ESLint | Pass | Local release validation |
| Strict TypeScript | Pass | Local release validation and Next.js build |
| Vitest | Pass | 56 of 56 tests across 7 files |
| Legacy Streamlit tests | Pass | 23 Python tests |
| Next.js production build | Pass | Next.js 16.2.12, all 39 static pages generated |
| GitHub Actions | Pass | `Audit Phase 2 quality`, run 44, commit `a9147c0` |
| Supply-chain controls | Pass | Production dependency audit and CycloneDX SBOM in CI |

The final CATE regression covers two release defects directly:

- optional usage fields are sent to the Supabase RPC as explicit `null` values
  so PostgREST can resolve the complete function signature;
- internal CATE failures are no longer falsely returned as authentication
  failures.

## Supabase verification

Project reference: `dujcsbzqznucqpuyjsdy`

Applied release migrations:

1. `202607250001_phase4_live_concierge.sql`
2. `202607270001_audit_phase2_foundation.sql`
3. `20260728183905_phase2_release_hardening.sql`
4. `20260728184701_phase2_service_rpc.sql`

Verified controls:

- every exposed Phase 2 table has RLS enabled;
- anonymous and authenticated mutation privileges are absent;
- service-only command and usage RPCs have explicit execution grants;
- tenant membership is database-authoritative;
- direct same-tenant access succeeds and cross-tenant access returns no rows;
- private Storage access returns only the assigned tenant’s objects;
- the `procurement-evidence` bucket is private;
- default table/function grants were revoked and required grants are explicit;
- foreign-key indexes are present and RLS initialization-plan findings were
  cleared;
- the remaining password-leak-protection warning is a Free-plan limitation,
  mitigated for the demo by disabled public sign-up and passwordless access.

The invite roster contained one accepted demonstration account with presenter
and administrator authority for the two fictional demo tenants. No additional
demonstration users were present.

## End-to-end workflow evidence

### Primary story

The authoritative Y-12 fictional story completed through:

1. request creation;
2. inventory reuse;
3. standards substitution;
4. human supplier selection;
5. budget and coding;
6. four distinct approvals;
7. purchase-order issue and acknowledgment;
8. receipt;
9. three-way invoice match;
10. exact `$320` freight exception;
11. Finance disposition with justification;
12. AP payment-readiness export;
13. private audit-package generation.

Audit package version 1:

- package hash:
  `e68df1b7927e54886a66b4b2df722e2911a8d5724f1cb19436d8a9b6f1c9212c`
- PDF, CSV, and JSON opened through private 60-second signed URLs.

### Reset and adverse receiving story

After an authoritative reset, the story completed again with partial/damaged
receiving, rejection, replacement, invoice resolution, and payment-readiness
export.

Audit package version 2:

- parent linked to version 1;
- package hash:
  `299169acca011ad0eb7d9c3fee593f76b8007fa1e1d01e9fbfcb2d1bfa8fd2c4`
- PDF, CSV, and JSON opened through private 60-second signed URLs.

### Documents and imports

- A fictional CSV evidence file was uploaded privately with SHA-256
  `343ec3bfa6b4b192ba19c521119a4d7098974828e8c64c97fa4168553378e760`.
- View and download each produced a 60-second signed URL and an immutable
  access event.
- CSV batch `ddb9b203-904d-42dd-a575-37713ec44b1f` staged 2 of 2 rows with
  zero errors and no automatic posting.
- XLSX batch `8d4b39ab-9060-4304-8ce3-c0fd1b67213c` staged 2 of 2 rows with
  zero errors and no automatic posting.
- Separate approval, posting, and reversal duties were demonstrated.

## CATE evidence

The deployed release returned the deterministic, presentation-safe invoice
exception contract with:

- the exact `$320` unapproved freight finding;
- cited purchase order, receipt, and invoice records;
- policy name and version;
- assumptions and evidence-gap disclosure;
- qualitative confidence and rationale;
- risks, alternatives, and recommended next action;
- an explicit human-decision boundary;
- a visible `Reliable demo fallback` label.

The same live request created:

- usage event `cda7e24d-5c8e-47ca-8bcb-1ef87f5d3a52` in
  `private.ai_usage_ledger`;
- immutable evaluation `1d6a0352-27b9-4493-a903-f539cd493dd7` in
  `public.cate_evaluations`.

Both records identify the fictional Y-12 tenant, deterministic provider,
invoice-match capability, zero estimated provider cost, and the deployed
fallback model. Authentication and tenant assignment succeeded independently
of the CATE operation.

## Accessibility and responsive evidence

The live desktop browser was checked on:

- `/dashboard`
- `/purchase-requests`
- `/receiving`
- `/invoices`
- `/ai-procurement`
- `/administration`
- `/audit-center`

The final scan found:

- zero unnamed controls;
- zero missing image alternatives;
- zero duplicate element identifiers;
- zero heading-level skips;
- zero data tables without headers;
- zero detected text-contrast failures;
- zero horizontal page overflow at the tested desktop viewport.

Keyboard verification confirmed that `Ctrl+K` opened global search, a purchase
order could be entered and opened with `Enter`, and `Escape` closed the
interaction. Checkbox labels and attachment-dismissal controls were enlarged
to practical target sizes.

This evidence is not described as a physical screen-reader, tablet, or mobile
device certification. Those runs remain part of the release decision.

## Performance evidence

DigitalOcean health traffic:

| Scenario | Requests | Concurrency | Errors | p50 | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Normal target | 200 | 25 | 0 | 0.246 s | 0.714 s | 0.981 s |
| 2× resilience | 200 | 50 | 0 | 0.329 s | 2.201 s | 2.793 s |

The normal 25-concurrent-user target passed the two-second p95 read target. The
2× resilience run completed without errors but exceeded that normal target by
0.201 seconds, which is recorded rather than hidden.

The authoritative snapshot query executed in `0.099 ms` with one shared-buffer
hit and no disk reads. The deployed CATE response completed within the
15-second presentation target during live verification.

These measurements are concurrency and query evidence. They do not prove that
25,000 vendors, 250,000 workflow records, 1,000,000 transaction lines, 100,000
documents or 250 GB, 100,000 import rows, 250,000 export rows, and several
million audit events were all materialized. The strict capacity-envelope gate
therefore remains open.

## Deployment and recovery evidence

DigitalOcean application:

- app: `catalyst-procurement-os-demo`
- app ID: `5c36a8f5-da4a-44df-803f-1b6041ad1379`
- URL: `https://catalyst-procurement-os-demo-6jouh.ondigitalocean.app`
- final CATE-fix deployment:
  `8b9116ef-6fb0-4658-aa44-fcb1f9a7a8be`
- deployed commit: `a9147c0d1b70bb0d002677d9b1a6133db9909fda`

The app reported healthy after deployment. The health endpoint reported an
authoritative workflow, deterministic CATE fallback, simulated document
scanning and transactional email, and no payment execution.

A controlled zero-downtime rollback exercise:

1. rolled from the approved `6639ec8` deployment to the immediately previous
   `65c7793` deployment in 55 seconds;
2. verified application health;
3. restored the approved `6639ec8` deployment in 63 seconds;
4. verified application health, authoritative revision 69, and clean UI text.

Supabase’s current Free plan explicitly does not include scheduled project
backups or restore-to-a-new-project. A database restore was therefore not
fabricated or claimed. Completing that gate requires a plan upgrade and a
provider backup, or a named, dated, expiring demo-only risk acceptance.

## Release decision matrix

| Gate | Status |
| --- | --- |
| Functional workflows and repeatable reset | Pass |
| Tenant isolation and permission denial | Pass |
| Financial and quantity reconciliation | Pass |
| Document, import, audit package, and signed access | Pass |
| CATE output, usage ledger, and evaluation ledger | Pass |
| Security controls, CI, and dependency/SBOM checks | Pass with documented Free-plan password warning |
| DigitalOcean deployment and rollback | Pass |
| Desktop semantic accessibility and keyboard | Pass |
| Physical mobile/tablet and screen-reader verification | Open |
| Normal 25-user concurrency target | Pass |
| Complete high-cardinality capacity envelope | Open |
| Supabase backup restoration | Blocked by current plan |
| Human-paced 12–15 minute presenter rehearsal | Open |

Phase 2 must remain a release candidate until the four open decisions are
closed by evidence or recorded risk acceptance.
