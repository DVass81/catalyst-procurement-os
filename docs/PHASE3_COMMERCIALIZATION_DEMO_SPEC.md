# Catalyst Procurement OS - Phase 3 Commercialization Demo Specification

Status: Approved planning baseline
Planning confidence: 96%
Program: Audit Phase 3 - broader-commercialization demonstration
Target: Advanced, prospect-ready demonstration with pilot-ready architecture
Primary application: Next.js + Supabase
Deployment target: DigitalOcean App Platform
AI identity: CATE - Catalyst AI for Trusted Evaluation
Tagline: Evidence-backed intelligence for every procurement decision.
Baseline release: `0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0`

## 1. Instruction to Codex

Implement Audit Phase 3 according to this specification only after the product
owner explicitly authorizes implementation.

Before changing application code:

1. Read `AGENTS.md`.
2. Read the relevant installed Next.js documentation in
   `node_modules/next/dist/docs/`. This repository explicitly warns that the
   installed Next.js version contains breaking changes and must not be
   implemented from memory.
3. Read `docs/PHASE2_DEMO_READINESS_SPEC.md` completely.
4. Read this specification completely.
5. Inspect the current working tree and preserve all user changes.
6. Treat commit `0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0` as the approved deployed baseline unless a newer
   baseline is explicitly designated.
7. Produce a requirement-to-file implementation map before editing code.
8. Identify reusable Phase 1 and Phase 2 behavior before creating new systems.
9. Implement in the ordered increments in section 29.
10. Verify each increment and its exit gate before beginning the next.
11. Keep the application deployable and the existing demonstration usable
    throughout implementation.

Do not:

- rewrite the application without a demonstrated need;
- duplicate an existing domain model, workflow engine, policy control, audit
  mechanism, or deterministic fallback;
- connect to real customer systems or ingest real customer data;
- claim that a simulated capability is live;
- weaken Phase 1 credibility controls or Phase 2 readiness controls;
- allow CATE to perform protected human decisions;
- add a visible control that is dead, misleading, or unexplained;
- mark Phase 3 complete until every applicable acceptance requirement passes.

## 2. Program identity and terminology

This document describes the remediation program called "Audit Phase 3" in the
Final Product Audit.

The repository also contains historical documents named Phase 3 and Phase 4
that describe earlier guided-demo and live-concierge work. Those historical
labels do not change the scope of this program.

Use the following terms in planning and release records:

- Audit Phase 1: demonstration credibility remediation;
- Audit Phase 2: paid-pilot readiness demonstrated with synthetic data;
- Audit Phase 3: broader-commercialization capabilities demonstrated with
  synthetic data and controlled simulations;
- pilot activation: a future, separately authorized customer implementation;
- production activation: a future go-live using approved customer data,
  identities, integrations, controls, and support commitments.

When ambiguity is possible, call this program the "Phase 3 Commercialization
Demo."

## 3. Relationship to Phase 2

Phase 3 extends Phase 2. It does not replace it.

All applicable requirements in `docs/PHASE2_DEMO_READINESS_SPEC.md` remain
mandatory, including:

- synthetic-data truth;
- tenant isolation;
- server-enforced authorization;
- separation of duties;
- governed policies and configuration;
- document versioning and evidence lineage;
- request-to-purchase-order integrity;
- partial receiving and invoice matching;
- CATE evidence and authority boundaries;
- certified KPI definitions and drilldowns;
- audit packages;
- financial, quantity, and time integrity;
- accessibility;
- security;
- reliability;
- deterministic reset;
- deployment verification;
- explicit pilot-activation gates.

If this document introduces a stricter requirement, the stricter requirement
controls. If the documents appear to conflict, stop and resolve the conflict
with the product owner before implementation.

## 4. Mission

Transform Catalyst Procurement OS from a controlled advanced demonstration
into a commercialization-quality sales experience that can credibly show how
the platform will support larger, more complex organizations.

Phase 3 must:

- preserve one connected procurement story rather than becoming a collection
  of disconnected screens;
- demonstrate integration, identity, supplier, contract, mobile, workflow,
  reporting, security, accessibility, and operations capabilities;
- keep all customer and business information synthetic;
- make live, functional, simulated, preview, and future capabilities
  distinguishable;
- prove that every material recommendation, decision, status, and KPI can be
  traced to evidence;
- present CATE as a governed advisor;
- demonstrate enterprise control without pretending that an enterprise
  customer implementation already exists;
- remain repeatable, recoverable, and presentation-safe;
- create clear activation paths for a future design partner or pilot.

Phase 3 is an advanced commercialization demonstration. It is not:

- a live customer pilot;
- a production customer environment;
- a payment system;
- a legal-advice product;
- an independently certified security or accessibility environment;
- proof of realized customer savings;
- a promise of a production SLA.

## 5. Phase 3 success definition

Phase 3 succeeds when a serious prospect can see:

1. How Catalyst connects supplier, contract, request, approval, receipt,
   invoice, integration, reporting, and audit evidence.
2. How it prevents or visibly controls unsafe procurement decisions.
3. How CATE explains findings without taking human authority.
4. How enterprise capabilities would be configured and activated.
5. How the product behaves when information is incomplete or a provider fails.
6. How the demonstration distinguishes proof from simulation.
7. How the team would move from sales demonstration to a controlled pilot.

The prospect must not need to overlook contradictory data, unexplained
controls, misleading integrations, broken routes, or unsupported claims.

## 6. Demonstration Truth Standard

### 6.1 Capability statuses

Every material capability must use exactly one of these statuses:

| Status | Meaning |
| --- | --- |
| Live | Connected to a real provider or deployed service and verified during the current release |
| Functional Demo | Working application behavior using approved synthetic data |
| Simulated Integration | Interactive representation of an external system with no real customer connection |
| Concept Preview | Visual or explanatory preview without complete functional behavior |
| Future Activation | Planned capability or customer-specific activation requirement |

Do not create synonyms that blur these categories.

### 6.2 Capability registry

Maintain one authoritative capability registry containing:

- capability identifier;
- name and description;
- owning module;
- status;
- implementation evidence;
- data source;
- provider dependency;
- customer dependency;
- security and privacy considerations;
- known limitations;
- activation requirements;
- release first verified;
- last verification result;
- owner.

The registry must drive or reconcile with labels shown in the interface,
presenter script, evidence package, and release manifest.

### 6.3 Persistent disclosures

The application must disclose that:

- the organization and all business records are fictional or expressly
  approved for demonstration use;
- business data is synthetic;
- simulated integrations do not connect to customer systems;
- illustrative service targets are not contractual SLAs;
- security and accessibility results are internal unless an independent
  assessment is actually completed;
- savings, risks, forecasts, and outcomes belong to the synthetic scenario.

Disclosures must be present in:

- the demonstration entry experience;
- the "How this demonstration works" panel;
- integration connection screens;
- CATE evidence panels where simulation affects an answer;
- report and evidence-package footers;
- presenter notes.

### 6.4 Prohibited claims

The demonstration, CATE, presenter script, reports, and exports must not claim:

- a simulated connector is certified, installed, or live;
- customer data has been analyzed when it has not;
- identified synthetic savings are realized customer savings;
- an internal check is an independent penetration test;
- internal accessibility testing is a certification;
- a provider health check proves full production readiness;
- the product supplies 24/7 support or a contractual SLA;
- CATE made a protected decision;
- a concept preview is completed functionality;
- a prospect endorses or uses Catalyst without written authorization.

### 6.5 Simulated-action audit

Every simulated external action must:

- state that it is simulated before confirmation;
- generate a simulation-specific result;
- create an audit event tagged `simulation`;
- identify the adapter and scenario version;
- avoid language such as "sent," "paid," "provisioned," or "connected" unless
  the action actually occurred;
- preserve its simulation label in exports.

## 7. Demonstration fidelity boundary

### 7.1 Fully functional

The following must be functional in the primary Next.js application:

- capability truth registry and labels;
- versioned synthetic tenant and deterministic reset;
- persona and authority enforcement;
- canonical integration staging, mapping, validation, reconciliation, retry,
  replay, and audit;
- interactive SSO configuration templates and mapping previews;
- supplier self-service onboarding within the synthetic tenant;
- supplier review, remediation, approval, suspension, expiration, and
  recertification states;
- contract upload, versioning, extraction, citation, obligation, and conflict
  workflows using approved synthetic documents;
- responsive mobile approval and receiving experiences;
- controlled workflow design, validation, simulation, versioning, approval,
  activation, supersession, and rollback;
- governed report library and report studio;
- certified metrics and source-record drillthrough;
- CATE evidence-cited reporting narratives;
- Security and Trust Center;
- Accessibility Assurance Center;
- Operations Center;
- Golden Thread presenter experience;
- release evidence manifest.

### 7.2 Live where configured and verified

The following may be labeled Live only when currently configured and verified:

