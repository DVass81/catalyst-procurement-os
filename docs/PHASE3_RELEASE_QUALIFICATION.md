# Catalyst Commercialization Demonstration — Release Qualification

## Release decision

**Current state: implementation candidate; not yet staging-qualified or merge-qualified.**

This document is deliberately stricter than a feature-completion checklist. A passing local build does not authorize a production claim, a pilot claim, a merge to `main`, or a customer-data connection.

## Pinned release inputs

| Item | Pinned value |
|---|---|
| Phase 2 baseline and rollback target | `0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0` |
| Development branch | `codex/phase3-commercialization-demo` |
| Dataset | `phase3-commercialization-demo-v1` |
| Dataset SHA-256 | `50faccb63005c286b01ec9ec2b3c31ad529242c95d9ed8ce2545bd7f8e116afd` |
| Environment class | Isolated commercialization staging |
| Data policy | Synthetic data only |
| Historical implementation | Reference material only |

## Qualification gates

| Gate | Evidence | Current result | Release effect |
|---|---|---|---|
| Phase 2 baseline preserved | Exact rollback commit pinned | Pass | Required |
| Requirement map | `PHASE3_IMPLEMENTATION_MAP.md` maps P3-001 through P3-075 | Pass | Required |
| Secret scan | Source/migration/spec scan found no credential value | Pass | Required |
| TypeScript | `tsc --noEmit` | Pass | Required |
| Lint | Changed application and server surfaces, zero warnings | Pass | Required |
| Regression | 8 files / 66 tests, including 10 commercialization controls | Pass | Required |
| Production build | Next.js 16.2.12 optimized build and 52-page generation | Pass | Required |
| Browser validation | Golden Thread, role authority, preflight, integration replay, report snapshot, and CATE narrative | Pass locally | Repeat after deployment |
| Database migration | Tenant-scoped tables, explicit grants, RLS, supplier isolation, command-chain metadata | Pending isolated staging apply | Blocking |
| Database negative tests | Cross-tenant, supplier isolation, grants, self-approval, stale revision, prompt/upload cases | Pending isolated staging | Blocking |
| DigitalOcean deployment | Separate staging app from exact branch commit | Pending | Blocking |
| Deployment rollback | Verified rollback to pinned Phase 2 commit | Pending | Blocking |
| Physical accessibility matrix | Target browsers/devices plus approved assistive technologies | Pending | Blocking |
| Critical/High findings | No unresolved Critical or High finding in the seeded register | Pass locally | Recheck after staging |
| Golden Thread rehearsals | Three consecutive deployed rehearsals | 0 of 3 | Blocking |
| Exact release manifest | Commit, deployment, dataset, providers, findings, limitations, rollback, and sign-offs | Pending | Blocking |
| Pull request review | Early draft PR and final approval | Pending | Blocking |

## Implemented control families

1. Capability truth registry with the exact five approved statuses.
2. Versioned deterministic dataset, canonical identifiers, hashes, reset, and integrity checks.
3. Canonical integration model with validation, dead-letter, retry, replay, and reconciliation.
4. Simulated Entra, Okta, and SAML configuration with Catalyst authorization remaining authoritative.
5. Supplier lifecycle, evidence, remediation, isolation design, and banking-change dual control.
6. Versioned contract intelligence with bounded citations, conflicts, obligations, and mandatory human validation.
7. Governed workflow lifecycle with approved blocks, simulation, independent approval, activation, supersession, and rollback.
8. Responsive approval and receiving controls with scanning/offline simulation disclosures.
9. Certified measures, governed reports, accessible tables, deterministic PDF/XLSX/CSV exports, and snapshot hashes.
10. CATE narratives that separate facts, inference, assumptions, missing information, limitations, confidence, and required human action.
11. Security, accessibility, and operations evidence centers with findings, incidents, support cases, fallbacks, and runbooks.
12. A 20.25-minute Golden Thread with presenter personas, preflight, reset, fallback, and downloadable evidence package.

## Non-negotiable release rules

- `main` remains unchanged until every blocking gate is complete.
- The Phase 2 deployment remains the production demonstration and rollback target.
- No real customer, supplier, banking, tax, identity-provider, ERP, accounting, contract, member, or payment data is permitted.
- Upload and import endpoints require an explicit synthetic-data attestation.
- CATE cannot approve, activate, award, receive, waive, suspend, modify banking information, execute payment, or make final legal/compliance decisions.
- No capability may be labeled `Live` unless its release-specific verification result passes in the deployed environment.
- Internally tested evidence cannot be described as independent certification.
- A release manifest is append-only after sign-off.

## Final sign-off record

The final record must identify:

- exact merged commit and pull request;
- exact DigitalOcean app/deployment identifiers;
- exact Supabase staging project and migration version;
- dataset version and hash;
- capability registry version and verification result;
- regression, authorization, RLS, security, accessibility, performance, reset, fallback, and rehearsal evidence;
- all open findings and explicit acceptance authority;
- product, engineering, security, accessibility, operations, and commercial sign-offs;
- exact rollback target and last verified rollback result.

Until that record exists, the honest status is **Functional Demo — implementation candidate**.
