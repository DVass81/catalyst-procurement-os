# Catalyst Procurement OS - Phase 2 Architecture

## Decision

Phase 2 preserves the Next.js 16 static application and adds a first-class
Streamlit companion in the same private repository. The two surfaces share the
same workflow story and financial invariants but intentionally use native state
models appropriate to each runtime.

This remains a fictional demonstration. There is no production authentication,
database, payment integration, member data, or autonomous approval path.

## Runtime map

```text
Next.js surface
  app routes -> PhaseTwoPage -> DemoProvider -> TypeScript workflow services
                                     |
                                     `-> deterministic TypeScript seed

Streamlit surface
  streamlit_app.py -> WorkflowService -> Python domain models
                                             |
                                             `-> deterministic Python seed
```

All mutation rules live in the workflow/service layer. Presentation components
request actions; they do not directly alter procurement records.

## Next.js surface

The App Router emits the mock login and 15 statically generated workspace
routes. Server Components remain the default. `DemoProvider` is the browser
state boundary and stores only fictional demo state in local storage.

Key folders:

```text
src/
|-- app/                         # routes and global presentation
|-- components/demo/             # connected Phase 2 product views
|-- config/organizations/        # centralized tenant brand manifest
|-- demo/model.ts                # domain types
|-- demo/seed.ts                 # deterministic records
`-- demo/workflow.ts             # guarded workflow commands
```

The project uses the documented Next.js 16.2.11 conventions bundled with the
installed framework. `next build` produces the portable `out/` export.

## Streamlit surface

`streamlit_app.py` is the Community Cloud entry point. The application uses one
session-scoped `ProcurementService`; presenter reset reconstructs the full seed.

```text
streamlit_demo/
|-- domain.py                    # typed dataclasses and enums
|-- seed.py                      # deterministic datasets
`-- services.py                  # authorization and workflow commands
```

The sidebar exposes all 15 product pages, fictional role switching, stage
jumps, global search, and reset controls. Navigation changes are queued before
the radio widget is instantiated, avoiding illegal Streamlit session-state
mutation.

## Domain and controls

Money is represented as integer cents. The featured workflow enforces:

- inventory reuse before external purchasing;
- standards review and an explicit substitution decision;
- human-controlled quote selection;
- budget and GL validation;
- four sequential approvals with segregation of duties;
- PO creation, issuance, and acknowledgement;
- external receipt separate from the internal inventory transfer;
- three-way matching with one exact `$320` freight exception;
- human-only exception disposition; and
- append-only audit events for every material action.

Demo AI produces deterministic explanations and suggested next steps. It
cannot choose a vendor, approve a request, issue a PO, accept a receipt, or
authorize invoice payment.

## State and production boundary

Browser local storage and Streamlit session state are presentation persistence,
not production persistence. Phase 3 must introduce:

- real identity, tenant resolution, and server-side authorization;
- a transactional database with immutable audit retention;
- runtime-validated APIs and idempotent commands;
- governed document storage and invoice ingestion;
- observability, recovery, accessibility, and security testing; and
- an AI service with citations, permission filtering, and human confirmation.

The repository and hosted Streamlit app must remain private. Real Y-12
credentials, member information, financial records, or confidential documents
are prohibited.