- DigitalOcean application deployment and health;
- Supabase Auth, Postgres, Row Level Security, and private Storage;
- OpenAI responses;
- ElevenLabs voice sessions;
- Google draft or calendar behavior that genuinely occurs;
- any other provider explicitly approved and tested.

Live provider failure must not make the primary demonstration unusable.

### 7.3 Simulated but interactive

The following are simulated for Phase 3 unless separately authorized:

- ERP and accounting connections;
- SFTP or file-drop partner systems;
- enterprise identity-provider login;
- SCIM provisioning;
- sanctions, debarment, financial, cyber, or background data providers;
- supplier banking verification;
- malware scanning when no approved scanner is connected;
- production OCR when no approved OCR provider is connected;
- barcode or QR hardware scanning;
- outbound scheduled report distribution;
- support-channel delivery;
- production alert delivery;
- payment-system handoff.

The Catalyst-side behavior around these simulations must still be functional.

### 7.4 Concept previews

Concept previews are permitted only when:

- they are not part of the Golden Thread;
- the preview status is visible before interaction;
- the screen explains what is and is not implemented;
- no success confirmation implies an external action occurred;
- the capability registry contains the limitation.

## 8. Commercialization Golden Thread

### 8.1 Primary story

Use one connected 18-22 minute story:

1. An executive opens a prospect-branded synthetic tenant.
2. Reporting identifies off-contract spend, supplier risk, and a contract
   deadline.
3. CATE explains the evidence, assumptions, and recommended investigation.
4. A synthetic supplier responds to an onboarding invitation.
5. The onboarding process finds missing, expired, or risky information.
6. An authorized reviewer requests remediation or grants a controlled status.
7. Contract intelligence extracts a cancellation deadline, price-escalation
   limit, and obligation from a cited synthetic agreement.
8. A purchase request is evaluated against supplier, contract, budget, policy,
   and inventory evidence.
9. A controlled workflow routes the transaction to the correct roles.
10. An assigned approver reviews and acts from the mobile web experience.
11. Receiving records a partial, damaged, rejected, or quarantined delivery.
12. Invoice matching identifies the connected discrepancy.
13. The Integration Center stages and reconciles the synthetic ERP/accounting
    records.
14. Reporting Studio produces an executive report pack.
15. CATE explains the principal drivers and unresolved questions with citations.
16. Trust, accessibility, and operations evidence demonstrate how the product
    is controlled and supported.

Every amount, quantity, identifier, supplier, contract, status, deadline, and
decision must remain consistent throughout the story.

### 8.2 Optional audience paths

Provide focused optional paths for:

- executives and finance leaders;
- chief procurement officers and buyers;
- accounts payable;
- contract and supplier managers;
- IT and integration teams;
- security and compliance reviewers;
- accessibility reviewers;
- auditors;
- operations and support leaders.

Each path must reuse the same authoritative synthetic scenario.

### 8.3 Presenter experience

Presenter Mode must provide:

- visible Presenter Mode status;
- scene navigation;
- recommended timing;
- persona switching;
- approved talking points;
- proof points and evidence links;
- limitation reminders;
- fallback instructions;
- deterministic reset;
- preflight results;
- provider-mode indicators;
- no hidden mutation that ordinary users could mistake for production behavior.

### 8.4 Post-demonstration package

Generate a prospect-safe package containing:

- executive scenario summary;
- capability truth registry excerpt;
- selected report pack;
- selected evidence and citations;
- security, accessibility, and operations overview;
- known limitations;
- pilot-activation outline;
- no secret, credential, internal-only finding, or unapproved personal data.

## 9. Persona and authority model

### 9.1 Required personas

| Persona | Primary responsibilities | Protected boundaries |
| --- | --- | --- |
| Executive | Enterprise performance, risks, contracts, assigned high-value approvals | Cannot alter source transactions merely to change a KPI |
| Procurement Administrator | Policies, workflows, supplier governance, integration configuration | Cannot bypass approval or approve own configuration where independent review is required |
| Buyer | Sourcing, requests, supplier comparisons, purchase-order preparation | Cannot self-approve or override blocked suppliers without the required exception |
| Requester | Create requests and view authorized records | Cannot select unauthorized suppliers, approve, receive, or resolve invoices |
| Approver | Act on assigned decisions within authority | Cannot edit the underlying request to manufacture approval eligibility |
| Contract Manager | Validate clauses, obligations, renewals, and amendments | CATE extraction is not accepted without authorized validation |
| Receiver | Record receipts, inspection, damage, rejection, quarantine, and returns | Cannot approve purchasing or resolve financial exceptions outside scope |
| Accounts Payable Analyst | Resolve invoice exceptions and determine payment readiness | Cannot execute payment |
| Supplier User | Maintain the supplier organization's own onboarding and remediation records | Cannot view another supplier or internal procurement data |
| Auditor/Security Reviewer | Read evidence, controls, incidents, and audit history | Read-only except for review comments and finding disposition where assigned |

### 9.2 Authority dimensions

Store and enforce these dimensions separately:

- tenant membership;
- role;
- department scope;
- location scope;
- category scope;
- record ownership;
- approval authority;
- workflow assignment;
- sensitive-field permission;
- configuration permission;
- presenter permission.

Do not collapse these dimensions into one browser-provided role string.

### 9.3 Separation of duties

At minimum:

- a requester cannot approve the request;
- a workflow author cannot self-activate protected workflow changes;
- a supplier user cannot approve supplier status;
- a contract extractor cannot self-validate a material clause when independent
  review is configured;
- a buyer cannot receive goods on behalf of a restricted receiving role;
- a receiver cannot resolve an invoice exception requiring Finance;
- an AP analyst cannot execute payment;
- a banking change requires independent verification and dual approval;
- CATE cannot satisfy any human approval requirement.

### 9.4 Presenter persona switching

Presenter switching must:

- be unavailable outside Presenter Mode;
- display the active persona persistently;
- identify the switch as a demonstration action;
- create an audit event;
- preserve tenant isolation;
- reset or re-evaluate visible permissions after a switch;
- never be described as production impersonation.

### 9.5 CATE access

CATE may retrieve only information the active tenant and persona may access.
Citations, summaries, exports, and narratives must apply the same row- and
field-level restrictions as the underlying records.

## 10. Architecture principles

Use a modular monolith unless measured evidence justifies a different design.

### 10.1 Primary stack

- Next.js for the primary application;
- Supabase Auth for application identity;
- Supabase Postgres for authoritative business records;
- Row Level Security for exposed tenant data;
- private Supabase Storage for documents;
- server-side provider adapters;
- durable audit, integration, workflow, report, and incident records;
- deterministic local or seeded provider adapters for demonstration fallback.

### 10.2 Authoritative boundaries

- The browser is never the authority for permission, status, totals, or audit.
- Protected state transitions occur on the server.
- Postgres is authoritative for material persisted records.
- CATE is advisory and cannot directly mutate protected records.
- External adapters cannot overwrite a record without mapping, source,
  version, and conflict controls.
- Every material action has one correlation identifier across business,
  integration, CATE, and audit records.

### 10.3 Shared platform services

Create or extend shared services for:

- tenant context;
- identity and authorization;
- canonical identifiers;
- capability truth;
- configuration and policy versions;
- document versions and evidence citations;
- integration runs and reconciliation;
- workflow definitions and instances;
- certified metrics;
- audit events;
- CATE evaluations;
- notifications and work queues;
- incidents and support cases;
- release evidence.

Do not implement a separate data model inside each Phase 3 screen.

### 10.4 Safety defaults

The default behavior must:

- deny unauthorized access;
- block incomplete high-risk actions;
- require human confirmation for protected actions;
- refuse to imply an external action occurred when it did not;
- preserve the prior valid configuration when activation fails;
- preserve the prior live deployment when a release fails;
- enter deterministic fallback when a provider is unavailable;
- log the failure without exposing secrets.

## 11. Canonical integration platform

### 11.1 Strategy

Use a canonical-first integration architecture.

Catalyst owns a stable canonical procurement model. Each external system uses
an adapter that maps between its representation and the canonical model.

Do not put vendor-specific fields directly into core procurement workflows
unless they are isolated extension data.

### 11.2 Reference connection

The first functional reference flow must support secure file-style exchange:

- CSV input and output;
- an interactive SFTP or file-drop simulation;
- versioned mapping templates;
- control totals;
- validation;
- preview;
- approval;
- posting;
- reconciliation;
- retry;
- replay;
- reversal or supersession;
- full audit.

### 11.3 Inbound entities

Support synthetic inbound demonstrations for:

- organizations;
- users and role references;
- departments;
- locations;
- cost centers;
- general-ledger references;
- suppliers;
- items and categories;
- contracts and budgets;
- open purchase orders;
- receipts;
- invoices.

### 11.4 Outbound entities

Support synthetic outbound demonstrations for:

- approved purchase orders;
- accepted receipts;
- resolved invoice exceptions;
- payment-readiness records;
- reconciliation results;
- audit references.

