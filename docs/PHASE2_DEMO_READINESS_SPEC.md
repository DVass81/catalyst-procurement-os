# Catalyst Procurement OS - Phase 2 Demo-Readiness Specification

Status: Approved planning baseline
Planning confidence: 96%
Target: Fully interactive synthetic-data demonstration with pilot-ready architecture
Primary application: Next.js + Supabase
Fallback application: Streamlit, deterministic demonstration only
AI identity: CATE - Catalyst AI for Trusted Evaluation

## 1. Instruction to Codex

Implement Phase 2 according to this specification.

Before changing application code:

1. Read `AGENTS.md`.
2. Read the relevant installed Next.js 16.2.11 documentation in
   `node_modules/next/dist/docs/`. This repository explicitly warns that this
   version contains breaking changes and must not be implemented from memory.
3. Inspect the current working tree and preserve all existing Phase 1 changes.
   Do not overwrite, revert, or re-create working functionality unnecessarily.
4. Reconcile this specification against the current code and produce a
   requirement-to-file implementation map.
5. Implement in the ordered vertical slices in section 26.
6. Verify every slice before beginning the next one.

Do not claim a capability is live unless it is genuinely connected and
functional. Do not represent synthetic data, deterministic CATE responses,
simulated emails, simulated scanning, or placeholder integrations as live.

## 2. Mission

Transform the current Catalyst Procurement OS demonstration into a credible,
fully interactive Phase 2 product demonstration that:

- demonstrates the complete request-to-audit workflow;
- uses realistic but entirely synthetic information;
- persists application records through Supabase;
- proves tenant, role, policy, evidence, and audit architecture;
- presents world-class, non-generic procurement KPIs;
- uses CATE for governed, evidence-backed evaluation;
- remains repeatable and presentation-safe;
- creates a sound path to a paid pilot without pretending that a customer pilot
  already exists.

Phase 2 is demo-ready now and pilot-ready by design. It is not an active
customer implementation and must not depend on unavailable customer policies,
owners, integrations, production data, or legal signoffs.

## 3. Product truth boundary

### 3.1 Required labels

The demonstration must make the following facts visible and unambiguous:

- the organization and all records are fictional;
- all business data is synthetic;
- the demonstration is not connected to customer systems;
- external delivery, ERP, payment, and scanning integrations may be simulated;
- CATE may run live or deterministically, and the active mode must be shown;
- no certification, regulatory approval, endorsement, or production-readiness
  claim may be implied.

### 3.2 Prohibited behavior

The application must never:

- present simulated data as live;
- show a fake success message for an action that did not occur;
- allow a disabled control without explaining why it is disabled;
- expose dead buttons or placeholder primary actions;
- imply that CATE approved, paid, ordered, or selected something when a human
  decision is required;
- use a real prospect's name, logo, employees, documents, credentials, or
  confidential information as synthetic seed data without written permission.

## 4. Demonstration operating model

Use one clearly fictional manufacturing organization with:

- 12 months of internally consistent synthetic history;
- seven primary personas:
  - requester;
  - approver;
  - purchasing;
  - receiving;
  - accounts payable;
  - auditor/executive;
  - administrator;
- realistic departments, locations, categories, budgets, vendors, contracts,
  purchase orders, receipts, invoices, exceptions, documents, notifications,
  KPI history, and audit events;
- an isolated demo tenant;
- safe persona switching available only in demo mode;
- a one-action deterministic reset to the approved starting state;
- stage-jump controls for the presenter that are visibly presentation tools and
  cannot be confused with ordinary product actions.

Demo identities must still map to authoritative tenant, role, and scope records.
The browser must never be trusted as the source of permission.

## 5. Primary demonstration story

The primary 12-15 minute story must show one reconciled record progressing
through:

1. An urgent material request.
2. Completeness, budget, policy, and inventory-reuse checks.
3. Approval routing.
4. Qualified supplier comparison.
5. CATE's evidence-backed supplier evaluation.
6. Human supplier selection and purchase-order approval.
7. Purchase-order issuance.
8. A partial receipt with damaged or rejected units.
9. Quarantine or inspection when required.
10. An invoice with both quantity and price/freight discrepancies.
11. CATE's evidence-backed mismatch explanation.
12. A controlled exception decision.
13. A correction, credit, or other valid resolution.
14. Updated certified KPIs with source-record drilldown.
15. A complete audit package.

Every amount and quantity must reconcile across the request, sourcing event,
purchase order, receipt, accepted inventory, invoice, exception, KPI,
export, and audit package.

Optional deep dives must cover:

- vendor risk and scoring;
- policy/configuration simulation;
- documents and evidence lineage;
- role enforcement and separation of duties;
- KPI formulas, targets, and drilldowns.

## 6. Demo fidelity boundary

### 6.1 Fully functional in the Next.js application

