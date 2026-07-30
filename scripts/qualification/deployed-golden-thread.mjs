import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = (
  process.argv[2] ??
  "https://catalyst-phase3-staging-aj3de.ondigitalocean.app"
).replace(/\/+$/, "");
const tenantId = process.argv[3] ?? "org-catalyst-community-demo";

async function parseResponse(response) {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      `${response.status} ${result.message ?? result.code ?? "request failed"}`,
    );
  }
  return result;
}

async function loadState() {
  return parseResponse(
    await fetch(
      `${baseUrl}/api/phase-two/state?tenantId=${encodeURIComponent(tenantId)}`,
      {
        headers: { Accept: "application/json" },
      },
    ),
  );
}

let envelope = await loadState();
assert.equal(envelope.persistence, "supabase");
assert.equal(envelope.durability, "authoritative");
assert.equal(envelope.operationalReadiness.ready, true);

const evidence = [];

async function execute(command, expectedStage) {
  const idempotencyKey = randomUUID();
  const correlationId = randomUUID();
  const beforeRevision = envelope.revision;
  envelope = await parseResponse(
    await fetch(`${baseUrl}/api/phase-two/state`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId,
        expectedRevision: beforeRevision,
        idempotencyKey,
        correlationId,
        requestedAt: new Date().toISOString(),
        rationale: `Authorized qualification ${command.type.replaceAll("_", " ")} action.`,
        command,
      }),
    }),
  );
  assert.equal(envelope.revision, beforeRevision + 1);
  assert.equal(envelope.lastCommandId, idempotencyKey);
  assert.equal(envelope.persistence, "supabase");
  assert.equal(envelope.durability, "authoritative");
  assert.equal(envelope.operationalReadiness.ready, true);
  if (expectedStage) assert.equal(envelope.state.stage, expectedStage);
  evidence.push({
    command: command.type,
    revision: envelope.revision,
    stage: envelope.state.stage,
    idempotencyKey,
    correlationId,
  });
}

await execute({ type: "reset_demo" }, "draft");
await execute({ type: "analyze_request" }, "analyzed");
await execute(
  { type: "accept_inventory_recommendation" },
  "inventory_reviewed",
);
await execute(
  { type: "accept_standards_substitution" },
  "standards_reviewed",
);
await execute({ type: "select_vendor" }, "vendor_selected");
await execute(
  { type: "confirm_budget_and_coding" },
  "budget_confirmed",
);
await execute({ type: "submit_request" }, "submitted");

for (const [role, expectedStage] of [
  ["department_manager", "manager_approved"],
  ["it_reviewer", "it_approved"],
  ["purchasing_manager", "purchasing_approved"],
  ["finance_reviewer", "approved"],
]) {
  await execute({ type: "switch_role", role });
  await execute(
    {
      type: "decide_approval",
      decision: "approve",
      comments: "Qualification scenario reviewed and approved.",
    },
    expectedStage,
  );
}

await execute({ type: "switch_role", role: "purchasing_specialist" });
await execute({ type: "create_purchase_order" }, "po_draft");
await execute({ type: "issue_purchase_order" }, "po_issued");
await execute({ type: "record_vendor_acknowledgment" }, "acknowledged");
await execute({ type: "switch_role", role: "receiving_clerk" });
await execute({ type: "receive_order" }, "fully_received");
await execute({ type: "switch_role", role: "accounts_payable" });
await execute({ type: "run_invoice_match" }, "invoice_exception");
await execute(
  {
    type: "resolve_invoice_exception",
    decision: "route",
    justification: "",
  },
  "exception_routed",
);
await execute({ type: "switch_role", role: "finance_reviewer" });
await execute(
  {
    type: "resolve_invoice_exception",
    decision: "accept",
    justification:
      "Carrier evidence, invoice tolerance, and policy were reviewed by Finance.",
  },
  "variance_accepted",
);
await execute({ type: "switch_role", role: "accounts_payable" });
await execute({ type: "export_payment_readiness" });

const featuredInvoice = envelope.state.invoices.find(
  (invoice) => invoice.id === "invoice-featured",
);
assert.equal(featuredInvoice?.paymentStatus, "exported");
assert.equal(featuredInvoice?.varianceCents, 32_000);

const reloaded = await loadState();
assert.equal(reloaded.revision, envelope.revision);
assert.equal(reloaded.state.invoices[0]?.paymentStatus, "exported");

process.stdout.write(
  `${JSON.stringify(
    {
      schema: "catalyst.deployed-golden-thread-evidence.v1",
      testedAt: new Date().toISOString(),
      baseUrl,
      tenantId,
      startRevision: evidence[0].revision - 1,
      finalRevision: reloaded.revision,
      commands: evidence,
      finalStage: reloaded.state.stage,
      paymentReadiness: featuredInvoice?.paymentStatus,
      paymentExecuted: false,
      authoritative: reloaded.durability === "authoritative",
      auditRevision: reloaded.operationalReadiness.auditRevision,
    },
    null,
    2,
  )}\n`,
);
