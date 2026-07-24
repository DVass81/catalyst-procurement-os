# Phase 2 completion report

## 1. Summary

Phase 2 upgrades the Phase 1 shell into a connected, deterministic procurement
workflow and adds a deployable Streamlit companion. The implementation is
designed for a private Y-12-themed sales demonstration, not production use.

## 2. Application routes

Both surfaces cover dashboard, AI procurement, purchase requests, approvals,
purchase orders, receiving, inventory, vendors, vendor risk, contracts,
invoices, analytics, audit center, administration, and settings. Next.js also
includes the mock login route.

## 3. Domain models

The typed models cover users, roles, departments, locations, vendors, catalog
items, budgets, request lines, purchase requests, quotes, approvals, purchase
orders, receipts, invoices, inventory movements, contracts, risks, savings,
audit events, and workflow state.

## 4. Seeded datasets

The Streamlit seed includes 30 fictional users, 10 departments, 10 locations, 40
vendors, 120 catalog items, 75 requests, 15 approval workflows, 50 purchase
orders, 35 invoices, 100 baseline audit events, contracts, risks, savings
records, budgets, and inventory groupings. The Next surface carries an
equivalent presentation-scale deterministic dataset.

## 5. Featured workflow

`Y12-PR-2026-00175` begins at `$9,249`. Three monitors are reused from
inventory, saving `$1,047`; the approved headset substitution saves `$90`.
Vector Technology Partners is selected by a human for PO
`Y12-PO-2026-00482` at `$8,112`. The `$1,047` internal transfer produces a
total budget impact of `$9,159`. Receipt `Y12-RCV-2026-00291` accepts all
purchased items and notes minor monitor packaging damage. Invoice
`VTP-INV-84217` totals `$8,432`; the only mismatch is `$320` unexpected
freight, routed for human resolution.

## 6. State management

Next uses a `DemoProvider` plus local storage for fictional browser state.
Streamlit uses session state through a service object. Both support deterministic
reset and presenter stage jumps.

## 7. Branding

Brand identity is centralized, uses current public Y-12 assets, and preserves
accessible contrast. The application carries a persistent fictional-data,
private-demo, and non-endorsement boundary.

## 8. Roles and human controls

The demo includes requester, department manager, IT reviewer, purchasing
manager, finance reviewer, executive approver, purchasing specialist, receiving
clerk, accounts payable, executive, auditor, and administrator roles. The featured
request requires four sequential approvals; the executive threshold is not met.
AI explanations never execute controlled decisions.

## 9. Tests and results

- ESLint: pass
- Strict TypeScript: pass
- TypeScript workflow tests: 15 pass
- Python workflow tests: 21 pass
- Streamlit interaction regression tests: 2 pass
- Next.js production static export: pass

## 10. Issues resolved

- Corrected total-budget math to include the internal inventory transfer.
- Reconciled the featured request, savings, PO, receipt, invoice, and variance.
- Removed direct mutation of an instantiated Streamlit navigation widget.
- Added generated-output lint exclusions.
- Replaced the deprecated Vitest path plugin with native Vite path resolution.

## 11. Known production gaps

There is no real authentication, server-side authorization, database, document
store, payment rail, or production AI connection. Local/session persistence is
not an audit-grade system. The demo must never receive real sensitive data.

`npm audit --omit=dev` reports zero production vulnerabilities. The full audit
currently reports a development-only `brace-expansion` advisory through the
ESLint/serve toolchain. npm's automated remedy requires a breaking ESLint major;
an attempted transitive override was rejected because it broke ESLint at
runtime. Upgrade the lint toolchain once Next's supported dependency set carries
the patched parser.

## 12. Phase 3 recommendations

Add tenant-aware identity and authorization, PostgreSQL transactions and RLS,
idempotent workflow commands, immutable audit retention, governed document
storage, integration adapters, observability, accessibility and end-to-end
testing, and cited permission-aware AI assistance.

## 13. Run and reset

Run Streamlit with Python 3.12:

```powershell
& "C:\Users\Me\AppData\Local\Programs\Python\Python312\python.exe" -m streamlit run streamlit_app.py
```

Run Next locally with `npm.cmd run dev`. In Streamlit, use sidebar `Reset`. In
Next, use the presenter reset control or clear the
`catalyst-procurement-os-y12-demo-v2` local-storage key.

## 14. Branding files

- `src/config/organizations/y12-demo.ts`
- `src/app/globals.css`
- `.streamlit/config.toml`
- `public/brand/y12/Y-12-Logo-White.png`
- `public/brand/y12/favicon.png`
- `docs/BRAND.md`