- tenant-aware persistence;
- demo identity and persona mapping;
- server-enforced roles, scopes, and separation of duties;
- configuration and policy versions;
- requests, approvals, sourcing, vendor evaluation, and purchase orders;
- document metadata, versions, private access, and evidence links;
- partial receiving, inspection, discrepancy, rejection, return, and reversal;
- invoice intake, line matching, exceptions, and payment readiness;
- in-app work queues and notifications;
- CATE evidence, recommendations, feedback, and audit records;
- certified KPIs, drilldowns, filters, and reconciled exports;
- immutable audit history and versioned audit packages;
- deterministic reset of the synthetic tenant.

### 6.2 Live where configured

- Supabase Auth, Postgres, Row Level Security, and private Storage;
- OpenAI API responses for CATE;
- signed private document access.

### 6.3 Simulated but explicitly labeled

- ERP, accounting, WMS, banking, and payment-system connections;
- payment execution;
- outbound email delivery;
- malware-scanner provider results;
- external OCR provider results when no approved provider is configured;
- supplier portal interactions;
- third-party notification channels.

Provider adapters and durable job records may be implemented for these
capabilities, but Phase 2 must not silently send messages, move funds, or
connect to external customer systems.

## 7. Architecture

Use a disciplined modular monolith:

- Next.js application;
- Supabase Auth;
- Supabase Postgres as the authoritative business record;
- Row Level Security on every exposed business table;
- private Supabase Storage;
- server-side command handlers for material actions;
- explicit domain workflow state machines;
- database transactions for related changes;
- transactional outbox for notifications and background work;
- append-only audit events;
- typed and versioned commands, events, schemas, and provider contracts;
- pure policy functions for permissions, approvals, tolerances, matching,
  scoring, and KPI calculations;
- provider adapters for AI, email, scanning, OCR, and future integrations.

Do not introduce:

- a second database;
- microservices;
- unrestricted event sourcing;
- a generic workflow engine;
- a public integration marketplace;
- duplicate production logic in Streamlit.

## 8. Environment separation

Support three controlled environments:

### Development

- synthetic data only;
- local development and automated testing;
- development-only credentials.

### Staging/UAT

- production-like configuration;
- synthetic or formally sanitized scenarios only;
- release-candidate validation.

### Production demo

- approved synthetic demonstration data only;
- private access;
- no real customer data.

Use separate Supabase projects, databases, Storage buckets, secrets, AI keys,
and email/scanner adapters. Never copy production customer data into a lower
environment.

Required release controls:

- version-controlled migrations;
- automated verification before promotion;
- named deployment approval;
- rollback plan;
- tenant-scoped feature flags with owner, purpose, expiration, and audit;
- no casual manual production database changes;
- emergency changes require approval, evidence, reconciliation, and review;
- each release must identify application, schema, configuration, and CATE
  versions.

## 9. Identity, RBAC, and authorization

### 9.1 Pilot-ready identity model

- invite-only accounts;
- verified business email addresses;
- no public registration;
- no self-selected roles;
- named individual accounts only;
- mandatory MFA for administrators and privileged financial roles when real
  pilot identities are activated;
- step-up authentication for high-risk actions;
- start dates, expiration dates, roles, and scopes;
- immediate session revocation after suspension or privilege removal;
- inactive-account review;
- preserved audit attribution after departure;
- service accounts only when necessary, narrowly scoped, and monitored.

The synthetic demonstration may use a dedicated demo identity mechanism, but it
must be isolated from future production authorization and must never permit
access outside the synthetic demo tenant.

### 9.2 Authorization model

Support multiple roles per user and scopes including:

- department;
- location;
- category;
- approval amount;
- assigned workflow ownership.

At minimum, enforce boundaries for:

- requester;
- approver;
- purchasing;
- receiving;
- accounts payable;
- auditor;
- executive;
- system administrator.

Required controls:

- deny by default in API and database;
- database role assignments are authoritative;
- never trust browser role state;
- no self-assigned roles;
- separation-of-duties blocks;
- split-purchase detection;
- time-limited delegation;
- emergency access with justification, short expiration, alerting, and review;
- quarterly access-certification capability for a later pilot;
- audited access denial, role change, permission change, export, and sensitive
  record view;
- Catalyst support has no customer-tenant access without a temporary,
  explicitly approved, audited grant.

Use `app_metadata` or authoritative database records for authorization. Never
use editable user profile metadata as a permission source. Service-role
credentials must remain server-only.

## 10. Configuration and policy governance

Provide a controlled, versioned configuration center for:

- organization and branding;
- timezone, currency, locale, fiscal calendar, business days, and holidays;
- departments, locations, categories, cost centers, and accounting codes;
- approval routing, thresholds, delegation, and separation of duties;
- vendor scoring, risk gates, and required documents;
- receiving and inspection rules;
- invoice-matching tolerances;
- notifications, reminders, and escalations;
- KPI targets and reporting preferences;
- CATE confidence, evidence, and human-review requirements;
- document retention, export, and deletion policies.

