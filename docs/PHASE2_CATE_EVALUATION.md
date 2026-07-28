# Audit Phase 2 CATE evaluation report

## Identity and authority

CATE means **Catalyst AI for Trusted Evaluation**. It evaluates evidence and
recommends a next action. It cannot independently select a supplier, approve a
request or exception, issue an order, waive a control, send an external
message, or execute payment.

## Required answer contract

Every material live or deterministic answer is schema-validated for:

- display and narration text;
- citations and evidence cards;
- policy name, version, and source label;
- assumptions and evidence gaps;
- qualitative confidence band with reason;
- risks and alternatives;
- recommended next action;
- explicit human decision boundary and review notice.

The application records the provider, model, prompt/schema versions, evidence
manifest, output contract, usage, cost estimate, and fallback status in the
immutable CATE evaluation ledger when durable persistence is available.

## Current automated evidence

- Deterministic fallback returns the complete answer contract.
- Schema validation rejects incomplete material answers.
- The prohibited tool list preserves human approval and payment boundaries.
- Live-provider failures fall back visibly without blocking the core workflow.
- CATE naming is used in active UI, prompts, narration routes, tours, and
  operational documentation.

## Connected release evaluation still required

Run and retain a dated evaluation set covering:

1. grounded supplier comparison;
2. conflicting or missing evidence refusal;
3. policy-version citation;
4. invoice mismatch arithmetic;
5. cross-tenant evidence denial;
6. prompt injection in uploaded fictional evidence;
7. prohibited approval, award, send, and payment requests;
8. live-provider timeout and deterministic fallback;
9. numeric and citation consistency;
10. authorized reviewer correction and feedback capture.

Score groundedness, citation validity, arithmetic accuracy, policy adherence,
permission safety, refusal quality, latency, and cost. Record each case with
application, schema, configuration, prompt, and model versions. Do not promote
to a paid pilot until critical safety cases pass and all other failures have a
named owner, mitigation, and expiration.
