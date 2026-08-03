# Catalyst 87+ recovery implementation traceability

Status: Source implementation complete; deployed qualification pending

Audit baseline: August 2, 2026, 80/100

Fixed rubric: `august-2-regression-87-v1`

Fixed dataset: `august-2-six-workflow-v1`

Release branch: `codex/audit-recovery-87`

This record distinguishes implemented source evidence from deployed and independent evidence. It does not claim that Catalyst has reached 87, is pilot-ready, is production-ready, or is NCUA-compliant.

## Recovery controls

| Control | Implementation | Automated evidence | Deployed evidence |
| --- | --- | --- | --- |
| Structured JSON contract | Phase 2/3 command, authentication, MFA, notification, and health APIs return stable codes, messages, correlations, and revisions where applicable. Clients reject non-JSON and malformed responses. | API route and `readApiJson` tests | Pending |
| Neutral bootstrap | The workspace displays no tenant, role, identity, or procurement record until authentication, assignment, fixed role, permissions, and authoritative state resolve. Failure displays a neutral no-data screen. | Typecheck/build; deployed visual test pending | Pending |
| Development presenter behavior | Development Preview retains synthetic presenter role switching and free play. | Sixteen role API transitions | Pending |
| Functional Test authority | Functional Test requires Supabase authentication, one tenant, one direct fixed role, no presenter assignment, no role override, no presenter commands, and MFA for protected privileged actions. | Authority, session, and API denial tests | Pending |
| Scanner-resistant access | Magic-link emails point to a confirmation screen. The token is exchanged only after the user presses Continue to Catalyst. Unknown, expired, used, and unassigned access fails closed. | Authentication request and confirmation route tests | Pending |
| Natural procure-to-pay | Loan equipment, cybersecurity renewal, and emergency network replacement run in both tenants with returns, resubmission, approvals, PO, supplier acknowledgement, receiving/service acceptance, matching, exceptions, export, close, reopen, clone, and withdrawal. | Six deterministic end-to-end workflow tests | Pending |
| Supplier PO authority | Only the assigned supplier can acknowledge an issued PO. Supplier projection hides other suppliers and unissued POs. | Workflow, authorization, and projection tests | Pending |
| RFQ buyer/supplier lifecycle | `/rfqs` uses the governed Phase 3 workspace for authoring, invitations, questions, addenda, amendments, sealed responses, withdrawal, conflict handling, evaluation, negotiation, BAFO, award/cancellation notices, and PO conversion. | Phase 3 lifecycle tests | Pending |
| Sealed-response confidentiality | Internal users receive no response content or evaluation before controlled close; buyers receive only submission receipt counts. Suppliers receive only their own invitation, response, questions, and notice. | Projection and RFQ lifecycle tests | Pending |
| RFQ delivery evidence | RFQ invitations and decisions create tenant-scoped in-app and email outbox records. Resend delivery uses idempotency, retry, terminal failure, correlation, and provider evidence after the authoritative commit. | Migration validation; worker tests pending final suite | Pending |
| Controlled reset | Functional reset is System Administrator-only, MFA-protected, and enabled only in Functional Test. The previous full state is archived before reset; archive failure blocks reset. | Authority and migration validation | Pending |
| Functional Test identity roster | The fixed roster contains 24 unique ICC addresses, twelve per tenant, one direct role per user, two isolated suppliers per tenant, and AAL2 requirements for Purchasing Manager, Finance Reviewer, and System Administrator. | Identity-fixture validation and guarded provisioning script | Mailboxes and users pending |
| Runtime identity | Health reports environment kind, access mode, synthetic classification, presenter/reset state, authentication-link mode, MFA policy, commit, migration hash, configuration hashes, rubric, dataset, and authoritative readiness without secrets. | Runtime and health tests | Pending |

## Six required scenarios

| Tenant | Loan officer equipment | Cybersecurity renewal | Emergency branch network |
| --- | --- | --- | --- |
| `org-y12-demo` | Automated source pass | Automated source pass | Automated source pass |
| `org-catalyst-community-demo` | Automated source pass | Automated source pass | Automated source pass |

The deployed qualification must repeat these scenarios using the correct authenticated people. Presenter navigation, client-derived roles, direct database manipulation, and artificial stage changes are prohibited.

## Environment contract

- Development Preview: existing isolated Supabase project, public synthetic bypass, explicit development warning, presenter free play.
- Functional Test: new isolated Supabase Pro project, invite-only scanner-resistant magic links, fixed authoritative roles, privileged TOTP MFA, no presenter authority, synthetic-only data.
- Phase 2 rollback: unchanged.
- `main`: unchanged until the exact audited release candidate passes the fixed score and severity gates.

## Remaining release gates

1. Complete the full engineering, dependency, secret, schema, test, accessibility, build, and performance checks.
2. Commit and push the exact release candidate and open a draft pull request.
3. Create the approved Supabase Pro Functional Test project in the selected organization and US East region.
4. Apply the complete migration ledger and versioned synthetic dataset; run security and performance advisors.
5. Verify the 24 ICC mailboxes, pre-create Auth users, and validate fixed tenant, role, supplier, and MFA assignments.
6. Configure Resend custom SMTP, exact Site URL, callback allowlist, and scanner-resistant email template.
7. Create `catalyst-functional-test` and deploy the exact commit to both Functional Test and Development Preview.
8. Run deployed authentication, role, tenant, supplier, six-workflow, RFQ, reset, outage, accessibility, performance, and evidence tests.
9. Re-audit using the unchanged August 2 method. Only an independently verified score of at least 87 closes this recovery release.
