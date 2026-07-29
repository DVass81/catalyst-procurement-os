# Commercialization Staging Runbook

## Purpose

Deploy the commercialization demonstration without changing the verified Phase 2 production demonstration. Staging uses a separate DigitalOcean app and a separate Supabase project. All identities, records, documents, transactions, findings, and outcomes remain synthetic.

## Deployment order

1. Confirm the exact branch commit and a clean secret scan.
2. Create the isolated Supabase project in the approved organization and `us-east-2` region.
3. Apply migrations in timestamp order through `20260728223311_phase3_commercialization_foundation.sql`.
4. Seed only the two fictional Catalyst demo tenants and pre-invited demonstration identities.
5. Verify explicit grants, RLS, tenant assignment, supplier isolation, private Storage, signed URL expiry, and service-role-only writes.
6. Configure the separate DigitalOcean app from `.do/app.yaml`.
7. Set staging secrets through DigitalOcean; never commit secret values.
8. Deploy the exact branch commit, verify `/api/health`, and record the deployment identifier.
9. Run authorization, RLS, upload, provider-failure, reset, export, and rollback smoke tests.
10. Complete three consecutive Golden Thread rehearsals and attach the evidence.

## Required DigitalOcean secrets

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ACTION_CONFIRMATION_SECRET`

The AI, voice, and Google provider secrets are optional for the primary deterministic demonstration. If omitted or unavailable, the corresponding capability must visibly use its governed fallback and must not be labeled `Live`.

## Required non-secret settings

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | `${APP_URL}` |
| `DEMO_AUTH_BYPASS` | `0` |
| `CATALYST_SYNTHETIC_ONLY` | `1` |
| `CATALYST_RELEASE_CHANNEL` | `commercialization-staging` |

## Database verification

The staging audit must prove:

- all exposed tables have RLS enabled;
- `anon` has no access to Phase 3 tables;
- `authenticated` has only the explicit read grants required for tenant/supplier views;
- writes are server-authorized through the service role;
- every record is tenant-scoped;
- supplier users cannot read another supplier application;
- tenant members cannot cross tenant boundaries;
- command idempotency and expected revision prevent replay/conflict corruption;
- protected actions record persona, reason, evidence, truth status, simulation flag, and correlation ID;
- command payload metadata is bound into the append-only event hash chain;
- banking approval requires a separate independent verifier;
- report/evidence exports cannot cross tenant scope.

## Rollback

The application rollback target is commit `0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0`.

1. Stop automatic staging deployment.
2. Record the failed deployment, impact, and correlation identifier.
3. Redeploy the pinned rollback commit to the staging app.
4. Confirm health, authentication, tenant authority, the featured workflow, and audit package access.
5. Do not delete failed-release evidence.
6. Database rollback is forward-fix by default because Phase 3 tables are additive. Any destructive database rollback requires a separately reviewed migration and verified backup.

## Promotion rule

Staging success does not automatically promote to `main`. Promotion requires every blocking gate in `PHASE3_RELEASE_QUALIFICATION.md`, the final append-only release manifest, and named sign-offs.