Configuration lifecycle:

`Draft -> Validated -> Review Pending -> Approved -> Scheduled -> Active ->
Superseded/Rolled Back`

Required safeguards:

- simulation against synthetic historical records;
- impact analysis showing affected users, open records, approvals, and
  workflows;
- conflict detection for routing gaps, circular escalations, incompatible
  rules, and missing approvers;
- a named owner and backup per policy domain;
- four-eyes approval for high-risk changes;
- protected controls that cannot be disabled;
- scheduled activation;
- controlled rollback;
- readable customer signoff package for a future pilot;
- configuration health checks;
- every transaction records the exact configuration and policy version used.

Phase 2 provides controlled configuration forms, not an unrestricted workflow
builder.

## 11. Safe defaults

When a real customer policy is unavailable:

- deny access unless granted;
- require human approval unless an approved rule says otherwise;
- use zero quantity and invoice tolerance;
- use zero over-receipt allowance;
- never auto-merge suspected duplicate vendors or records;
- never invent accounting, contract, vendor, or policy values;
- route incomplete or conflicting records to an exception queue;
- treat expired or unavailable evidence as insufficient;
- require review for low-confidence CATE findings;
- disable integrations and automation until configured;
- block incomplete configuration from production promotion;
- label system defaults separately from customer-approved values.

Demo values must be identified as synthetic configuration, not customer policy
or industry benchmarks.

## 12. Data imports and master data

Phase 2 data strategy:

- Catalyst-native records for new synthetic transactions;
- validated CSV/XLSX imports for master data, opening inventory, and historical
  read-only analytics;
- no ERP synchronization;
- clear source and freshness labels.

Required import workflow:

`Uploaded -> Staged -> Validating -> Failed/Ready for Approval -> Approved ->
Posted/Reversed`

Required controls:

- staging and quarantine;
- mapping preview;
- data-type and content validation;
- duplicate detection without automatic merging;
- original file, hash, row, source, importer, and timestamp lineage;
- internal immutable IDs plus customer/external IDs;
- source-precedence rules;
- control totals before and after posting;
- split permissions for import, validate, approve, and post;
- idempotent reprocessing;
- reversible batches that preserve history;
- effective dates and deactivation instead of destructive deletion;
- readable error reports;
- future customer signoff capability;
- encrypted backups and tested restoration.

Exclude member, consumer, or customer financial information. The intended
future data boundary contains procurement business data and authorized business
contact information only.

## 13. Documents and evidence

Support private tenant-isolated attachments for:

- requests;
- sourcing and quotes;
- vendors;
- exceptions;
- purchase orders;
- receipts;
- invoices;
- contracts;
- audit packages.

Supported formats:

- PDF;
- DOCX;
- XLSX;
- CSV;
- PNG;
- JPG.

Default maximum size: 25 MB per file, configurable.

Document lifecycle:

`Uploading -> Scanning -> Available/Rejected -> Superseded/Archived/Held`

Required controls:

- private Storage only;
- no public object URLs;
- signed, short-lived URLs;
- access inherited from the parent record;
- immediate link invalidation after permission loss;
- MIME/content sniffing;
- sanitized filenames and metadata;
- reject executables, archives, macros, and password-protected documents in
  Phase 2;
- quarantine suspected prohibited information;
- file hash and duplicate detection;
- versioning;
- view, download, replace, AI-use, delete, and restore audit events;
- retention, legal hold, recoverable deletion, and storage quotas;
- page-level citations;
- OCR-confidence display when OCR is used;
- retries and visible provider failures;
- extra confirmation for bulk downloads and audit packages.

Decisions, approvals, and CATE citations must be pinned to an exact document
version. Evidence used by a completed decision cannot be silently replaced.

The demonstration may use a deterministic scanning/OCR adapter, but it must be
labeled simulated. Real scanning/OCR providers remain activation work.

## 14. Canonical workflow states

### Vendor

`Prospect -> Onboarding -> Under Review -> Active/Conditional/Rejected ->
Suspended/Inactive`

### Request

`Draft -> Submitted -> Approval Pending -> Returned/Approved/Rejected/Cancelled
-> Converted/Closed`

### Sourcing event

`Draft -> Issued -> Open -> Responses Under Review -> Evaluated ->
Awarded/No Award/Cancelled -> Closed`

### Purchase order

`Draft -> Approval Pending -> Issued -> Acknowledged ->
Partially Received/Fully Received -> Closed/Cancelled`

### Purchase-order revision

`Proposed -> Approval Pending -> Approved/Rejected -> Issued`

### Receipt

`Draft -> Submitted -> Pending Inspection ->
Accepted/Partially Accepted/Rejected -> Posted -> Reversed/Superseded`

### Invoice

