# Catalyst Procurement OS — Phase 1 Handoff

## Executive summary

Phase 1 establishes a polished, front-end-only procurement product demonstration for a fictional Y-12 Credit Union workspace. The application presents a cohesive enterprise shell, an executive dashboard, an AI procurement preview, and purposeful content for every primary navigation destination.

The current product is a static demonstration—not an operational procurement system. It has no authentication, authorization, backend APIs, database, durable workflow logic, real AI connection, or business-process persistence. Interactive controls either manage temporary browser state or explicitly identify themselves as simulated.

## Completed deliverables

### Application foundation

- Next.js 16 App Router application using TypeScript, Tailwind CSS, Radix UI primitives, TanStack React Query, Framer Motion, Lucide icons, and Recharts.
- Static-export configuration with trailing-slash URLs and unoptimized local images.
- Shared root providers for React Query and Radix tooltips.
- Typed procurement demonstration models covering organizations, people, departments, vendors, requests, approvals, purchase orders, contracts, invoices, inventory, metrics, activity, AI insights, notifications, and search records.
- Centralized fictional data for the executive dashboard, shell utilities, and procurement entities.

### Product experience

- Mock login experience with fictional credentials, SSO preview, password visibility control, and an explicit demonstration disclaimer.
- Responsive application shell with desktop sidebar, mobile navigation dialog, top navigation, page context, organization menu, profile menu, notification center, global search, theme selection, and floating AI launcher.
- Light, dark, and system theme modes; the selection is the only preference currently stored in browser local storage.
- Semantic visual tokens for surfaces, text, borders, brand colors, statuses, charts, shadows, spacing, and layout dimensions.
- Executive dashboard with spend and savings metrics, budget context, spend trends, department and vendor views, approval queue, contract renewal visibility, AI insights, recent activity, and quick actions.
- AI Procurement workspace with conversation history presentation, suggested prompts, prompt composer, simulated typing state, deterministic fictional responses, attachments affordance, and explicit preview guardrails.
- Global command palette with keyboard access (`Ctrl/Cmd + K`) and fictional records across requests, purchase orders, invoices, contracts, employees, departments, vendors, and inventory.
- Responsive desktop, tablet, and mobile behavior, including horizontal overflow protection for dense tables and a mobile navigation drawer.
- Accessibility foundations including semantic landmarks, skip navigation, labeled icon controls, visible focus treatment, dialog primitives, status announcements, and reduced-motion styling support.

### Module presentation

Every primary procurement area has directly addressable, statically generated content. The shared module presentation supplies four metrics, a priority-record table, status treatment, an AI insight preview, workspace-health indicators, and simulated actions tailored to each area.

## Reusable component inventory

### Exported UI primitives

| Component | Location | Reuse purpose |
| --- | --- | --- |
| `Button` and `buttonVariants` | `src/components/ui/button.tsx` | Primary, secondary, ghost, and danger actions with shared sizing and focus behavior |
| `Badge` | `src/components/ui/badge.tsx` | Neutral, success, warning, danger, and information states |
| `Card`, `CardHeader`, `CardContent` | `src/components/ui/card.tsx` | Shared panel structure and surface styling |

### Exported product compositions

| Component | Location | Reuse purpose |
| --- | --- | --- |
| `BrandMark` | `src/components/layout/brand-mark.tsx` | Full and compact Catalyst product mark |
| `AppShell` | `src/components/layout/app-shell.tsx` | Persistent navigation and cross-route application controls |
| `LoginScreen` | `src/components/auth/login-screen.tsx` | Mock demonstration entry |
| `ExecutiveDashboard` | `src/components/dashboard/executive-dashboard.tsx` | Executive procurement overview |
| `AiWorkspace` | `src/components/ai/ai-workspace.tsx` | Simulated procurement assistant experience |
| `ModulePage` | `src/components/modules/module-page.tsx` | Configuration-driven presentation for 13 procurement and system modules |
| `Providers` | `src/components/providers.tsx` | Shared React Query and tooltip context |

