# Catalyst 95+ pilot-readiness audit charter

Status: Frozen implementation contract
Rubric version: `p95-pilot-readiness-v1`
Qualification dataset: `p95-synthetic-qualification-v1`
Official recovery baseline: **62/100**

## Decision

Catalyst is being qualified as a credit-union-first controlled pilot candidate,
not as generally available production software. Production readiness is scored
and reported separately. No audit may silently substitute a production
purchase rubric for the approved pilot-readiness rubric.

The final audit has two independent passes:

1. A black-box buyer and operator pass using the deployed application and
   independently authenticated users.
2. A control-and-evidence pass that verifies authorization, RLS, audit history,
   reconciliation, release identity, recovery evidence, and limitations.

## Fixed score gates

- Weighted overall score: at least **95/100**.
- Every category: at least **90/100**.
- Reliability, procure to pay, identity/security, CATE, and pilot readiness:
  at least **95/100**.
- No unresolved Critical, High, or Medium finding.
- Low findings remain visible and count against applicable category scores.

The machine-verifiable rubric, role roster, scenarios, and evaluation function
are in `src/qualification/pilot-readiness.ts`.

## Required identities

The reviewer receives separate requester, approver, buyer, receiver, accounts
payable, supplier, auditor, and administrator identities. These users are
tested across two tenants and at least two isolated suppliers. Presenter
simulation does not count as multi-user proof.

The machine-readable roster in
`src/qualification/identity-fixtures.ts` requires sixteen unique AAL2 accounts:
one identity for every persona in each tenant. Email addresses are supplied
through the named qualification environment keys and are never committed.
Missing, malformed, or shared addresses fail the identity gate. Provisioning,
successful authentication, role authorization, tenant isolation, supplier
isolation, and deprovisioning must each be evidenced before the fixture is
accepted.

## Fixed audit identity

Every audit record must identify:

- application URL and environment class;
- full Git commit, source-tree hash, container image digest, and deployment ID;
- Supabase project reference and ordered migration ledger;
- dataset version, hash, reset/session identifier, and expected totals;
- release channel, capability registry, feature flags, and provider modes;
- authenticated test identity, active role, tenant, browser, device, viewport,
  assistive technology, and test timestamp;
- audit scenario ID, result, correlation ID, record IDs, evidence links, and
  reviewer disposition.

An audit without this identity is useful feedback but cannot replace the
fixed-release qualification decision.

## Severity rules

| Severity | Meaning | Release effect |
| --- | --- | --- |
| Critical | Loss, ambiguity, disclosure, unauthorized commitment, or inability to execute the authoritative core | Immediate stop |
| High | Material control, accuracy, isolation, security, or major workflow failure | Blocking |
| Medium | Incomplete enterprise behavior, accessibility, recovery, or evidence that can affect reliable pilot use | Blocking |
| Low | Minor usability, consistency, or documentation defect without material control impact | Visible; score impact |

Severity may not be reduced merely because the environment is a demonstration.
Applicability may be changed only through a documented rubric decision made
before the fixed audit begins.

## Data and claim boundary

- Qualification uses versioned synthetic data.
- Pilot activation may admit approved procurement, supplier, contract,
  employee-role, sourcing, and transaction data under governing agreements.
- Member, consumer, customer-account, card, unrelated regulated, and
  payment-execution data are prohibited.
- `NCUA compliant`, `production ready`, certification, endorsement, and
  equivalent claims remain prohibited until independently established for a
  defined deployment.

## Change control

Any code, dependency, schema, environment, policy, feature flag, or dataset
change creates a new runtime artifact and restarts qualification. Documentation
that provably cannot affect the runtime artifact may be corrected without
restarting the window, but its history remains append-only.