`Received -> Extraction Review -> Ready to Match -> Matched/Exception ->
Approved -> Payment Ready -> Exported/Closed`

### Exception

`Open -> Assigned -> Investigating/Pending Evidence/Pending Approval ->
Resolved/Waived/Rejected -> Closed/Reopened`

### Configuration

`Draft -> Validated -> Review Pending -> Approved -> Scheduled -> Active ->
Superseded/Rolled Back`

### Audit package

`Requested -> Generating -> Completed/Failed -> Expired`

Rules:

- only authorized server commands may change state;
- every transition records actor, timestamp, reason, evidence, policy version,
  and record version;
- terminal records cannot be directly edited;
- corrections use reopen, reversal, revision, or supersession;
- customers may configure routing and approvals but not redefine the core state
  model during Phase 2.

## 15. Receiving and inspection

Implement cumulative, line-level receiving across multiple receipts.

Track:

- ordered;
- received;
- pending inspection;
- accepted;
- damaged;
- rejected;
- returned;
- remaining.

Required behavior:

- zero over-receipt by default;
- authorized exception required above configured tolerance;
- quantities pending inspection or quarantine do not enter available inventory
  or invoice eligibility;
- accepted quantities drive inventory and invoice matching;
- partial, complete, exception, returned, and administratively closed states;
- under-receipt closure requires a reason and authority;
- photos and documents;
- serial and lot metadata where applicable;
- duplicate-receipt detection using PO, packing slip, carrier, quantity, and
  date signals;
- controlled unit-of-measure validation and conversion;
- return-to-vendor and replacement tracking;
- service-purchase milestone or service-acceptance support;
- unexpected/no-PO delivery logging and routing, without making it payable;
- corrections through reversal rather than destructive editing;
- internal inventory transfers remain distinct from supplier receipts.

Native mobile scanning is deferred, but core receiving must remain usable on a
mobile browser.

## 16. Invoice matching and exceptions

Support:

- two-way matching;
- three-way matching;
- service acceptance;
- multiple receipts per purchase order;
- multiple invoices per purchase order;
- partial, final, credit, and corrected invoices.

Compare at line level:

- item;
- description;
- quantity;
- unit of measure;
- unit price;
- tax;
- freight;
- discounts/fees;
- total.

Required controls:

- configurable absolute and percentage tolerances;
- zero default tolerance;
- contract and purchase-order price comparison;
- exact and probable duplicate detection;
- controlled non-PO invoice intake, blocked pending exception and coding;
- cumulative ordered, received, accepted, invoiced, credited, and remaining
  quantities/amounts;
- vendor active status, tax/compliance status, and payment-instruction checks;
- accounting-period, GL, cost-center, and department validation;
- typed exception, severity, owner, age, due date, evidence, and resolution;
- payment hold while unresolved;
- distinct match, exception, approval, and payment-readiness authority;
- side-by-side evidence;
- immutable matching snapshots;
- versioned tolerance policy recorded on every result;
- within-tolerance auto-match may occur only under approved policy and may not
  bypass required payment approval;
- correction through credit, reversal, void, or supersession.

Phase 2 does not execute payment. It produces a permission-controlled,
auditable payment-readiness result and simulated/exportable handoff.

## 17. Notifications, queues, reminders, and escalations

Phase 2 channels:

- in-app notifications and authoritative work queues;
- transactional email adapter, simulated and labeled in the demo.

Do not implement SMS, Teams, Slack, or mobile push.

Events include:

- new assignments;
- approvals;
- returns and rejections;
- exceptions;
- document failures;
- receiving discrepancies;
- invoice mismatches;
- contract and policy deadlines.

Required behavior:

- business-day and tenant-timezone calculations;
- due, overdue, and escalation intervals;
- escalation to assignee, delegate, manager, and process owner;
- immediate critical notices;
- lower-priority digest capability;
- mandatory control notices separated from optional preferences;
- quiet hours where allowed;
- authenticated deep links;
- no sensitive email detail;
- persistent outbox;
- deduplication;
- retries and dead-letter state;
- visible failed-delivery handling;
- complete audit history.

The notification is not the source of truth. The workflow queue is.
Critical notices may require acknowledgment and rerouting when unacknowledged
or undeliverable.

## 18. CATE

### 18.1 Identity

Use the name consistently:

**CATE - Catalyst AI for Trusted Evaluation**

Pronunciation: "Kate"

Tagline:

**Evidence-backed intelligence for every procurement decision.**

Replace prior assistant names in active UI, prompts, narration, evidence panels,
documentation, and tests. Preserve historical references only when clearly
historical and useful.

### 18.2 Authority boundary

CATE may:

- evaluate;
- explain;
- summarize;
- compare;
- cite;
- identify risk or mismatch;
- recommend a next action;
- draft content for human review.

CATE may not independently:

