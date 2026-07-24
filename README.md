# Catalyst Procurement OS

Phase 1 is a polished, front-end-only enterprise procurement application shell
for Catalyst Innovations. The first fictional demonstration workspace represents
Y-12 Credit Union.

## What is included

- Mock login experience
- Executive procurement dashboard
- Premium scripted AI procurement workspace
- Responsive left and top navigation
- Global command-palette search
- Organization, notification, profile, and theme controls
- Populated presentation routes for the full procurement navigation
- Typed fictional procurement data
- Reusable UI primitives and product page patterns
- Light, dark, responsive, reduced-motion, and white-label design foundations

Authentication, APIs, databases, persistence, AI services, and procurement
business logic are intentionally excluded from Phase 1.

## Local development

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Quality checks

```powershell
npm.cmd run check
```

The application uses strict TypeScript, ESLint, and a static Next.js production
export.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/PHASE1_HANDOFF.md`
