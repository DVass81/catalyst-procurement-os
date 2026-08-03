# Catalyst 95+ engineering checkpoint

Checkpoint date: 2026-07-29
Branch: `codex/pilot-readiness-95`
Published baseline commit: `2adaec0355f78789424b1a6a5a240df89d15ebbf`
Candidate commit: not created
Push/deployment status: not pushed, not deployed
Release status: not qualified

## Local engineering result

The current uncommitted source candidate passed:

- secret scan: 320 candidate files, zero findings;
- migration validation: 36 total migrations, 17 unapplied
  pilot-readiness migrations;
- same-image deployment-template validation: sales and pilot templates pass,
  two instances each, runtime-only environment configuration;
- ESLint: pass;
- TypeScript: pass;
- Vitest: 49 files and 235 tests passed;
- Next.js production build: pass, 62 pages/routes generated;
- dependency audit: zero known vulnerabilities in the complete and
  production-only dependency trees.

These results establish a local engineering checkpoint only. They do not
upgrade any source evidence to deployed, independent, pilot, production, or
NCUA-compliance evidence.

## Material source controls now present

- fixed 100-point pilot rubric, 100-scenario matrix, category floors, and
  release gate;
- authoritative revision, idempotency, replay, readiness, append-only command,
  workflow, rejection, and evidence controls;
- normalized operational request, approval, PO, receiving, invoice, credit,
  exception, payment-readiness, sourcing, supplier, contract, report, and
  integration paths;
- exact duplicate-request blocking;
- governed RFQ authoring through award/non-award evidence;
- supplier-scoped views and secure-pilot banking submission, KMS envelope,
  out-of-band verification, and independent decision contracts;
- server-derived roles, supplier scope, AAL, phishing-resistant privileged
  access, governed JIT, and SCIM lifecycle source controls;
- deterministic CATE facts, intent evaluation, claim-level evidence,
  minimized external context, and fail-closed fallback;
- governed report schedules, retained links, and reconciled export contracts;
- runtime-only Supabase and SSO configuration for promotion of one signed
  image across isolated sales and pilot environments;
- digest-pinned, two-instance DigitalOcean sales and pilot templates;
- external operations probe contract, append-only samples, conservative
  one-minute availability buckets, and fixed recovery/security/accessibility/
  performance evidence matrices;
- separate production-readiness scoring that never authorizes a general
  production or NCUA-compliance claim.

## Gates still open

The candidate must not be pushed as a release candidate, merged, migrated, or
deployed to sales/pilot until the applicable prerequisites are approved and
available. Open gates include:

- isolated Supabase branch application and rollback testing for all 17
  candidate migrations;
- provisioned sales-demo and secure-pilot Supabase projects and DigitalOcean
  applications;
- sixteen unique AAL2 qualification identities across two tenants, plus two
  independent supplier identities;
- live Entra/generic-SAML claims, phishing-resistant privileged access,
  governed JIT approval, SCIM deactivation, and session revocation;
- AWS KMS banking execution and S3 Object Lock replication/restore;
- qualified live zero-retention malware and DLP scanning;
- PITR and separate Storage-object backup/restore;
- all 100 deployed multi-role scenarios;
- the fixed 20-probe deployed security matrix;
- the fixed 29-target accessibility matrix and independent accessibility
  assessment;
- the 300-user, 50-concurrent-session, 250,000-record performance run;
- one-minute RPO and fifteen-minute RTO recovery drills;
- three consecutive Golden Thread and three consecutive Free Play rehearsals;
- 30 measured days at 99.95% availability;
- independent security and recovery assessments;
- two independent 95+ product audits;
- exact candidate image signing, manifest agreement, rollback verification,
  and owner sign-offs.

`main`, the Phase 2 rollback deployment, the current Phase 3 development
preview, and the connected Supabase staging project remain unchanged.