### Reusable patterns currently embedded in larger components

The shell already contains useful navigation, command-palette, theme-menu, organization-menu, notification-menu, profile-menu, mobile-navigation, and breadcrumb patterns. The dashboard includes a metric-card pattern, chart panels, activity feed, approval cards, and insight cards. The module presentation includes a page header, metric grid, status table, simulated-action notice, AI insight card, and health indicators.

These patterns are reusable in design, but most are not yet exported as independent components. They should be extracted only when Phase 2 creates a second genuine consumer or when automated testing requires a narrower boundary.

## Route inventory

| Route | Current experience |
| --- | --- |
| `/` | Mock login and demonstration entry |
| `/dashboard` | Executive procurement dashboard |
| `/ai-procurement` | AI Procurement preview workspace |
| `/purchase-requests` | Request intake and status overview |
| `/approvals` | Approval decision queue overview |
| `/purchase-orders` | Purchase order and fulfillment overview |
| `/receiving` | Receiving and delivery-exception overview |
| `/inventory` | Inventory and replenishment overview |
| `/vendors` | Vendor management overview |
| `/vendor-risk` | Third-party risk overview |
| `/contracts` | Contract obligation and renewal overview |
| `/invoices` | Invoice visibility and exception overview |
| `/analytics` | Spend and savings analytics overview |
| `/audit-center` | Control-event and evidence overview |
| `/administration` | Organization-governance configuration preview |
| `/settings` | Personal preference preview |

The 15 workspace routes are generated from the shared dynamic section route at `src/app/(workspace)/[section]/page.tsx`. Unknown section values render the not-found experience.

## Fictional-data and capability boundary

All names, people, email addresses, identifiers, suppliers, contracts, amounts, risk observations, notifications, activity, insights, and performance figures are demonstration fixtures. Y-12 Credit Union is represented only as a fictional first-customer workspace.

The following are intentionally not implemented:

- authentication, SSO, password recovery, sessions, or account security;
- authorization, role enforcement, approval authority, or tenant isolation;
- backend APIs, server actions, webhooks, integrations, or file processing;
- database storage, audit-event storage, document storage, or any durable persistence;
- purchase-request, approval, purchase-order, receiving, inventory, vendor, contract, invoice, or payment business logic;
- a real AI model, retrieval system, tool execution, recommendations engine, or action execution;
- live organization switching or runtime white-label configuration.

Theme selection persists locally in the browser. AI prompts, simulated notices, menus, and other interactions are temporary client state. Entering the demonstration does not validate credentials. Buttons that resemble mutations do not change procurement data.

## Recommendations before Phase 2

1. **Define the Phase 2 operating model before connecting real data.** Decide the hosting model, authentication provider, tenant-resolution strategy, authorization boundary, audit expectations, and whether deployments are tenant-specific or multi-tenant.
2. **Validate the domain with procurement and control owners.** Confirm lifecycle states, approval delegation and escalation, receiving tolerances, three-way match rules, supplier-risk methodology, contract notice logic, inventory ownership, currencies, time zones, and retention requirements.
3. **Create and freeze service contracts.** Views currently consume local fixtures directly. Introduce typed feature-oriented service interfaces, schema validation, DTO-to-application mapping, stable query keys, and mock adapters before adding HTTP implementations.
4. **Turn the shell into a true organization-aware boundary.** Connect the existing brand model and semantic tokens to a validated organization configuration; define logo assets, contrast checks, terminology overrides, locale, currency, fiscal calendar, and support metadata.
5. **Select one end-to-end vertical slice.** Build a real purchase-request-to-approval path first, including permissions, validation, error states, audit events, and tests. Use it to prove the architecture before implementing every module.
6. **Establish production quality gates.** Add component and workflow tests, accessibility audits, browser coverage, visual regression checks, performance budgets, telemetry, route-level error handling, and security review.
7. **Run customer discovery against decisions, not screens.** Use the current shell to observe how executives, requesters, approvers, buyers, receiving staff, accounts payable, vendor-risk owners, and auditors complete their highest-value tasks.