- approve;
- reject;
- select a supplier;
- issue a purchase order;
- accept a receipt;
- waive an exception;
- change a policy;
- grant access;
- mark an invoice payment-ready;
- execute payment.

### 18.3 Required answer contract

Every material CATE answer must include:

- recommendation or finding;
- supporting facts;
- exact citations;
- applicable policy and version;
- assumptions;
- missing or conflicting information;
- confidence band with a reason;
- risks and alternatives;
- recommended next action;
- clear separation between CATE's recommendation and the human decision.

Do not invent precise confidence percentages unless they have been calibrated
and validated. Do not expose hidden chain-of-thought. Provide a concise,
evidence-based rationale.

CATE must refuse to conclude when evidence is insufficient or conflicting.
CATE must never expose evidence the current user cannot independently access.

### 18.4 Provider controls

Use OpenAI as the single primary Phase 2 provider:

- server-side API calls only;
- environment-specific project credentials;
- schema-validated structured outputs;
- provider storage disabled where supported;
- Catalyst-controlled prompts, evidence, and state;
- no persistent provider conversation as the authoritative record;
- evaluated and pinned model versions;
- separate approval and regression evaluation before model changes;
- timeouts, rate limits, cost budgets, and usage monitoring;
- no automatic fallback to another AI provider;
- no fine-tuning or voluntary data sharing in Phase 2;
- raw prompts excluded from ordinary logs;
- provider, model, prompt, schema, evidence, latency, token use, and cost
  recorded for every material evaluation.

Do not claim Zero Data Retention unless it has been formally enabled and
verified. Record and disclose the actual provider retention configuration.

### 18.5 Quality and governance

Evaluate:

- groundedness;
- citation precision and completeness;
- numerical accuracy;
- policy compliance;
- consistency;
- false positives and false negatives;
- latency;
- cost;
- refusal quality;
- permission isolation.

Maintain:

- representative golden cases;
- regression tests;
- adversarial and prompt-injection tests;
- cross-tenant access tests;
- drift monitoring;
- override and correction tracking;
- accept, reject, and modify feedback with reasons and outcomes.

CATE must not retrain or change behavior automatically from feedback.

When CATE or its provider is unavailable, deterministic business rules and the
core workflow must remain operational. The demonstration must include a
presentation-safe deterministic CATE fallback that is visibly labeled.

## 19. Analytics and world-class KPI design

### 19.1 KPI contract

Every KPI must have:

- business question;
- classification as outcome, driver, or guardrail;
- exact formula;
- grain;
- numerator and denominator;
- inclusions and exclusions;
- owner;
- data source and lineage;
- refresh cadence;
- data freshness;
- coverage;
- target;
- target owner and approval;
- effective date and version;
- action threshold;
- paired guardrail;
- drilldown path.

Do not invent external benchmarks. Use approved synthetic demonstration targets
and label them as demo targets. Target changes are versioned and must not
rewrite history.

### 19.2 Required KPI experience

Each primary KPI must show:

- current value;
- target;
- absolute and percentage variance;
- trend;
- forecast where supported;
- primary drivers;
- freshness;
- data coverage;
- data-quality warning;
- an action playbook;
- clickable drilldown to the contributing records.

Preserve filter context through:

- date;
- fiscal period;
- department;
- location;
- category;
- vendor;
- contract;
- status;
- owner.

Provide role-specific KPI sets rather than a single generic dashboard.
Support personal and shared saved views. Include accessible tables for every
chart.

### 19.3 Minimum certified KPI catalog

Outcome KPIs:

- addressable spend under management;
- policy-compliant spend rate;
- contract-covered spend rate;
- accepted and realized savings, kept separate from identified savings;
- inventory-reuse cost avoidance;
- requisition-to-order cycle time;
- on-time, in-full accepted delivery rate;
- first-pass invoice match rate;
- exception value at risk;
- supplier risk exposure;
- contract-renewal exposure.

Driver KPIs:

- requisition completeness rate;
- approval queue age and bottleneck contribution;
- competitive-sourcing coverage;
- supplier-response coverage;
- purchase-order acknowledgment time;
- receipt posting and inspection latency;
- invoice extraction-review age;
- mismatch rate by root cause;
- exception resolution time;
- document/evidence completeness.

Guardrail KPIs:

- emergency and maverick spend;
- single-source award rate;
- split-purchase risk;
- post-approval change rate;
- over-receipt exception rate;
- tolerance-based auto-match rate;
- savings reversal rate;
- high-risk supplier exposure;
- data-quality and freshness failure rate;
- CATE recommendation override and correction rate.

The demonstration dataset must make these measures mathematically coherent and
must support diagnostic navigation:

`KPI -> driver -> contributing record -> exact evidence`

Dashboard, register, export, and audit-package totals must reconcile.

## 20. Audit history, exports, and packages

