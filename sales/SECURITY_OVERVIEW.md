# Catalyst Procurement OS — security and AI controls

## Demonstration boundary

- Fictional procurement data only
- No member data, account data, or Y-12 system connection
- Private, access-controlled sales environment
- No public indexing
- Human approval remains visible for every material financial decision

## Production control direction

- Tenant isolation and least-privilege role-based access
- Microsoft Entra ID and Okta SSO support
- Segregation of duties and configurable approval thresholds
- Encryption in transit and at rest
- Controlled document storage and retention
- Complete activity and audit-event logging
- Secure secret management and environment separation
- Backup, recovery, incident-response, and change-management procedures

## AI governance

Catalyst AI may summarize, extract, classify, explain, and recommend. It may not approve or reject a request, award a vendor, issue a purchase order, receive goods, accept an invoice exception, or release payment.

The OpenAI API key remains server-side. The browser receives only a short-lived Realtime session credential. If live AI is unavailable, the deterministic guide completes the presentation without weakening controls.

## Honest status

Phase 3 is a sales demonstration, not a certified production banking environment. Production commitments, regulatory mapping, penetration testing, vendor due diligence, data-processing terms, and control evidence must be completed during the paid pilot and implementation.