## Prioritized technical and product debt

### Priority 0 — resolve before real customer data

- No authentication, authorization, tenant isolation, or server-enforced permission model.
- No service/data-access boundary despite the intended architecture; dashboard and shell components import fixtures directly.
- Static hosting cannot protect workspace routes or perform request-time tenant resolution.
- No schema validation, API error model, audit-event contract, or observability strategy.
- Current domain types are demonstration-level and have not been validated against multi-currency, multi-entity, delegated approval, partial receipt, exception, amendment, or retention requirements.
- Organization identity and brand values are centralized in the Phase 1 configuration and feed the shell, login experience, and theme tokens; persistence and tenant-aware administration remain Phase 2 work.

### Priority 1 — resolve during the first vertical slice

- `ModulePage` is a large configuration-driven client component. It provides consistency but will become a constraint when modules need distinct workflows, filters, detail views, permissions, and loading/error states.
- Shell subcomponents and dashboard patterns are internal to large files, limiting focused tests and independent ownership.
- React Query is configured but not yet used as a real asynchronous data boundary.
- Search, notification, organization, profile, table search, filters, exports, uploads, and row actions are presentation previews rather than functional flows.
- AI preview replies are keyword-selected local strings; conversation history, attachments, citations, safety controls, and action approval are not functional.
- No automated test suite is present in the current workspace; the documented validation workflow currently covers lint, type checking, production build, dependency audit, and browser QA.
- The root `README.md` now explains product scope, setup, validation commands, fictional-data constraints, and key documentation.

### Priority 2 — improve as teams and scope expand

- Formalize a component catalog and interaction guidelines once repeated production use cases are known.
- Add deliberate empty, loading, degraded, permission-denied, offline, and partial-data states per module.
- Define responsive behavior for production-scale tables and complex workflows beyond the current four-row previews.
- Add localization, currency, time-zone, fiscal-calendar, and accessible chart-table strategies.
- Replace text-based placeholder marks with approved Catalyst and customer-specific brand assets.

## Suggested Phase 2 discovery questions

### Customer and operating model

1. Which organization and user segment owns the first production use case?
2. Is the first release single-tenant, build-per-customer, or multi-tenant?
3. Which systems are authoritative for users, cost centers, budgets, suppliers, general ledger codes, contracts, purchase orders, receipts, and invoices?
4. Which regulatory, records-retention, accessibility, data-residency, and audit obligations apply by customer segment?

### Workflow and controls

5. What is the smallest end-to-end workflow that creates measurable customer value?
6. Who can request, approve, buy, receive, administer, audit, and override—and under what conditions?
7. How are approval thresholds, category policies, segregation of duties, delegation, escalation, and emergency purchases handled?
8. What constitutes a valid purchase request, purchase order, receipt, invoice match, supplier assessment, and contract renewal decision?
9. Which events must be immutable and attributable for audit purposes?
10. How should exceptions be assigned, documented, resolved, and reported?

### AI and automation

11. Which AI use cases are advisory, and which may prepare or execute actions?
12. What evidence, citations, confidence, human approval, and rollback controls are required for each AI capability?
13. Which documents and systems may AI retrieve from, and what permissions must follow the user?
14. How will the business evaluate recommendation quality, savings validity, risk signals, and hallucination rates?

### Experience and adoption

15. What are the top three decisions each primary persona makes, and what information is required at the moment of decision?
16. Which current tools, spreadsheets, emails, and handoffs create the most delay or control risk?
17. Which dashboard metrics are decision-driving, how are they calculated, and who certifies them?
18. What terminology, branding, navigation, and configuration must vary by organization?
19. What desktop, tablet, mobile, browser, and assistive-technology environments must be supported?
20. What outcome will prove Phase 2 is successful: cycle time, policy compliance, savings, user adoption, risk reduction, data quality, or another measurable result?