No payment is executed.

### 11.5 Integration record contract

Every integrated record must preserve:

- tenant identifier;
- source system;
- source entity and identifier;
- canonical entity and identifier;
- mapping version;
- source timestamp;
- ingestion timestamp;
- delta cursor or batch identifier;
- content hash where appropriate;
- lineage;
- status;
- validation findings;
- conflict decision;
- reconciliation result;
- actor or service identity;
- correlation identifier.

### 11.6 Reliability controls

Integration runs must support:

- idempotency;
- duplicate detection;
- partial failure;
- bounded retry;
- dead-letter state;
- replay from a safe checkpoint;
- out-of-order data;
- stale-data detection;
- conflict detection;
- control-total mismatch;
- rejected-row export;
- correction and reprocessing;
- run-level and record-level audit.

### 11.7 Source of truth

Define the source of truth per entity and field group.

The system must prevent:

- bidirectional synchronization loops;
- silent last-write-wins replacement;
- untraceable manual correction;
- one external identifier mapping to multiple active canonical records;
- one canonical record mapping to conflicting active source records without an
  explicit relationship.

### 11.8 ERP and accounting simulators

Provide clearly labeled templates for representative ERP/accounting patterns.
The templates may reference common product categories, but must not imply
vendor certification.

The simulator must allow the prospect to see:

- connection configuration;
- credential placeholders without values;
- entity selection;
- mapping;
- test data;
- validation;
- sync history;
- reconciliation;
- failure and retry;
- activation requirements.

The first real vendor adapter will be selected with a future design partner.

## 12. Enterprise SSO demonstration

### 12.1 Scope

Provide an interactive but simulated enterprise SSO configuration experience.

Include templates for:

- Microsoft Entra ID;
- Okta;
- generic SAML 2.0.

Do not claim certified or live SSO unless a real provider is configured and
verified.

### 12.2 Configuration experience

Demonstrate:

- organization domain discovery;
- identity-provider metadata;
- entity and callback identifiers;
- certificate metadata without exposing secret material;
- attribute mapping;
- group-to-role mapping;
- default role;
- tenant and scope mapping;
- test-connection scenario;
- login presentation preview;
- access review;
- configuration audit;
- activation checklist.

### 12.3 Authority

Enterprise SSO proves identity. Catalyst database roles, scopes, tenant
membership, and approval authority remain authoritative for application
authorization.

Do not accept identity-provider claims as unrestricted procurement authority.

### 12.4 Emergency access

Document and demonstrate an emergency local-access policy:

- limited approved accounts;
- strong authentication;
- monitored use;
- time-bounded review;
- no shared credentials;
- full audit;
- clear customer activation requirements.

### 12.5 SCIM

SCIM provisioning may be a Future Activation capability. If previewed, show:

- create, update, suspend, and deprovision concepts;
- group and role mapping;
- conflict handling;
- last synchronization;
- dry-run results.

Do not simulate active provisioning with misleading success messages.

## 13. Advanced supplier onboarding

### 13.1 Lifecycle

Use this controlled lifecycle:

1. Invited
2. In Progress
3. Submitted
4. Automated Validation
5. Internal Review
6. Information Required
7. Approved, Conditionally Approved, or Rejected
8. Active
9. Suspended or Expired
10. Recertification

State transitions must be authorized and audited.

### 13.2 Supplier experience

The supplier user must be able to manage only the supplier organization's:

- legal and trade identity;
- ownership;
- contacts;
- categories;
- locations;
- tax-document placeholders or synthetic documents;
- insurance;
- diversity classifications;
- cybersecurity responses;
- compliance attestations;
- banking-document placeholders or synthetic documents;
- certifications;
- supporting evidence;
- remediation responses.

No real bank, tax, personal, or confidential supplier data is required.

### 13.3 Validation

Demonstrate:

- required-field validation;
- document type and version;
- expiration dates;
- renewal reminders;
- duplicate supplier detection;
- duplicate tax or banking identifier scenarios using synthetic identifiers;
- simulated sanctions and debarment checks;
- simulated conflict-of-interest checks;
- simulated cyber and risk checks;
- contradictory response detection;
- incomplete evidence;
- risk-based routing.

### 13.4 Internal review

Support separate purchasing, compliance, finance, security, and category review
where configured.

Reviewers must be able to:

- approve within authority;
- conditionally approve;
- request information;
- reject;
- suspend;
- set remediation;
- record evidence and rationale;
- assign expiration or recertification.

### 13.5 CATE

CATE may:

- extract document facts;
- identify gaps or contradictions;
- summarize risk evidence;
- explain required remediation;
- propose a risk tier;
- cite source evidence.

CATE may not:

- approve the supplier;
- make a final compliance determination;
- verify banking ownership;
- waive a required control.

### 13.6 Banking-change control

Banking changes must:

- be treated as high sensitivity;
- avoid exposing complete account values in the demonstration;
- require independent verification;
- require dual approval;
- preserve old and proposed values safely;
- create a complete audit trail;
- never initiate payment.

### 13.7 Required scenarios

Demonstrate:

- one successful onboarding;
- one blocked or information-required onboarding;
- one document-expiration or recertification event;
- one attempted unauthorized supplier access.

## 14. Contract-document intelligence

### 14.1 Document lifecycle

Support:

- upload of approved synthetic documents;
- private storage;
- versioning;
- amendments;
- effective and superseded versions;
- document hashes;
- extraction status;
- validation status;
- evidence citations;
- access audit.

Do not include contract authoring or electronic signature in Phase 3.

### 14.2 Extraction targets

Extract and cite:

- term and effective dates;
- renewal and cancellation deadlines;
- auto-renewal;
- price-escalation language;
- insurance requirements;
- service levels;
- rebates and volume terms;
- minimum commitments;
- audit rights;
- security and privacy requirements;
- termination provisions;
- notice requirements;
- owners and responsible parties.

Every extracted finding must link to:

- exact document version;
- page;
- clause or bounded passage;
- extraction method;
- confidence;
- validation status.

### 14.3 Obligation model

Each obligation must include:

- contract;
- supplier;
- clause;
- owner;
- due date;
- recurrence;
- status;
- evidence;
- completion or exception;
- reminder and escalation;
- audit history.

### 14.4 Connected intelligence

Link contracts to:

- suppliers;
- sourcing events;
- purchase requests;
- purchase orders;
- receipts where relevant;
- invoices;
- spend;
- commitments;
- savings;
- supplier performance;
- renewal and negotiation queues.

### 14.5 Conflict detection

Demonstrate:

- amendment comparison;
- contract-price versus purchase-order-price conflict;
- contract-price versus invoice-price conflict;
- price escalation above the contractual limit;
- spend against a minimum or maximum commitment;
- approaching notice deadline;
- missing obligation evidence.

### 14.6 CATE boundary

CATE may extract, summarize, compare, cite, and recommend investigation.

CATE must:

- distinguish text from interpretation;
- disclose low confidence;
- identify conflicting clauses;
- require human validation for material findings;
- avoid legal conclusions;
- avoid accepting or rejecting a contract.

### 14.7 Hero scenario

The Golden Thread must show:

- an approaching cancellation or renewal notice deadline;
- a proposed price increase above the contractual limit;
- cited source clauses;
- assigned human action;
- connected spend or invoice impact.

## 15. Mobile approvals and receiving

### 15.1 Delivery model

Phase 3 uses responsive mobile web. Native applications are out of scope.

The critical experience must work in:

- a real mobile browser where available;
- an iPhone/Safari validation configuration;
- an Android/Chrome validation configuration;
- keyboard and zoom testing;
- portrait and landscape where meaningful.

### 15.2 Mobile approvals

Provide:

- assigned queue;
- request summary;
- amount and budget effect;
- supplier and contract context;
- policy findings;
- risk;
- prior decisions and comments;
- supporting evidence;
- CATE explanation;
- approve;
- reject;
- return;
- request information;
- required rationale;
- delegation and escalation where permitted;
- step-up confirmation for material actions;
- audit confirmation.

Do not use unauthenticated approval links.

### 15.3 Mobile receiving

Provide:

- purchase-order lookup;
- simulated barcode or QR input where applicable;
- line selection;
- partial receipt;
- accepted quantity;
- damaged quantity;
- rejected quantity;
- quarantine;
- packing-slip evidence;
- photo evidence using approved synthetic media;
- serial, lot, or inspection fields where applicable;
- discrepancy reason;
- return-to-vendor initiation;
- receiver confirmation;
- visible inventory and invoice-match effect.

### 15.4 Simulation labels

Hardware scanning and offline operation may be simulated only when visibly
labeled.

The transaction state changes around the simulation must still be real within
the synthetic tenant.

## 16. Configurable workflows

### 16.1 Product boundary

Provide a governed template-based workflow designer.

Do not provide:

- arbitrary code execution;
- unrestricted API calls;
- unrestricted BPMN;
- hidden scripts;
- SQL;
- controls that can remove mandatory separation of duties.