Provide permission-controlled exports and one-action audit packages for a
transaction, vendor, purchase order, invoice, period, or demonstration case.

An audit package contains:

- executive/readable PDF summary;
- CSV record extracts;
- machine-readable JSON manifest;
- approval and workflow history;
- overrides and exceptions;
- policy and configuration versions;
- CATE findings, citations, confidence, and human decisions;
- supporting document versions;
- cryptographic hashes;
- generation timestamp and "as of" boundary;
- package version and parent package reference;
- redaction and access metadata.

Required controls:

- role and scope filtering;
- redaction;
- watermarking;
- signed, expiring download;
- extra confirmation for bulk or sensitive exports;
- export-request and download audit events;
- reproducible "as of" output;
- immutable completed package;
- corrections create a new package version;
- clear generating, completed, failed, and expired states;
- background generation, progress, retry, and failure handling.

## 21. Financial, quantity, and time integrity

- Never use floating-point numbers for money.
- Preserve original amount, ISO currency, precision, and rounded amount.
- Use documented rounding rules consistently.
- Preserve source values when normalized values are calculated.
- Configure one tenant base currency while remaining multi-currency-ready.
- Record exchange-rate source, rate, effective date, and version.
- Treat taxes, freight, discounts, credits, and fees as distinct values.
- Use controlled, versioned units of measure and conversion factors.
- Prevent comparisons between incompatible quantities or currencies.
- Store system timestamps in UTC.
- Display time in the authorized tenant/user timezone.
- Keep business date, accounting date, receipt date, and event timestamp
  distinct.
- Apply the configured fiscal calendar consistently.
- Perform authoritative calculations server-side.
- Use immutable internal IDs and separate display/document numbers.
- Effective-date master-data changes instead of rewriting history.
- Audit every normalization, conversion, rounding, and correction.

Phase 2 preserves and validates supplied tax information. It is not a tax
calculation engine.

## 22. UX and accessibility standard

- Each role lands on an action-focused work queue.
- Every record shows status, owner, next action, due date, and blockers.
- Terminology and status definitions remain consistent across modules.
- Use progressive disclosure.
- Support draft saving, safe resume, duplicate prevention, and unsaved-change
  protection.
- Show clear previews before approvals, overrides, reversals, imports, and
  configuration changes.
- Validation messages explain how to resolve the issue.
- Design loading, empty, delayed, partial, failed, and permission-denied states.
- Show source, freshness, policy version, and demo/live indicators.
- Global search must honor tenant, role, and scope.
- Provide contextual policy help.
- Support desktop and tablet fully.
- Keep receiving usable on a mobile browser.
- Meet WCAG 2.2 AA for core workflows.
- Support keyboard and screen-reader use.
- Provide accessible chart alternatives.
- High-risk actions require explicit confirmation and consequence preview.
- Users can provide structured correction feedback on CATE findings.

## 23. Security and privacy baseline

Release requirements:

- encryption in transit and at rest;
- OWASP ASVS Level 2 baseline;
- strict secret handling and rotation;
- rate limiting;
- schema/input validation;
- CSRF protection where applicable;
- secure headers and content-security policy;
- automated source, dependency, and vulnerability scanning;
- software bill of materials;
- tamper-evident audit events;
- sensitive-data redaction in logs;
- document and prompt-injection defenses;
- no customer data used to train CATE or external models;
- explicit provider/subprocessor and retention disclosure;
- defined vulnerability-remediation and incident-response timelines;
- tested tenant isolation, revocation, restoration, and evidence preservation;
- security exceptions require owner, reason, expiration, and risk acceptance.

Do not claim SOC 2, ISO, regulatory certification, or customer endorsement
before independently earned and formally approved.

## 24. Reliability and operational resilience

Pilot-ready validation targets:

- 99.5% monthly availability target, excluding announced maintenance;
- 15-minute recovery point objective;
- four-hour recovery time objective;
- standard reads under two seconds at p95;
- standard workflow commands under three seconds at p95;
- analytics drilldowns under five seconds at p95;
- immediate progress feedback for CATE, uploads, imports, and exports;
- standard CATE responses within 15 seconds at p95;
- longer work becomes an asynchronous task.

Operational safeguards:

- centralized logs, metrics, traces, health checks, and alerts;
- idempotent jobs;
- retries and dead-letter handling;
- no silent notification, import, export, or background-job loss;
- core workflows continue if CATE, email, scanner, or export services fail;
- automated backups and tested restoration;
- severity-based incident response;
- capacity, error, latency, queue, and storage monitoring;
- safe deployment rollback.

These are validation targets for the architecture, not current customer SLAs.

## 25. Capacity validation envelope

Until real pilot volumes exist, validate against:

- 100 named users;
- 25 concurrently active users;
- 25,000 vendors;
- 250,000 procurement workflow records;
- 1,000,000 transaction line items;
- 100,000 documents or 250 GB;
- 100,000 import rows per batch;
- 250,000 export rows through asynchronous generation;
- several million audit events;
- twice the normal concurrency target during load/resilience testing.

