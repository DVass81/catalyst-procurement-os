# Catalyst pilot-readiness environment register

No credential value, secret, personal token, banking value, or private key may
appear in this register.

| Environment | Purpose | Application | Database | Data | Authentication | Promotion status |
| --- | --- | --- | --- | --- | --- | --- |
| Development preview | Engineering and destructive synthetic testing | Current Phase 3 staging app | Current Phase 3 staging project | Synthetic only | Temporary time-boxed bypass; fails closed at expiry | Active development only |
| Interactive sales demonstration | Guided Story and isolated Free Play | Not provisioned | Not provisioned | Versioned synthetic sessions | Invite-only; authenticated presenter/prospect authority | Blocked on Phases 1–8 |
| Secure pilot | Controlled credit-union pilot | Not provisioned | Not provisioned | Approved procurement data only | Entra/SAML, MFA, role authority, no presenter shortcuts | Blocked on Phase 9 |
| Phase 2 rollback | Emergency rollback demonstration | Existing Phase 2 app | Existing Phase 2 project | Synthetic only | Existing Phase 2 controls | Preserve unchanged |

## Required environment fingerprint

Every deployment manifest records:

- environment identifier and classification;
- Git commit and source-tree hash;
- signed image digest and build/deployment identifiers;
- DigitalOcean app, component, region, instance count, and release channel;
- Supabase project reference, Postgres version, ordered migrations, exposed
  schemas, backup mode, and storage-backup status;
- dataset version, hash, session/reset identifier, and expected control totals;
- authentication mode, SSO provider identifiers, session policy version, and
  role-policy version;
- capability-registry version, provider modes, feature flags, and external
  dependency versions;
- verification timestamp, verifier, evidence-package hash, and rollback target.

## Promotion rules

- Development preview may receive passing engineering increments.
- Sales demonstration receives only a fixed candidate that passed Phases 1–8.
- Pilot receives only the exact signed artifact that passed Phase 9.
- Runtime configuration may vary only through the approved manifest. A runtime
  change creates a new artifact fingerprint and restarts qualification.
- No application image is rebuilt separately for promotion.

## Current database qualification status

The connected development-preview Supabase project is applied through
`20260729171156_phase3_second_tenant_bootstrap_order`. Seventeen later
pilot-readiness migrations are source-only and intentionally unapplied.
Applying them to the existing staging project is prohibited until they pass an
isolated development-branch migration validation and the target environment is
approved. Sales and pilot Supabase projects remain unprovisioned.

Secure-pilot file intake also fails closed unless the environment fingerprint
includes a qualified zero-retention live malware/DLP scanner. Synthetic
preview and sales files remain clearly labeled simulations and cannot be
reclassified as approved pilot data.

## Same-image promotion boundary

The sales and pilot deployment templates are
`.do/templates/sales-demo.yaml` and `.do/templates/secure-pilot.yaml`.
They both require the same qualified container digest, use two application
instances, disable the bypass, and accept only runtime Supabase and identity
configuration. `scripts/qualification/render-deployment-specs.mjs` refuses
to render them unless supplied an exact image digest, 40-character source
commit, migration-ledger hash, environment fingerprint, and approved
configuration hash. Rendered specs and their hashes are qualification
evidence under the ignored `outputs/` directory; template placeholders are
never deployable release evidence.

`NEXT_PUBLIC_SUPABASE_*` and `NEXT_PUBLIC_CATALYST_SSO_ENABLED` remain legacy
development-preview compatibility names only. A sales or pilot environment
fails closed unless it receives `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, and `CATALYST_SSO_ENABLED` at runtime. This keeps
the qualified image independent from each environment's isolated Supabase
project.