### 16.2 Workflow families

Support:

- purchase approvals;
- supplier onboarding;
- invoice exceptions;
- contract renewals and obligations.

### 16.3 Approved building blocks

- start and end;
- condition;
- sequential approval;
- parallel approval;
- specialist review;
- request information;
- timer;
- reminder;
- escalation;
- notification;
- CATE advisory step;
- return;
- reject;
- exception.

### 16.4 Approved conditions

Conditions may use governed fields such as:

- amount;
- category;
- department;
- location;
- budget result;
- supplier risk;
- supplier status;
- contract status;
- sole-source indicator;
- document completeness;
- exception severity.

### 16.5 Lifecycle

Use:

1. Draft
2. Validate
3. Simulate
4. Review and Approve
5. Schedule
6. Activate
7. Supersede
8. Roll Back

### 16.6 Validation

Detect:

- cycles;
- dead ends;
- unreachable steps;
- missing owners;
- invalid conditions;
- missing escalation;
- separation-of-duties conflicts;
- removal of protected controls;
- ambiguous outcomes;
- unsupported fields;
- version conflicts.

### 16.7 Version behavior

- Active records retain the workflow version under which they began unless an
  authorized migration is explicitly approved.
- New records use the active effective version.
- Version comparison must show material changes.
- Impact preview must identify affected future transactions.
- Rollback creates a new controlled version or restores an approved prior
  version without rewriting history.

### 16.8 CATE

CATE may suggest:

- missing conditions;
- likely bottlenecks;
- unusual routing;
- control conflicts;
- test scenarios.

CATE cannot activate, approve, or silently modify a workflow.

### 16.9 Hero scenario

The demonstration must add executive and compliance review for a high-value
request involving a high-risk supplier, validate the design, simulate it, gain
configuration approval, activate it, and route a new synthetic transaction.

## 17. Advanced reporting

### 17.1 Product boundary

Provide a governed Catalyst Reporting Studio, not an unrestricted generic
business-intelligence builder.

Users may select approved measures, dimensions, filters, comparisons,
visualizations, and layouts.

Do not provide:

- SQL;
- arbitrary formulas;
- custom code;
- cross-tenant joins;
- direct editing of reported values;
- unapproved external benchmarks.

### 17.2 Report library

Include:

- executive procurement performance;
- spend, commitment, and budget;
- savings realization;
- supplier performance and risk;
- contract renewal and obligation;
- approval and cycle-time bottlenecks;
- receiving, quality, and delivery;
- invoice match, exception, and AP readiness;
- audit, control, and compliance;
- integration and reconciliation health.

### 17.3 Certified semantic model

Every measure must have:

- identifier;
- name;
- business definition;
- formula;
- grain;
- dimensions;
- owner;
- source;
- refresh or as-of rule;
- target;
- comparison rules;
- exclusions;
- version;
- effective dates;
- data-quality checks;
- lineage.

Do not change historical meaning by editing a definition in place.

### 17.4 Required report capabilities

- role-based report library;
- default useful view before interaction;
- filtering;
- grouping;
- sorting;
- calendar and fiscal comparisons without mixing them;
- charts and detailed tables;
- drillthrough to authorized source records;
- preserved filter context;
- personal and shared saved views;
- snapshots and as-of reporting;
- annotations;
- variance explanations;
- report versioning;
- report approval where configured;
- PDF, XLSX, and CSV output;
- scheduled-distribution preview clearly labeled as simulated;
- accessible table equivalents.

### 17.5 KPI presentation

Material KPIs must show, where meaningful:

- current result;
- target;
- variance;
- trend;
- forecast;
- principal drivers;
- freshness;
- coverage;
- definition;
- data-quality warning;
- action threshold;
- linked action.

Keep identified, accepted, and realized savings separate.

### 17.6 CATE reporting narrative

CATE may:

- summarize certified metrics;
- identify material drivers;
- explain unusual variance;
- identify missing information;
- recommend investigation;
- draft executive commentary;
- cite metrics and source records.

CATE must:

- separate fact from inference;
- identify the as-of date;
- identify synthetic information;
- avoid invented benchmarks;
- avoid changing numbers;
- avoid claiming causal certainty without evidence.

### 17.7 Performance

Use governed pre-aggregation or asynchronous export where needed.

The interface must communicate:

- report state;
- refresh state;
- partial or stale data;
- export progress;
- failure;
- retry;
- cancellation.

### 17.8 Hero scenario

An executive identifies elevated off-contract spend, drills into categories,
suppliers, and transactions, asks CATE to explain the drivers, and generates an
evidence-backed executive report pack.

## 18. CATE governance

### 18.1 Identity

CATE means:

> Catalyst AI for Trusted Evaluation

Pronunciation: Kate.

Use the identity consistently in active Phase 3 interface text, prompts,
documentation, narration, exports, and tests.

Legacy names may appear only in historical records or migration documentation.

### 18.2 Authority

CATE may:

- retrieve authorized evidence;
- structure information;
- normalize documents;
- identify gaps;
- calculate approved deterministic formulas;
- explain policies and contracts;
- compare options;
- recommend investigation or action;
- draft nonbinding summaries.

CATE may not:

- approve;
- reject;
- award;
- activate;
- issue;
- receive;
- waive;
- suspend;
- execute payment;
- send a binding communication;
- change a banking record;
- make a final legal or compliance determination.

### 18.3 Evidence contract

Every material CATE output must contain:

- task;
- factual findings;
- evidence citations;
- applicable policy, contract, workflow, or metric definition;
- assumptions;
- missing information;
- confidence band and reason;
- risks;
- alternatives where material;
- required human action;
- active provider mode;
- truth status;
- as-of time;
- evaluation version;
- correlation identifier.

### 18.4 Provider resilience

- Live provider use is server-side.
- Provider credentials never reach the browser.
- Approved data-minimization and retention settings apply.
- Deterministic fallback remains available.
- The active mode is visible.
- Timeout, rate limit, malformed output, refusal, and provider outage are
  handled safely.
- Fallback never claims that a live model generated the response.

### 18.5 Evaluation

Maintain a versioned synthetic evaluation set covering:

- supplier onboarding;
- supplier risk;
- contract clauses;
- workflow suggestions;
- approval context;
- receiving discrepancies;
- invoice exceptions;
- KPI narratives;
- prompt injection;
- unsupported legal or autonomous-action requests;
- cross-tenant access attempts.

## 19. Security and Trust Center

### 19.1 Positioning

The Trust Center reports implemented controls and internal validation.

It must distinguish:

- Implemented;
- Internally Tested;
- Planned;
- Customer Configuration Required;
- Independent Validation Required.

Do not display certification badges or independent-testing claims without
evidence.

### 19.2 Threat model

Cover:

- tenant isolation;
- supplier-portal isolation;
- authentication and sessions;
- role and scope enforcement;
- privileged administration;
- workflow and approval abuse;
- integrations and webhooks;
- document upload and parsing;
- exports;
- mobile use;
- CATE prompt injection and tool misuse;
- secrets;
- logs and evidence;
- provider failure;
- support access.

### 19.3 Internal validation

Include:

- static code analysis;
- dependency analysis;
- secret scanning;
- software bill of materials;
- license review where required;
- tenant-isolation tests;
- Row Level Security tests;
- role and scope tests;
- separation-of-duties tests;
- session and authentication tests;
- API authorization tests;
- malicious-upload tests;
- document-parser abuse tests;
- prompt-injection and data-exfiltration tests;
- CATE protected-action tests;
- rate-limit tests;
- replay and idempotency tests;
- webhook-signature tests;
- export-access tests;
- audit-completeness and tamper-evidence tests;
- backup and restoration evidence where applicable.

Use a current internally approved security checklist and record its version.

### 19.4 Findings register

Every finding must include:

- identifier;
- affected control and asset;
- severity;
- evidence;
- exploit or failure scenario;
- owner;
- remediation;
- due date;
- retest;
- residual risk;
- acceptance authority;
- release impact.

### 19.5 Hero scenario

Demonstrate an attempted cross-tenant access or unauthorized CATE action that
is blocked, audited, investigated, and linked to the applicable control and
validation evidence.

## 20. Accessibility Assurance Center

### 20.1 Target

Use WCAG 2.2 Level AA as the Phase 3 internal target.

This is an internal validation target. Do not claim independent certification,
publish a conformance badge, or issue a VPAT or Accessibility Conformance Report
without appropriate review and authorization.

### 20.2 Critical-route testing

Test:

- entry and authentication;
- primary navigation;
- supplier onboarding;
- contract intelligence;
- workflow configuration;
- mobile approval;
- mobile receiving;
- integration mapping and reconciliation;
- Reporting Studio;
- CATE evidence;
- Trust Center;
- Operations Center;
- reset and fallback.

### 20.3 Manual verification

Include:

- keyboard-only completion;
- logical focus order;
- visible focus;
- focus not obscured;
- modal focus containment and restoration;
- headings and landmarks;
- skip navigation;
- labels and descriptions;
- forms, errors, and instructions;
- accessible authentication;
- screen-reader names, roles, values, and status announcements;
- contrast;
- forced colors where supported;
- no color-only meaning;
- zoom and text spacing;
- reflow;
- reduced motion;
- touch-target size;
- alternatives to dragging;
- tables;
- chart equivalents;
- loading, empty, failed, and denied states;
- timeouts and session warnings where applicable.

### 20.4 Test configurations

At minimum, record results for:

- Windows with a supported browser and NVDA;
- macOS or iOS with Safari and VoiceOver;
- Android with Chrome and the approved screen-reader configuration where
  available;
- keyboard-only desktop use;
- mobile touch and zoom.

### 20.5 Findings

The Accessibility Assurance Center must record:

- success criterion;
- route and component;
- browser, device, and assistive technology;
- test steps;
- expected result;
- actual result;
- evidence;
- severity;
- owner;
- remediation;
- retest;
- known limitation.

### 20.6 Hero scenario

Complete an approval using keyboard and screen reader, then open the accessible
table corresponding to a visual report.

## 21. Operations Center and support procedures

### 21.1 Positioning

The Operations Center demonstrates how Catalyst would be monitored and
supported.

It must distinguish:

- live application or provider telemetry;
- functional synthetic application events;
- simulated integration or support events;
- illustrative service objectives;
- future production commitments.

### 21.2 Monitoring domains

Monitor or simulate clearly:

- application availability;
- route and API latency;
- error rate;
- deployment;
- database;
- authentication;
- tenant-isolation validation;
- integration runs;
- mapping failures;
- reconciliation;
- retries and dead letters;
- background jobs;
- data freshness and completeness;
- CATE provider mode;
- CATE failure and fallback;
- AI and voice usage and cost controls;
- document processing;
- email and calendar providers;
- security events;
- incidents;
- unresolved support cases.

### 21.3 Alert lifecycle

Use:

1. Detected
2. Triaged
3. Acknowledged
4. Assigned
5. Mitigating
6. Monitoring
7. Resolved
8. Reviewed

Alerts must include severity, impact, owner, timestamps, evidence, correlation,
runbook, customer-communication status, and resolution.

### 21.4 Support cases

Demonstrate:

- intake;
- tenant;
- requester;
- priority;
- impact;
- category;
- affected record;
- evidence;
- assignment;
- status;
- internal notes;
- approved external response preview;
- escalation;
- resolution;
- linked incident or release.

Do not claim actual support hours or response commitments that have not been
approved.

### 21.5 Runbooks

Maintain tested runbooks for:

- demonstration preflight;
- demonstration reset;
- provider outage;
- deterministic fallback;
- failed integration;
- control-total mismatch;
- authentication failure;
- SSO configuration problem;
- document-processing failure;
- data-integrity failure;
- suspected tenant exposure;
- prompt injection;
- deployment failure;
- rollback;
- backup restoration;
- security incident;
- accessibility-blocking defect.

### 21.6 Observability

Use:

- structured logs;
- metrics;
- trace or correlation identifiers;
- job and integration run identifiers;
- deployment identifiers;
- redaction;
- defined retention;
- role-controlled access;
- no secrets;
- no unnecessary prompt or document content.

### 21.7 Hero scenario

Simulate an ERP synchronization or AI-provider failure:

- detect it;
- alert the owner;
- preserve the workflow;
- enter safe fallback;
- show the runbook;
- resolve or contain the issue;
- create a complete incident record.

## 22. Synthetic data and scenario governance

### 22.1 Data standard

Use realistic but fictional:

- organizations;
- users;
- suppliers;
- identities;
- addresses;
- tax and banking placeholders;
- products;
- budgets;
- contracts;
- purchasing records;
- receipts;
- invoices;
- documents;
- support cases;
- incidents;
- security findings;
- accessibility findings;
- integrations;
- KPIs.

Do not copy real prospect data into the synthetic tenant without explicit
written authorization.

### 22.2 Coherence

The dataset must preserve:

- stable identifiers;
- referential integrity;
- one session clock;
- correct fiscal and calendar logic;
- correct currency and rounding;
- unit-of-measure consistency;
- supplier eligibility consistency;
- contract and pricing consistency;
- approval authority consistency;
- quantity and financial reconciliation;
- realistic history;
- valid role and tenant relationships.

### 22.3 Scenario set

Maintain at least:

- primary Golden Thread;
- successful supplier onboarding;
- blocked supplier onboarding;
- contract renewal and price conflict;
- workflow configuration and activation;
- mobile approval;
- receiving discrepancy;
- invoice exception;
- integration mismatch and retry;
- CATE fallback;
- unauthorized access;
- security incident;
- accessibility demonstration;
- operations incident.

### 22.4 Version and reset

Every approved dataset must have:

- version;
- schema version;
- content hash;
- effective release;
- scenario descriptions;
- expected KPI totals;
- expected record counts;
- expected Golden Thread outcomes.

Reset must restore the exact approved state without changing the session's
approved demonstration date unless the reset contract explicitly requires it.

## 23. Data, financial, and audit integrity

### 23.1 Reconciliation

Reconcile:

- request;
- supplier evaluation;
- contract price;
- award;
- purchase order;
- receipt;
- accepted inventory;
- invoice;
- exception;
- integration export;
- budget;
- commitment;
- savings;
- KPI;
- report;
- audit package.

### 23.2 Time

Use one authoritative demonstration clock for:

- overdue status;
- contract deadlines;
- insurance expiration;
- workflow timers;
- escalations;
- reports;
- as-of labels;
- incident times;
- provider freshness.

### 23.3 Audit event

Every material event must identify:

- tenant;
- actor or service;
- active persona;
- action;
- record type and identifier;
- before and after state where appropriate;
- reason;
- source;
- capability truth status;
- simulation flag;
- policy, contract, workflow, or metric version;
- evidence;
- correlation identifier;
- time.

### 23.4 Corrections

Do not rewrite material history.

Use:

- reversal;
- correction;
- supersession;
- amendment;
- controlled reprocessing;
- versioned recalculation.

## 24. User experience and navigation

### 24.1 Navigation

Preserve clear business groupings:

- Workspace;
- Procure to Pay;
- Suppliers and Agreements;
- Intelligence;
- System.

Add Phase 3 capabilities without turning the sidebar into a feature inventory.

Use:

- role-aware navigation;
- active-page state;
- breadcrumbs on record detail;
- universal search where implemented;
- recent records;
- favorites or saved views where useful;
- mobile navigation;
- understandable empty and denied states.

### 24.2 Density

- Primary views tell the story before exposing large registers.
- Default registers show a deliberate useful subset.
- Pagination or virtualization supports the larger dataset.
- Urgent and assigned work is prioritized.
- Complete-data controls are available when demonstrating search or scale.
- Large tables remain accessible and responsive.

### 24.3 Status language

Do not expose raw database values.

Every status must have:

- customer-facing label;
- definition or tooltip where needed;
- text and icon, not color alone;
- consistent semantic severity;
- consistent use across screen, report, export, and audit.

### 24.4 State design

Design and test:

- loading;
- empty;
- delayed;
- partial;
- stale;
- failed;
- retrying;
- blocked;
- denied;
- read-only;
- simulated;
- concept preview;
- provider fallback.

## 25. Environment and deployment model

### 25.1 Environments

Maintain separate intent for:

- development;
- staging or release-candidate validation;
- production demonstration.

If separate infrastructure is not yet available, use explicit configuration,
data, access, and release controls to prevent environment ambiguity.

### 25.2 Production demonstration

The production demonstration must:

- use approved deployment configuration;
- use server-only secrets;
- expose no debug control to ordinary users;
- use restricted access where configured;
- use the approved synthetic tenant;
- use explicit provider modes;
- support health checks;
- preserve prior deployment rollback;
- prevent indexing;
- use safe cache controls;
- provide deterministic fallback.

### 25.3 Deployment proof

A release is not verified merely because a health endpoint returns 200.

Verify:

- exact Git commit;
- exact DigitalOcean deployment;
- deployment success;
- live deployment designation;
- health endpoint;
- release-specific application markers;
- critical route;
- runtime error state;
- rollback target.

### 25.4 Secrets

Maintain an inventory of required secret names without secret values.

Verify that secrets do not appear in:

- Git;
- source maps;
- browser bundles;
- HTML;
- network response bodies;
- logs;
- screenshots;
- reports;
- exports;
- support packages.

## 26. Verification strategy

### 26.1 Test layers

Use:

- pure domain unit tests;
- schema and validation tests;
- authorization tests;
- Row Level Security tests;
- data-integrity tests;
- integration-adapter contract tests;
- workflow-definition and workflow-instance tests;
- document citation tests;
- CATE evaluation tests;
- API integration tests;
- critical-route end-to-end tests;
- accessibility automation;
- manual accessibility tests;
- security scans and abuse tests;
- responsive and mobile tests;
- performance tests;
- deployment smoke tests;
- rehearsal scripts.