This envelope requires:

- pagination;
- indexed queries;
- chunked processing;
- aggregate reporting structures;
- storage monitoring.

It does not justify microservices or premature distributed architecture.

## 26. Implementation order

### Slice 1 - Foundations

- environment configuration;
- migrations;
- tenant model;
- authoritative demo identity;
- RBAC, scopes, RLS, and audit foundation;
- server command and error contracts.

### Slice 2 - Configuration

- configuration center;
- policy versions;
- simulation;
- safe defaults;
- feature flags;
- configuration audit.

### Slice 3 - Data and documents

- master data;
- import staging and validation;
- reconciliation;
- private Storage;
- document metadata, lifecycle, versioning, and evidence links.

### Slice 4 - Request to purchase order

- request;
- approval;
- sourcing;
- vendor evaluation;
- human selection;
- purchase order;
- revisions.

### Slice 5 - Receiving

- partial receipt;
- inspection;
- damage/rejection;
- discrepancies;
- return/replacement;
- reversals;
- inventory acceptance boundary.

### Slice 6 - Invoice

- invoice intake;
- line matching;
- tolerance policy;
- duplicate detection;
- exceptions;
- resolution;
- payment readiness and export.

### Slice 7 - Work queues and notifications

- role queues;
- outbox;
- in-app notices;
- simulated email;
- reminders;
- escalation;
- acknowledgments.

### Slice 8 - CATE

- evidence model;
- structured outputs;
- citations;
- policy context;
- feedback;
- evaluation suite;
- deterministic fallback;
- AI audit and cost records.

### Slice 9 - KPIs and analytics

- certified metric registry;
- role scorecards;
- filters;
- drilldowns;
- diagnostic waterfalls;
- data quality;
- saved views.

### Slice 10 - Audit packages and hardening

- exports;
- manifests and hashes;
- package versions;
- security hardening;
- accessibility;
- performance;
- resilience;
- demo reset;
- complete presenter verification.

Each slice must be testable and leave the application usable. Do not defer all
integration or testing to the end.

## 27. Verification strategy

Use requirement-to-test traceability rather than a vanity coverage percentage.

Required:

- unit tests for deterministic rules and calculations;
- positive and negative role/scope tests;
- direct database RLS tests;
- state-transition tests;
- property and boundary tests for money, quantity, tolerance, and approval
  rules;
- integration tests for transactions, Storage, outbox, and jobs;
- end-to-end role workflows;
- concurrency and duplicate-submission tests;
- idempotency and reversal tests;
- migration and import reconciliation tests;
- export reproducibility tests;
- document and cross-tenant security tests;
- CATE groundedness, citation, numerical, policy, permission, regression, and
  adversarial evaluations;
- KPI golden datasets with independently verified results;
- accessibility, responsive, browser, and keyboard tests;
- performance, load, degradation, rollback, and restoration exercises;
- synthetic test data outside an explicitly authorized production tenant;
- zero flaky critical tests;
- no waived failure without documented, expiring risk acceptance.

Customer UAT is a future pilot activation gate and cannot substitute for
engineering verification.

## 28. Streamlit boundary

Streamlit remains a deterministic emergency presentation fallback.

Allowed Streamlit work:

- update active assistant naming to CATE;
- update truth and synthetic-data disclosures;
- preserve or repair the deterministic primary story;
- preserve reset, stage-jump, and presenter fallback behavior;
- keep tests passing.

Do not:

- recreate the Supabase backend in Python;
- connect Streamlit to real customer or production data;
- duplicate Phase 2 authentication, document, notification, KPI, or workflow
  systems;
- present Streamlit as the Phase 2 production architecture.

## 29. Explicit Phase 2 exclusions

Defer:

- bidirectional ERP/accounting/WMS integrations;
- payment execution and banking;
- purchasing cards;
- supplier self-service portal;
- unrestricted external uploads;
- electronic signatures;
- contract authoring;
- native mobile application;
- barcode/RFID scanning;
- SMS, Teams, Slack, and push channels;
- public API and webhook marketplace;
- SSO and SCIM;
- unrestricted workflow, form, KPI, and report builders;
- full tax engine;
- general ledger;
- full inventory-management/WMS capability;
- autonomous purchasing, approval, supplier selection, exception waiver, or
  payment decisions;
- automatic AI behavior changes;
- multi-region production deployment;
- customer-managed encryption keys;
- certification claims.

Safe extension points may be created, but partial hidden implementations are
out of scope.

