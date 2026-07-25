# Phase 3 private deployment runbook

## Target stack

- GoDaddy remains the domain registrar.
- Cloudflare manages authoritative DNS, TLS, caching rules, bot protection, and private-demo access.
- DigitalOcean App Platform runs the Next.js standalone container.
- Streamlit Community Cloud remains the presenter backup only.

## Before deploying

1. Merge or explicitly deploy `codex/phase-3-guided-sales-demo`.
2. Create a DigitalOcean App from `.do/app.yaml`.
3. Change the placeholder `DEMO_ALLOWED_ORIGINS` to the exact demo hostname.
4. Add `OPENAI_API_KEY` as an encrypted run-time secret. Never use a `NEXT_PUBLIC_` prefix.
5. Confirm `/api/health` returns HTTP 200.
6. Confirm `/api/realtime/session` returns a short-lived client secret only after an authorized same-origin request.

## Cloudflare and domain

1. Add the dedicated demo hostname in DigitalOcean.
2. Add the DigitalOcean verification records in Cloudflare DNS.
3. Keep the record proxied and use Full (strict) TLS.
4. Create a Cloudflare Access application for the Y-12 demo hostname.
5. Allow only Daniel, Josh Ogle, and explicitly invited Y-12 participants.
6. Use one-time PIN or the approved identity provider; do not share a universal password.
7. Disable indexing and browser caching for private demo HTML and API responses.
8. Rate-limit `POST /api/realtime/session`.

## Required verification

- Private access challenge appears before the application.
- Uninvited users cannot load HTML or static assets.
- The Y-12 logo, disclaimer, and Catalyst ownership appear on the login and workspace.
- Both tours complete in narrated, captioned, and silent modes.
- Denying microphone permission leaves the deterministic guide usable.
- Missing or exhausted OpenAI credentials produce a calm fallback message.
- The API key never appears in browser source, network response payloads, logs, or exported assets.
- The Streamlit backup URL loads in a separate browser profile.

## Rollback

DigitalOcean retains the prior deployment. If Phase 3 health checks fail, route the presenter to the known-good Streamlit URL and roll the app back to the prior successful component deployment. Do not troubleshoot infrastructure live in front of the prospect.