### 26.2 Critical routes

At minimum:

- entry and identity;
- persona enforcement;
- supplier onboarding success;
- supplier onboarding block and remediation;
- contract extraction and validation;
- workflow design and activation;
- Golden Thread request;
- mobile approval;
- receiving discrepancy;
- invoice exception;
- integration reconciliation and retry;
- executive reporting;
- CATE evidence;
- security scenario;
- accessibility scenario;
- operations incident;
- reset;
- provider fallback;
- deployment verification.

### 26.3 Negative tests

Test:

- cross-tenant access;
- wrong supplier access;
- browser role tampering;
- self-approval;
- authority limit;
- protected workflow removal;
- unapproved workflow activation;
- stale workflow version;
- duplicate import;
- control-total mismatch;
- out-of-order import;
- unauthorized export;
- unsupported file;
- malicious file;
- prompt injection;
- CATE protected action;
- inaccessible critical control;
- provider timeout;
- failed deployment;
- stale report data.

### 26.4 Requirement traceability

Maintain:

- requirement identifier;
- implementation files;
- database objects;
- test identifiers;
- manual evidence;
- release result;
- owner;
- known limitation.

No acceptance requirement may be marked complete without evidence.

## 27. Performance budgets

These are Phase 3 demonstration-condition targets, not public SLAs.

| Experience | Target |
| --- | ---: |
| Key route navigation | 2.5 seconds or less |
| Deterministic protected action response | 1 second or less |
| Deterministic reset | 5 seconds or less |
| Standard report-pack generation | 10 seconds or less |
| Safe provider fallback | 10 seconds or less |

Measure:

- deployed production demonstration;
- approved presentation device;
- approved presentation network;
- defined synthetic dataset;
- warm and cold behavior where material;
- repeated runs;
- p50 and p95 where enough samples exist.

If a target is not met:

- identify the bottleneck;
- preserve functional correctness;
- show an honest progress state;
- document the approved exception;
- do not silently lower the target after testing.

## 28. Severity and release-blocking rules

### Critical

Examples:

- tenant or supplier data exposure;
- secret exposure;
- unauthorized protected action;
- payment or binding external action;
- corrupted financial integrity;
- misleading live or certification claim;
- Golden Thread cannot complete and no safe fallback exists.

Critical findings always block release.

### High

Examples:

- a primary route fails;
- supplier or contract control can be bypassed;
- a material report does not reconcile;
- a critical accessibility route cannot be completed;
- provider failure breaks the demonstration;
- deployment cannot be verified or rolled back.

High findings block release.

### Medium

Examples:

- a noncritical path is confusing or incomplete;
- a recoverable error lacks ideal guidance;
- a secondary report has a documented limitation.

Medium findings require an owner, due date, limitation disclosure, and explicit
release acceptance.

### Low

Examples:

- minor visual inconsistency;
- nonblocking copy or spacing issue.

Low findings require tracking but do not automatically block release.

Severity cannot be lowered merely to pass a release gate.

## 29. Ordered implementation increments

### Increment 0 - Phase 3 foundation

Implement:

- capability truth registry;
- versioned synthetic dataset;
- canonical identifiers;
- shared audit-event model;
- feature flags and simulation controls;
- deterministic reset and integrity validation.

Exit gate:

- existing demonstration still passes;
- Phase 3 foundation is present but safely disabled where incomplete;
- no truth label is fabricated.

### Increment 1 - Integration Center

Implement:

- canonical procurement model extensions;
- file-based reference adapter;
- ERP/accounting simulators;
- mapping;
- validation;
- reconciliation;
- retry, replay, dead letter, and audit.

Exit gate:

- synthetic inbound and outbound records reconcile completely;
- duplicate, mismatch, and retry scenarios pass.

### Increment 2 - Enterprise access and suppliers

Implement:

- Entra, Okta, and generic SAML templates;
- domain, attribute, and role mapping;
- supplier invitation and self-service onboarding;
- document validation;
- risk checks;
- remediation;
- supplier status lifecycle.

Exit gate:

- successful and blocked onboarding paths pass;
- supplier isolation passes;
- SSO screens remain truthfully simulated.

### Increment 3 - Contract intelligence

Implement:

- contract and amendment versioning;
- clause extraction;
- citations;
- obligations;
- deadline, price, and commitment intelligence;
- human validation.

Exit gate:

- every material extraction traces to exact synthetic evidence;
- conflict and deadline scenarios pass.

### Increment 4 - Workflow and mobile execution

Implement:

- controlled workflow designer;
- validation and simulation;
- approval, activation, supersession, and rollback;
- mobile approval;
- mobile receiving and discrepancies.

Exit gate:

- a newly approved workflow controls a new synthetic transaction;
- mobile approval and receiving pass target-device checks.

### Increment 5 - Reporting and CATE

Implement:

- certified semantic and KPI catalog;
- governed Reporting Studio;
- drillthrough;
- report packs;
- CATE evidence-cited reporting narratives.

Exit gate:

- reports reconcile with records and exports;
- CATE separates fact, inference, limitation, and next action.

### Increment 6 - Trust and operations

Implement:

- Security and Trust Center;
- Accessibility Assurance Center;
- Operations Center;
- alerts, incidents, support cases, and runbooks;
- security, accessibility, and provider-failure scenarios.

Exit gate:

- all three centers contain traceable evidence;
- blocked-access and provider-failure scenarios pass.

### Increment 7 - Commercialization experience

Implement:

- prospect-safe branding;
- Golden Thread;
- Presenter Mode;
- approved scene navigation;
- truth labels;
- preflight;
- reset;
- fallback;
- post-demonstration package.

Exit gate:

- three consecutive deployed rehearsals complete without manual data repair.

### Increment 8 - Release qualification

Complete:

- full automated and manual validation;
- performance budgets;
- target-device tests;
- security and accessibility review;
- DigitalOcean deployment and rollback verification;
- evidence manifest;
- internal sign-offs;
- release freeze.

Exit gate:

- every release gate in section 30 passes.

## 30. Release and acceptance gates

Phase 3 is demo-ready only when:

- the Golden Thread completes from a clean reset;
- three consecutive deployed rehearsals succeed;
- a failed rehearsal restarts the three-run count after correction;
- every material amount, quantity, identifier, status, and deadline reconciles;
- reset reproduces the approved data version and expected outcomes;
- no dead control, broken link, misleading label, unexplained placeholder, or
  uncontrolled primary dependency remains;
- every material capability has the correct truth status;
- lint, typecheck, unit, integration, end-to-end, production build, and
  deployment checks pass;
- no unresolved Critical or High security finding exists;
- no known WCAG Level A or AA failure exists on a critical route;
- tenant, role, supplier, upload, CATE, export, and audit abuse tests pass;
- no secret is exposed;
- performance budgets pass or have an explicitly accepted noncritical
  exception;
- mobile approval and receiving pass approved device configurations;
- report totals reconcile with records and exports;
- exact Git commit and DigitalOcean live deployment are verified;
- rollback and deterministic fallback are verified;
- known limitations are current and visible;
- the evidence manifest is complete;
- required internal sign-offs are recorded.

## 31. Rehearsal protocol

Each rehearsal must record:

- release identifier;
- dataset version and hash;
- start and end;
- presenter;
- device;
- browser;
- network condition;
- provider modes;
- every Golden Thread scene result;
- fallback event;
- defect or delay;
- final integrity result;
- pass or fail.

Rehearsals must use the deployed release candidate, not only a local build.

## 32. Release evidence manifest

Every approved release must contain:

- Git commit;
- branch;
- DigitalOcean app and deployment identifiers;
- deployment status;
- release time;
- capability truth registry version;
- synthetic dataset version and hash;
- requirement-to-file map;
- test results;
- manual validation evidence;
- three rehearsal records;
- performance results;
- security findings and retests;
- accessibility findings and retests;
- CATE evaluation result;
- integration reconciliation result;
- report reconciliation result;
- environment and provider status;
- known limitations;
- rollback target;
- fallback instructions;
- demo script;
- approved claim language;
- sign-offs.

Store no secret values in the manifest.

## 33. Sign-offs

Record approval by responsibility:

- Product: scope, truth status, scenario, and claims;
- Engineering: implementation, tests, build, deployment, and rollback;
- Security: internal findings and residual risk;
- Accessibility: critical-route validation and limitations;
- Presenter: story, timing, fallback, and recovery.

One person may hold multiple responsibilities initially, but each sign-off
remains explicit.

## 34. Release freeze

For an important prospect demonstration:

- freeze the approved release candidate 48 hours before the meeting;
- freeze the synthetic dataset and presenter script;
- prohibit routine features and refactors;
- permit only genuine demonstration-blocking fixes;
- run the complete validation suite after an emergency change;
- repeat the Golden Thread rehearsal after an emergency change;
- update the evidence manifest;
- start a new 48-hour freeze when practical.