## 30. Acceptance matrix

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| P2-001 | Synthetic/demo truth boundary | Persistent demo disclosure; no real-company implication; live/simulated labels verified |
| P2-002 | Repeatable demo | One-action reset restores the exact approved dataset and story |
| P2-003 | Supabase authority | Material Next.js records persist in Postgres; browser state is not authoritative |
| P2-004 | Tenant isolation | Positive/negative RLS tests prove no cross-tenant access |
| P2-005 | RBAC and scopes | Every persona has allowed and denied action tests; browser role tampering fails |
| P2-006 | Separation of duties | Conflicting approval, receipt, and invoice actions are blocked and audited |
| P2-007 | Configuration governance | Versioned draft, validation, simulation, approval, activation, and rollback work |
| P2-008 | Imports | Staging, mapping, validation, totals, approval, posting, lineage, and reversal reconcile |
| P2-009 | Documents | Private versioned files, signed access, lifecycle, citations, and audit controls work |
| P2-010 | Request-to-PO | Primary request, approval, sourcing, selection, PO, and revision path completes |
| P2-011 | Receiving | Partial/damaged receipt, inspection, accepted inventory, return, and reversal reconcile |
| P2-012 | Invoice matching | Line-level two/three-way match, duplicate detection, tolerance, and exceptions work |
| P2-013 | Payment boundary | Payment readiness can be produced; no payment is executed or falsely implied |
| P2-014 | Notifications | Authoritative queues, outbox, dedupe, retry, escalation, and simulated email labels work |
| P2-015 | CATE identity | Active UI, prompts, narration, docs, and tests use CATE consistently |
| P2-016 | CATE evidence | Material findings contain citations, policy, assumptions, confidence band, and next action |
| P2-017 | CATE authority | CATE cannot perform protected human decisions |
| P2-018 | CATE resilience | Deterministic fallback works and is visibly labeled |
| P2-019 | KPI certification | Every displayed KPI has a versioned definition, formula, owner, target, freshness, and lineage |
| P2-020 | KPI drilldown | Every primary KPI reaches contributing records while preserving filter context |
| P2-021 | KPI reconciliation | Dashboard, detail, export, and audit-package totals match golden data |
| P2-022 | Audit package | PDF, CSV, JSON manifest, evidence versions, hashes, and approvals generate reproducibly |
| P2-023 | Financial integrity | Money, rounding, UOM, currency, dates, corrections, and totals pass boundary tests |
| P2-024 | UX states | Loading, empty, failed, delayed, partial, and denied states are designed and tested |
| P2-025 | Accessibility | Core workflows meet WCAG 2.2 AA verification and keyboard/screen-reader checks |
| P2-026 | Security | ASVS-aligned checklist, scans, secret controls, RLS tests, and exception register pass |
| P2-027 | Reliability | Jobs, retries, dead letters, degradation, backup restore, and rollback are demonstrated |
| P2-028 | Performance | Agreed p95 targets pass within the synthetic validation envelope |
| P2-029 | Primary demo story | The 12-15 minute story completes without manual data repair or unexplained presenter intervention |
| P2-030 | Streamlit boundary | Streamlit remains a labeled deterministic fallback and contains no production backend duplication |
| P2-031 | Scope control | Deferred features are absent or clearly labeled as nonfunctional future capability |
| P2-032 | Documentation | Architecture, runbook, demo script, known limitations, release evidence, and test map are current |

## 31. Demo release gate

Phase 2 is demo-ready only when:

- every primary workflow passes role-based end-to-end verification;
- tenant isolation and permission-denial tests pass;
- all synthetic financial and quantity totals reconcile;
- no unresolved critical or high-severity security defect exists;
- every material approval, exception, override, document, and CATE finding is
  auditable;
- backup restoration and rollback have been exercised;
- core workflows meet the accessibility standard;
- performance targets are demonstrated against the validation envelope;
- the primary story can be reset and completed repeatedly;
- the Streamlit fallback remains operational;
- known limitations are visible and documented;
- no simulated behavior is presented as live.

## 32. Future paid-pilot activation gates

These are intentionally not demo blockers. They become mandatory before real
customer data or users:

- named customer executive, process, data, security, and access owners;
- written RACI and backups;
- actual user/access roster;
- approved policy, tolerance, fiscal, currency, retention, and escalation
  values;
- real data mapping and migration signoff;
- privacy, subprocessor, retention, and legal review;
- customer UAT and written acceptance;
- production support hours, severity definitions, and response commitments;
- real email/scanning/OCR/integration activation;
- customer-approved KPI baselines and targets;
- 30-, 60-, and 90-day success reviews;
- production-conversion, extension, and exit criteria.

## 33. Required handoff at completion

Provide:

- requirement-to-file map;
- migration inventory;
- environment and secret inventory without secret values;
- test traceability matrix;
- security and known-risk register;
- KPI definition catalog;
- CATE evaluation report;
- demo script and fallback procedure;
- reset procedure;
- deployment and rollback runbook;
- backup/restore evidence;
- limitations and deferred-scope register;
- concise release summary with exact verification results.
