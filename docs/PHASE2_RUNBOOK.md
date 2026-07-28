# Audit Phase 2 deployment, reset, rollback, and recovery runbook

## Preconditions

- Approved release commit and named deployer/reviewer
- DigitalOcean staging/production-demo environment identified
- Target Supabase project and tenant list confirmed
- Required secrets present without printing values
- Database backup captured before migration
- `DEMO_AUTH_BYPASS=0`

## Pre-release validation

```powershell
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --omit=dev --audit-level=high
```

The CI workflow also generates a CycloneDX SBOM.

## Database release

Apply migrations in filename order through the approved Supabase migration
workflow. Do not paste ad hoc SQL into production.

After applying:

1. Confirm both demo tenants exist.
2. Confirm named users have `public.tenant_assignments`.
3. Confirm every exposed Phase 2 table reports RLS enabled.
4. Confirm `anon` has no table privileges.
5. Confirm `authenticated` has select only where intended.
6. Confirm `private.commit_demo_command` is executable only by `service_role`.
7. Confirm `procurement-evidence` is private.
8. Run same-tenant positive and cross-tenant negative tests.
9. Upload/view/download a fictional document and verify access logging.
10. Stage a controlled CSV and XLSX and verify no posting occurs without the
    separate approval/post path.

## Application release

Deploy the exact approved commit to the production-demo DigitalOcean app. Check
`/api/health` and confirm:

- authoritative workflow is `true`;
- CATE mode matches configured provider state;
- scanning and email are explicitly `simulated`;
- payment execution is `not-implemented`.

Complete the primary story twice, including one reset:

1. Inventory reuse
2. Standards substitution
3. Human supplier selection
4. Budget/coding confirmation
5. Four approvals
6. PO issue and acknowledgment
7. Full receipt or partial/replacement path
8. Three-way match and $320 freight exception
9. Finance disposition
10. AP payment-readiness export
11. Auditor package generation

## Deterministic reset

Presenter mode exposes **Reset**, which submits the authoritative
`reset_demo` command. It preserves the tenant and frozen session date and
reconstructs the approved dataset. It does not clear another tenant.

## Application rollback

1. Stop new release promotion.
2. Redeploy the immediately previous saved DigitalOcean application version.
3. Verify `/api/health`.
4. Do not reverse the schema while the previous application can safely ignore
   additive Phase 2 tables.
5. If a schema rollback is required, use a separately reviewed forward
   migration; never destructively edit migration history.
6. Record release, schema, configuration, CATE, and rollback versions.

## Backup and restore exercise

The release gate requires evidence, not a checklist assertion:

1. Record backup timestamp and provider snapshot identifier.
2. Restore into an isolated nonproduction project.
3. Apply the same application release against the restored project.
4. Reconcile tenant assignments, snapshot revision/checksum, workflow-event
   chain, document metadata/object count, imports, outbox, CATE ledger, KPI
   definitions, and audit packages.
5. Measure recovery point and recovery time.
6. Confirm no production credentials or real customer data enter the exercise.
7. Store the dated evidence and reviewer signoff.

Target architecture objectives are RPO 15 minutes and RTO four hours. They are
not customer SLAs and must not be claimed as achieved before the exercise.

## Degraded service

- OpenAI unavailable: CATE returns the visibly labeled deterministic contract.
- Email unavailable: workflow queue remains authoritative; outbox retries and
  dead letters remain visible.
- Scanner unavailable: new live scanning stops; the demo may use only the
  labeled simulated adapter with fictional files.
- Import/export unavailable: core workflow continues and failed jobs remain
  visible.
- Supabase unavailable: UI enters read-only fallback in production; it does not
  accept authoritative mutations.

## Incident and evidence handling

Preserve event history, document versions, and access events. Never “fix”
evidence by direct row editing. Use a reversal, supersession, new package
version, or reviewed forward migration.