## 35. Explicit Phase 3 exclusions

Exclude:

- live customer ERP or accounting credentials;
- unrestricted bidirectional synchronization;
- payment execution;
- production banking verification;
- real supplier tax, bank, insurance, or personal information;
- real prospect confidential data without authorization;
- live customer SSO or SCIM unless separately approved;
- customer-data migration;
- legal conclusions;
- autonomous contract acceptance;
- autonomous supplier approval;
- autonomous workflow activation;
- autonomous purchasing or payment decisions;
- native iOS or Android applications;
- guaranteed offline operation;
- unrestricted workflow code;
- unrestricted APIs;
- unrestricted SQL or report formulas;
- custom code in reports;
- cross-tenant analytics;
- e-signature;
- contract authoring;
- public supplier marketplace;
- connector certification claims;
- independent security-testing claims without an assessment;
- accessibility certification claims;
- SOC 2 or other certification claims;
- contractual production SLAs;
- 24/7 support claims;
- multi-region disaster-recovery claims;
- unverified customer outcomes;
- unverified realized savings.

Safe extension points may be built. Partial hidden implementations must not be
presented as complete.

## 36. Future pilot-activation gates

Before any real customer user, credential, document, or business record is
introduced, require:

1. Signed scope and approved use cases.
2. Named executive, process, data, security, identity, integration, and support
   owners.
3. RACI and backup owners.
4. Security, privacy, legal, and data-processing approval.
5. Approved subprocessors and retention.
6. Customer tenant and environment plan.
7. Actual access roster.
8. Identity-provider metadata and approved role mapping.
9. Integration-system selection and sandbox credentials.
10. Data dictionary, mapping, quality rules, and reconciliation.
11. Customer policies, tolerances, workflows, calendars, currencies, and
    escalation values.
12. Customer-specific KPI definitions, baselines, and targets.
13. Migration and rollback plan.
14. Customer user-acceptance testing.
15. Tenant-isolation, authorization, integration, security, accessibility, and
    performance testing.
16. Training and support procedures.
17. Incident, backup, restoration, and disaster-recovery procedures.
18. Production support hours and severity commitments.
19. External security or accessibility review where required.
20. Formal pilot-readiness approval.

These are intentionally not Phase 3 demonstration blockers.

## 37. Acceptance matrix

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| P3-001 | Phase terminology | Active planning and release records distinguish Audit Phase 3 from historical repository phases |
| P3-002 | Phase 2 inheritance | Applicable Phase 2 requirements remain mapped, tested, and passing |
| P3-003 | Demonstration truth statuses | Live, Functional Demo, Simulated Integration, Concept Preview, and Future Activation are used consistently |
| P3-004 | Capability registry | Every material capability has versioned status, evidence, limitation, owner, and activation requirement |
| P3-005 | Synthetic disclosure | Entry, evidence, integration, report, export, and presenter materials disclose synthetic or simulated behavior |
| P3-006 | Prohibited claims | Claim review finds no false live, certification, SLA, customer-data, realized-savings, or autonomous-action statement |
| P3-007 | Simulated actions | Simulated actions are disclosed, safely executed, and tagged in audit |
| P3-008 | Golden Thread | The complete 18-22 minute connected story passes from reset |
| P3-009 | Cross-story reconciliation | All Golden Thread identifiers, amounts, quantities, statuses, contracts, suppliers, and dates reconcile |
| P3-010 | Presenter Mode | Scene, timing, persona, truth, fallback, reset, and preflight controls work and are visibly presenter-only |
| P3-011 | Post-demo package | Prospect-safe package generates without secrets, private findings, or misleading claims |
| P3-012 | Persona matrix | Every persona has purposeful views, allowed actions, and denied-action tests |
| P3-013 | Authority dimensions | Tenant, role, scope, ownership, authority, sensitive-field, and presenter permissions are independently enforced |
| P3-014 | Separation of duties | Self-approval and conflicting protected actions are blocked and audited |
| P3-015 | Supplier isolation | Supplier users cannot access another supplier or internal unauthorized data |
| P3-016 | Presenter switching | Switching is presenter-only, visible, audited, and never bypasses tenant rules |
| P3-017 | CATE row and field security | CATE retrieval, citation, narrative, and export respect active permissions |
| P3-018 | Canonical integration model | Core workflows remain vendor-neutral and adapters map to versioned canonical entities |
| P3-019 | Reference integration | Synthetic file/SFTP-style import and export support mapping, validation, posting, lineage, and reconciliation |
| P3-020 | Integration reliability | Idempotency, duplicate, partial failure, retry, dead letter, replay, stale, conflict, and control-total scenarios pass |
| P3-021 | Source-of-truth control | Entity and field ownership prevents silent overwrite and synchronization loops |
| P3-022 | ERP/accounting simulators | Configuration, mapping, test, history, failure, retry, and activation requirements are interactive and labeled |
| P3-023 | SSO templates | Entra, Okta, and generic SAML configuration and mapping previews work and remain labeled simulated |
| P3-024 | SSO authorization boundary | Identity claims cannot override Catalyst roles, scopes, tenant membership, or authority |
| P3-025 | Emergency access | Emergency local-access policy is limited, monitored, audited, and documented |
| P3-026 | Supplier onboarding | Invitation through active, conditional, rejected, suspended, expired, and recertification states is controlled |
| P3-027 | Supplier validation | Required, expiration, duplicate, simulated screening, contradiction, and risk-routing checks work |
| P3-028 | Supplier review | Purchasing, compliance, finance, security, and category review operate according to configured authority |
| P3-029 | Banking-change protection | Synthetic banking changes require independent verification and dual approval and never initiate payment |
| P3-030 | Contract versioning | Synthetic contracts and amendments are private, hashed, versioned, and auditable |
| P3-031 | Contract citations | Every material extraction reaches exact document version, page, clause, confidence, and validation |
| P3-032 | Contract obligations | Owner, due, recurrence, status, evidence, reminders, and completion are controlled |
| P3-033 | Contract conflicts | Renewal deadline, amendment, price, invoice, and commitment conflicts are detected and explained |
| P3-034 | Mobile approval | Authorized mobile approve, reject, return, and request-information flows work with required rationale |
| P3-035 | Mobile receiving | Partial, damaged, rejected, quarantined, evidence, inspection, and return scenarios reconcile |
| P3-036 | Mobile simulation truth | Scanner and offline simulations are visible and do not falsify external behavior |
| P3-037 | Workflow designer boundary | Only approved governed blocks and conditions are available; arbitrary code, SQL, and APIs are absent |
| P3-038 | Workflow validation | Cycle, dead-end, owner, SoD, protected-control, and ambiguous-outcome checks work |
| P3-039 | Workflow lifecycle | Draft, simulation, approval, activation, supersession, and rollback preserve history |
| P3-040 | Workflow hero scenario | Approved high-value/high-risk workflow controls a new synthetic transaction |
| P3-041 | Governed report library | Required executive, spend, savings, supplier, contract, cycle, receiving, invoice, audit, and integration reports exist |
| P3-042 | Semantic catalog | Every displayed measure has certified definition, formula, grain, owner, source, target, freshness, lineage, and version |
| P3-043 | Report interactions | Filter, grouping, comparison, drillthrough, saved views, snapshots, annotations, and accessible tables work |
| P3-044 | Report exports | PDF, XLSX, and CSV outputs reconcile and scheduled distribution remains labeled simulated |
| P3-045 | CATE reporting narrative | Narrative cites certified metrics, separates fact and inference, and identifies synthetic data and as-of time |
| P3-046 | CATE identity | Active Phase 3 UI, prompts, docs, narration, exports, and tests use CATE consistently |
| P3-047 | CATE authority | Protected action and legal/compliance decision tests are refused or routed to humans |
| P3-048 | CATE evidence | Material output includes citations, rule versions, assumptions, confidence, risks, next action, mode, and correlation |
| P3-049 | CATE resilience | Live timeout, malformed output, rate limit, and outage enter labeled deterministic fallback |
| P3-050 | Trust Center truth | Implemented, internally tested, planned, customer-required, and independent-validation-required states reconcile to evidence |
| P3-051 | Security validation | Scans, SBOM, tenant, RLS, RBAC, session, API, upload, prompt, webhook, export, and audit tests produce evidence |
| P3-052 | Security findings | Every finding has severity, owner, remediation, retest, residual risk, and release effect |
| P3-053 | Accessibility target | Critical routes have WCAG 2.2 AA internal evidence without false certification claims |
| P3-054 | Keyboard and screen reader | Golden Thread critical actions complete using approved keyboard and assistive-technology configurations |
| P3-055 | Visual and responsive accessibility | Focus, contrast, color, zoom, reflow, motion, touch, chart, and table checks pass |
| P3-056 | Accessibility findings | Criterion, environment, steps, evidence, severity, owner, remediation, and retest are recorded |
| P3-057 | Operations monitoring | Application, database, auth, integration, data, CATE, provider, security, job, and incident states are shown truthfully |
| P3-058 | Alert and incident lifecycle | Severity, impact, acknowledgement, assignment, mitigation, resolution, review, and evidence work |
| P3-059 | Support cases | Intake, priority, impact, assignment, escalation, response preview, resolution, and incident linkage work |
| P3-060 | Runbooks | Required preflight, failure, security, fallback, deployment, rollback, restoration, and accessibility runbooks are current |
| P3-061 | Synthetic data version | Dataset schema, content hash, expected records, KPIs, and outcomes are versioned |
| P3-062 | Deterministic reset | One action restores the exact approved scenario and expected totals |
| P3-063 | Audit contract | Material actions include actor, persona, record, before/after, reason, versions, evidence, simulation, correlation, and time |
| P3-064 | UX completion | No raw values, dead controls, unexplained placeholders, missing critical states, or inaccessible status meaning remain |
| P3-065 | Deployment proof | Exact commit and DigitalOcean live deployment, health, release markers, logs, and rollback target are verified |
| P3-066 | Secret protection | Git, bundle, HTML, responses, logs, screenshots, reports, and exports contain no secret |
| P3-067 | Critical-route tests | Required positive, negative, abuse, accessibility, performance, reset, fallback, and deployment routes pass |
| P3-068 | Performance budgets | Navigation, deterministic actions, reset, report, and fallback meet approved demo-condition targets |
| P3-069 | Three rehearsals | Three consecutive deployed rehearsals pass with recorded environment and integrity evidence |
| P3-070 | Severity gate | No Critical or High finding remains; accepted Medium findings are owned and disclosed |
| P3-071 | Release manifest | Required release, test, data, truth, security, accessibility, CATE, deployment, fallback, and sign-off evidence is complete |
| P3-072 | Release freeze | Important demonstrations use the approved freeze and emergency-change revalidation policy |
| P3-073 | Scope control | Excluded capabilities are absent or correctly labeled preview/future activation |
| P3-074 | Pilot boundary | No real customer data, user, document, credential, or promise crosses activation gates |
| P3-075 | Required handoff | Architecture, mapping, migrations, tests, runbooks, evidence, limitations, and release summary are current |

