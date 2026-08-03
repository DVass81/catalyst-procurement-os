# Catalyst pilot release gates

These gates are executable release policy, not a statement that Catalyst has
already passed qualification. The source of truth is
`src/qualification/release-gates.ts`.

## Gates that code cannot manufacture

The following require elapsed time, external systems, or independent reviewers
and remain blocked until their evidence artifacts exist:

- 30 measured days at 99.95% or better availability;
- recovery drills proving RPO at or below 60 seconds and RTO at or below
  15 minutes;
- independent security, accessibility, and recovery assessments;
- two independent product-audit passes scoring at least 95;
- AWS S3 Object Lock replication and restore evidence;
- Supabase PITR and separate Storage-object recovery evidence;
- AWS S3 versioning and Object Lock in `COMPLIANCE` mode, a dedicated
  evidence-encryption KMS key, a separate banking-envelope KMS key, and
  successful version/checksum/retention verification from the replication
  worker;
- Entra/generic-SAML, SCIM, and phishing-resistant privileged-access evidence;
- three consecutive Golden Thread and three consecutive Free Play rehearsals;
- owner sign-offs and verified rollback of the exact candidate artifact.

No deadline, executive preference, or source-only test result changes these
requirements. Runtime changes restart qualification as defined in the audit
charter.

## Final decision

`evaluatePilotRelease` returns `ready: true` only when:

- the weighted score is at least 95;
- every category floor passes;
- Critical, High, and Medium findings are all zero;
- all 100 scenarios reconcile in the machine-validated scenario matrix, with
  each row naming its source test, deployed artifact, exact 40-character
  commit, and dataset version;
- every engineering, deployment, independent-review, time, recovery, and
  artifact-identity gate passes; and
- all 29 fixed browser/device/assistive-mode accessibility targets pass with
  zero Critical or Serious violations;
- the interactive-control audit finds no dead or misleading affordances;
- the fixed 300-user, 50-concurrent-session, 250,000-record performance run
  meets 750 ms read p95, 1.5 second command p95, Good Core Web Vitals, and
  zero runtime or hydration errors; and
- application rollback, database PITR, Storage-object restore, and Object
  Lock evidence restore all reconcile against one fixed commit within the
  one-minute RPO and fifteen-minute RTO;
- all 20 deployed authentication, authorization, tenant, supplier, replay,
  upload, prompt-injection, export, sealed-response, banking-leakage,
  dual-control, and session-revocation probes pass against one fixed commit;
- production readiness is scored separately without claiming general
  production or NCUA compliance.

The separate production score is implemented in
`src/qualification/production-readiness.ts`. It requires a 95 weighted score,
90 in every production category, independent retained evidence, and zero open
Critical, High, or Medium findings. Even a passing production-readiness
evidence score does not authorize an NCUA-compliance claim;
institution-specific legal, regulatory, policy, vendor-management, and
examiner review remains mandatory.
