# Catalyst Procurement OS - Phase 1 Architecture

## Architectural decision

Phase 1 is a front-end-only Next.js 16 App Router application. It produces a
static export and deliberately excludes authentication, APIs, databases, server
actions, AI connections, and procurement business logic.

The implementation optimizes for:

1. A complete enterprise application shell with directly addressable routes.
2. A consistent, typed fictional dataset shared by search and presentation.
3. Reusable UI and procurement page patterns.
4. White-label design tokens that can be replaced without rewriting components.
5. Clear seams for real services and authorization in Phase 2.

## Current folder structure

```text
src/
|-- app/
|   |-- (workspace)/
|   |   |-- [section]/page.tsx
|   |   `-- layout.tsx
|   |-- globals.css
|   |-- layout.tsx
|   |-- not-found.tsx
|   `-- page.tsx
|-- components/
|   |-- ai/
|   |-- auth/
|   |-- dashboard/
|   |-- layout/
|   |-- modules/
|   |-- ui/
|   `-- providers.tsx
|-- config/navigation.ts
|-- data/mock-data.ts
|-- lib/utils.ts
`-- types/procurement.ts

docs/
public/
scripts/
```

The component layers are intentionally one-directional:

```text
app routes -> product compositions -> UI primitives
          \-> typed configuration and fictional data
```

UI primitives do not import route, navigation, or procurement data.

## Route strategy

The root route (`/`) is the clearly labeled mock login experience. It never
authenticates or transmits credentials.

The workspace uses the `(workspace)` route group so every product route shares
the persistent application shell without adding a URL segment. The
`[section]` route is generated at build time for a closed list of 15 routes:

- `/dashboard`
- `/ai-procurement`
- `/purchase-requests`
- `/approvals`
- `/purchase-orders`
- `/receiving`
- `/inventory`
- `/vendors`
- `/vendor-risk`
- `/contracts`
- `/invoices`
- `/analytics`
- `/audit-center`
- `/administration`
- `/settings`

`generateStaticParams()` emits every permitted section. Unknown sections render
the custom not-found experience. This avoids route duplication while still
producing one HTML entry per module in `out/`.

The shared module page receives the section key and selects module-specific
content, metrics, tables, statuses, insights, and operating indicators. The
dashboard and AI workspace use dedicated compositions because their information
architecture is materially different.

## Rendering and client boundaries

Routes and layouts remain Server Components by default. Static export executes
them at build time.

Client Components are used where the interface requires browser behavior:

- `AppShell`: route awareness, mobile navigation, command palette, theme,
  notifications, organization and profile menus
- `ExecutiveDashboard`: Recharts and subtle Framer Motion entrance transitions
- `AiWorkspace`: prompt state, simulated typing, and mock response switching
- `ModulePage`: simulated actions and temporary preview notices
- `LoginScreen`: demo entry transition and password visibility
- `Providers`: React Query and Radix tooltip providers

Browser-only theme access is guarded. A small pre-hydration script applies the
saved appearance before the interface paints, and the theme control stores only
the local display preference.

React Query is installed and configured as the future asynchronous client-data
boundary, but Phase 1 does not manufacture network calls for static fixtures.

## Data boundary

`src/types/procurement.ts` defines the Phase 1 presentation models.
`src/data/mock-data.ts` contains fictional Y-12 Credit Union demo records used
by global search, notifications, navigation context, and future mock queries.

The visible demo uses consistent entities and identifiers, including:

- `PR-2026-0148`
- `PO-2026-0093`
- `INV-2026-1842`
- `CTR-2024-031`

Mutation-looking controls never write to these fixtures. They either navigate,
change ephemeral component state, or show a notice explaining that the action
is simulated.

Phase 2 should introduce service ports and runtime schema validation before
connecting real APIs. Transport DTOs should be mapped into application models;
the Phase 1 fixture shape must not silently become the production domain model.

## Design system and white-label strategy

`globals.css` owns semantic tokens for:

- canvas, panel, elevated and muted surfaces
- foreground and supporting text
- borders, focus rings and elevation
- primary, secondary and accent brand colors
- success, warning, danger and information states
- chart colors
- layout dimensions, density, radii and motion

Components reference semantic variables such as `--brand-primary` and
`--surface`, not organization-specific hex values. A future tenant manifest can
replace:

- organization name
- full and compact logos
- primary color
- secondary color
- accent color

Every tenant palette must pass automated contrast and focus-state checks.
Organization control of a color cannot override accessibility requirements.

The reusable UI layer follows shadcn/ui composition patterns and uses the Radix
primitives required for accessible dialogs, dropdown menus, avatars, tooltips,
and slot-based buttons.

## Static export and publishing

`next.config.ts` uses:

- `output: "export"`
- trailing slashes for portable deep links
- unoptimized images because the default Next image service requires a server

`npm run build` produces the `out/` static application.

`npm run build:sites` additionally stages:

- `dist/client` - the static export
- `dist/server/index.js` - a minimal Cloudflare Worker that delegates to the
  Sites static asset binding

No request-time application logic is introduced by the publishing adapter.

## Phase 2 migration seams

Before adding real capabilities:

1. Define tenant isolation and the real authorization matrix.
2. Decide whether protected routes will run on a server-capable Next.js
   deployment rather than pure static export.
3. Define money, currency, tax, unit-of-measure, time-zone, retention, and audit
   event models.
4. Freeze service contracts only after procurement, finance, risk, security,
   and legal review.
5. Add runtime validation and map API responses to application models.
6. Replace scripted AI responses with a governed service that includes
   citations, permissions, logging, and human confirmation for actions.
7. Add route-level error boundaries, observability, feature flags, and
   performance budgets.
8. Add automated accessibility and end-to-end regression coverage.

## Deliberate Phase 1 constraints

| Constraint | Phase 1 control | Phase 2 requirement |
| --- | --- | --- |
| No real authentication | Login is explicitly marked fictional and sends nothing | Add identity, sessions, tenant resolution, and server-side authorization |
| No persistence | Actions show simulated notices or local display state | Add validated mutation contracts and recoverable outcomes |
| No backend or API | All records are typed local fixtures | Add services, runtime validation, reconciliation, and observability |
| No AI connection | Responses and citations are scripted | Add governed retrieval, permission filtering, and action confirmation |
| Static deployment | Every route is generated at build time | Reassess hosting when protected request-time data is introduced |
| Brand is provisional | Semantic tokens isolate organization styling | Validate signed tenant manifests and automated contrast |

Phase 1 is a commercial-quality presentation foundation, not an authorization
or transaction system.
