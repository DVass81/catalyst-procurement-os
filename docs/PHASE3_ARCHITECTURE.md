# Catalyst Procurement OS — Phase 3 architecture

## Decision

The Next.js 16 application is the primary Phase 3 sales demonstration. It runs
as a standalone Node service on DigitalOcean and sits behind Cloudflare Access.
The Streamlit deployment remains a presenter backup.

The connected Phase 2 domain model remains authoritative for the fictional
request-to-invoice scenario. Phase 3 adds an experience layer without moving
financial rules into presentation components.

## Runtime map

```text
Browser
  App Router workspace
    DemoProvider -> deterministic domain workflow -> local fictional state
    CatalystGuideProvider -> tour state -> safe navigation and explanation
                              |
                              +-> browser narration and typed fallback
                              |
                              `-> POST /api/realtime/session
                                    |
                                    `-> short-lived OpenAI Realtime credential
```

## Guide boundaries

The deterministic guide is the presentation baseline. It owns the 12-minute
executive tour, 30-minute operational tour, captions, narration, pause, resume,
back, next, and grounded fixed-answer fallback.

Catalyst Guide Live is optional. The server creates a short-lived Realtime
credential using a server-only API key. The browser then establishes a WebRTC
audio session. The guide prompt is limited to fictional demo facts and current
page context.

The guide may explain and answer questions. It may not approve or reject a
request, award a vendor, issue a purchase order, receive goods, accept an
invoice variance, release payment, or modify a financial record.

## Deployment boundary

- `output: "standalone"` produces a container-ready Node service.
- `Dockerfile` creates a non-root production image.
- `.do/app.yaml` describes the DigitalOcean service and health check.
- Cloudflare provides private access, DNS, TLS, and edge controls.
- `POST /api/realtime/session` enforces origin checks, request-size limits,
  hourly session limits, no-store responses, and server-side secrets.
- Missing live-AI configuration returns a deliberate deterministic fallback.

## Production boundary

Phase 3 is a sales demonstration. Production implementation still requires
tenant identity, Microsoft Entra ID and Okta SSO, server authorization,
transactional persistence, immutable audit retention, document governance,
integration contracts, observability, recovery, accessibility testing,
penetration testing, and customer-approved AI/data terms.
