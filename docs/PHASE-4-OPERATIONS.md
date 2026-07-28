# Phase 4 operations

Phase 4 adds a live AI procurement concierge without turning the two-week sales
demonstration into a production financial system. The Phase 3 guided workflow
remains the rollback and emergency presentation path.

## Runtime boundaries

- OpenAI reasoning runs only on the server with `store: false`.
- ElevenLabs browser sessions use a server-minted signed URL. The API key never
  reaches the browser.
- The ElevenLabs agent must call
  `POST /api/voice/procurement-tool` for every substantive procurement answer.
  Configure a Bearer secret matching `ELEVENLABS_TOOL_SECRET`.
- ElevenLabs client tools are limited to navigation and highlighting. They
  cannot perform financial actions.
- Google access is limited to Daniel's account, the exact Gmail label
  `Catalyst Procurement Demo`, and the app-created secondary calendar with the
  same name.
- Gmail can create a draft after confirmation. There is no send-email code path.
- Every environment has deterministic fallback. Public-market fallback refuses
  to invent current prices or citations.

## Required setup sequence

1. Create a dedicated Catalyst Supabase project. Do not reuse another app's
   database.
2. Apply `supabase/migrations/202607250001_phase4_live_concierge.sql`.
3. Configure a custom SMTP provider in Supabase Auth.
4. Disable public signup, pre-create invited users, and put trusted `role`,
   `presenter`, and `tenant_ids` values in `app_metadata`.
5. Set the DigitalOcean secrets listed in `.env.example`.
6. Enable authentication on the existing ElevenLabs CATE agent and set
   `ELEVENLABS_AGENT_ID`.
7. Configure the signed production URL as an ElevenLabs server tool:
   `/api/voice/procurement-tool`.
8. Configure the HMAC post-call webhook at `/api/voice/webhook`. Enable
   transcript and audio deletion in the ElevenLabs agent privacy settings.
9. Create the Google OAuth app. If restricted-scope verification is incomplete,
   leave the connector simulated for the presentation.
10. Run the preflight checklist below before changing DigitalOcean traffic.

## ElevenLabs tool contract

The server tool body is the `AiRunRequest` JSON contract. Required values are
`tenantId`, `prompt`, `currentRoute`, `role`, and `workflowStage`. The tool must
use the custom Authorization header `Bearer <ELEVENLABS_TOOL_SECRET>`.

CATE's agent instruction must say:

> For every procurement fact, analysis, recommendation, policy answer, spend
> answer, or document answer, call `catalyst_procurement_reason` and speak its
> `narration_text`. Use client tools only for navigation. Never claim that you
> approved, awarded, issued, received, paid, emailed, scheduled, or changed
> risk. When the server returns fallback mode, continue calmly without claiming
> that a live provider generated the answer.

## Cost controls

- Combined ceiling: $250/month.
- OpenAI target: $175/month.
- ElevenLabs target: $75/month.
- Warning states: 70%, 85%, and 95%.
- Paid sessions stop before projected usage reaches the ceiling and at the 95%
  guardrail.
- Voice sessions end after 15 minutes.
- Sol deep reviews are capped at three per presentation session.
- Daniel's presenter dock includes a live/fallback control and paid-AI kill
  switch.

Token prices are environment-configurable because model prices can change.
Before presenting, set the six `OPENAI_*_USD_PER_1M` values to the current
provider prices. Reconcile estimates with provider usage after each presentation
day.

## Presentation-day preflight

- Confirm the DigitalOcean health endpoint returns 200.
- Confirm Supabase OTP arrives through custom SMTP for Daniel and Josh.
- Confirm Y-12 and Catalyst Community users cannot cross tenant boundaries.
- Open Presenter Controls and confirm provider health and remaining budget.
- Start and end a 30-second CATE session; test mute, interruption, and captions.
- Run the hero requisition and confirm the $1,047 monitor saving.
- Run the invoice match and confirm the $320 freight exception.
- Confirm the Gmail action creates a draft and never sends.
- Confirm the calendar action targets only the secondary demo calendar.
- Turn global fallback on, run one question, then return to live mode.
- Deny microphone permission once and confirm typed mode and the Phase 3 tour work.
- Reset the demo and rehearse the full 12–15 minute presentation.

## Known Phase 4 limits

This is still a sales demonstration. Procurement records remain deterministic
client-side demo state; Google restricted-scope verification may be pending;
the in-memory cost ledger must be connected to the included private Supabase
table during deployment; and enterprise SSO, persistent customer workflows,
disaster recovery, and production integrations belong to Phase 5.