## 38. Approved planning decisions

The reverse-prompting process approved:

1. Canonical-first integrations with a functional synthetic reference flow and
   interactive ERP/accounting simulators.
2. Interactive simulated Entra, Okta, and generic SAML configuration while
   keeping Catalyst authorization authoritative.
3. Advanced synthetic supplier self-service onboarding with risk,
   remediation, lifecycle, isolation, and dual-control protections.
4. Contract-document intelligence with exact citations, obligations,
   conflicts, and mandatory human validation.
5. Responsive mobile web approvals and receiving, with scanning and offline
   behavior labeled when simulated.
6. Controlled template-based workflows with validation, simulation,
   versioning, approval, and rollback.
7. Governed advanced reporting with certified metrics, drillthrough, exports,
   accessible equivalents, and evidence-cited CATE narrative.
8. Internal security validation and a Trust Center without unsupported
   certification claims.
9. WCAG 2.2 AA internal accessibility testing and an Accessibility Assurance
   Center.
10. An Operations Center with monitoring, alerts, incidents, support cases,
    runbooks, fallback, and no false SLA claims.
11. A Demonstration Truth Standard and authoritative capability registry.
12. One connected commercialization Golden Thread.
13. Detailed release, acceptance, performance, rehearsal, evidence, and freeze
    gates.
14. A strict boundary between demonstration and future customer activation.
15. An eight-increment implementation sequence plus foundation increment.
16. A ten-persona authority model with explicit separation of duties.

## 39. Required completion handoff

At Phase 3 completion provide:

- requirement-to-file map;
- architecture decision record;
- canonical entity and adapter catalog;
- database migration inventory;
- SSO template and mapping catalog;
- supplier onboarding state and control catalog;
- contract extraction and obligation catalog;
- workflow block, condition, and validation catalog;
- certified metric and report catalog;
- CATE prompt, tool, evaluation, and authority report;
- environment and secret-name inventory without values;
- security threat model, SBOM, scan results, and findings register;
- accessibility test matrix and findings register;
- operations monitoring catalog;
- alert, incident, support, and runbook catalog;
- capability truth registry;
- synthetic dataset manifest and integrity hash;
- test traceability matrix;
- three rehearsal records;
- performance report;
- demo script and presenter notes;
- post-demonstration evidence package;
- deployment and rollback evidence;
- limitations and deferred-scope register;
- pilot-activation checklist;
- release evidence manifest;
- concise release summary with exact verification results.

## 40. Copy-and-paste Codex implementation prompt

Copy the following prompt into a new Codex task only when implementation is
authorized:

```text
Implement the Catalyst Procurement OS Audit Phase 3 Commercialization Demo.

Repository:
C:\Users\Daniel-Vass\OneDrive - Industrial Commutator Corporation, Inc\Documents\Catalyst Procurement OS

Authoritative specifications:
1. AGENTS.md
2. docs/PHASE2_DEMO_READINESS_SPEC.md
3. docs/PHASE3_COMMERCIALIZATION_DEMO_SPEC.md

Approved deployed baseline:
0c9ce49ea3e07bc14dc47d3093dc3d5640170cc0

Program objective:
Build an advanced, prospect-ready commercialization demonstration using
synthetic data and clearly labeled simulations. Do not treat this as a live
customer pilot or production customer implementation.

Before writing code:
1. Read AGENTS.md.
2. Read the relevant installed Next.js documentation in
   node_modules/next/dist/docs/ because this repository's Next.js version has
   breaking changes.
3. Read both Phase 2 and Phase 3 specifications completely.
4. Inspect the working tree and preserve all user changes.
5. Audit current functionality against every P3 acceptance requirement.
6. Produce a requirement-to-file, requirement-to-data, and
   requirement-to-test map.
7. Identify what can be reused and what is genuinely missing.
8. Report any contradiction between the specifications and existing product.
9. Do not edit application code until the implementation map and ordered
   increment plan are complete.

Implementation rules:
- Extend the existing Next.js and Supabase modular monolith.
- Do not rewrite working functionality without measured justification.
- Preserve every applicable Phase 1 and Phase 2 control.
- Use CATE - Catalyst AI for Trusted Evaluation - consistently.
- Keep CATE advisory. Humans retain approval, award, activation, receipt,
  supplier, contract, exception, and payment authority.
- Keep every record and document synthetic.
- Never connect to a real customer ERP, identity provider, supplier system, or
  confidential dataset without separate authorization.
- Enforce the Demonstration Truth Standard.
- Do not claim a simulated integration is live.
- Do not create dead buttons or unexplained placeholders.
- Maintain tenant, role, scope, separation-of-duties, evidence, audit, and
  deterministic-reset controls.
- Implement in the ordered increments in section 29.
- Pass each increment's exit gate before starting the next.
- Keep the existing deployed demonstration usable throughout implementation.

Required implementation order:
0. Phase 3 foundation
1. Integration Center
2. Enterprise access and supplier onboarding
3. Contract intelligence
4. Workflow and mobile execution
5. Reporting and CATE
6. Trust and operations
7. Commercialization experience
8. Release qualification

Verification rules:
- Add automated tests with each vertical increment.
- Test allowed and denied actions for every persona.
- Test tenant and supplier isolation.
- Test financial, quantity, time, contract, integration, KPI, report, and audit
  reconciliation.
- Test CATE evidence, authority refusal, prompt injection, and fallback.
- Test keyboard, screen reader, zoom, reflow, contrast, motion, charts, tables,
  and mobile critical routes.
- Test deployment health and release-specific markers.
- Do not mark a requirement complete without recorded evidence.
- Do not call the release demo-ready until all section 30 gates and applicable
  P3 acceptance requirements pass.

Required final handoff:
Provide every artifact listed in section 39, exact test results, exact
deployment identifiers, known limitations, and a concise statement of which
capabilities are Live, Functional Demo, Simulated Integration, Concept Preview,
or Future Activation.

Do not push, merge, deploy, connect external systems, or introduce real data
unless the product owner explicitly authorizes that action.
```

## 41. Planning completion statement

The Phase 3 planning baseline is considered 96% complete.

The following unknowns are intentionally deferred and do not block
demonstration implementation:

- first real ERP or accounting adapter;
- first real customer identity provider;
- customer-specific supplier requirements;
- customer-specific contract taxonomy;
- customer-specific workflows and approval authorities;
- customer-specific KPI targets;
- production support commitments;
- external penetration testing;
- independent accessibility assessment;
- production disaster-recovery architecture;
- pilot schedule and customer owners.

Those items become mandatory only when the corresponding pilot-activation gate
is opened through separate product-owner authorization.
