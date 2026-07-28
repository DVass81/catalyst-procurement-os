# Catalyst Procurement OS

Catalyst Procurement OS is an AI-guided procurement workflow demonstration by
Catalyst Innovations. The Audit Phase 2 program adds a server-authoritative,
tenant-scoped request-to-invoice workflow, controlled imports and evidence,
CATE decision support, certified KPI scorecards, and reproducible private audit
packages to the guided Y-12 sales demonstration.

The fictional Y-12 Credit Union workspace is a private demonstration only. It
is not affiliated with, endorsed by, or connected to Y-12 Credit Union, and it
must not be used with real credentials, financial information, or member data.

## Presentation surfaces

- `src/` is the primary Next.js 16 sales demonstration for DigitalOcean behind
  Cloudflare Access.
- `streamlit_app.py` is the known-good presenter fallback.

Both surfaces use deterministic fictional records and the same featured
scenario:

- Request `Y12-PR-2026-00175`
- External request baseline: `$9,249`
- Identified savings: `$1,137`
- Purchase order `Y12-PO-2026-00482`: `$8,112`
- Internal inventory transfer: `$1,047`
- Total budget impact: `$9,159`
- Receipt `Y12-RCV-2026-00291`
- Invoice `VTP-INV-84217`: `$8,432`
- Sole invoice variance: `$320` unexpected freight

## Run the primary Next.js app

```powershell
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:3000`. The root route is a fictional, private-demo login;
the connected workspace begins at `/dashboard`.

CATE Live uses a server-created short-lived Realtime credential. Copy
`.env.example` to `.env.local` and set the server-only `OPENAI_API_KEY` to
enable it. Without the key, both guided tours, browser narration, captions, and
typed deterministic answers continue to work.

## Run the Streamlit fallback

```powershell
& "C:\Users\Me\AppData\Local\Programs\Python\Python312\python.exe" -m pip install -r requirements-dev.txt
& "C:\Users\Me\AppData\Local\Programs\Python\Python312\python.exe" -m streamlit run streamlit_app.py
```

## Quality gates

```powershell
npm.cmd run check
& "C:\Users\Me\AppData\Local\Programs\Python\Python312\python.exe" -m pytest -q
```

The checks cover linting, strict TypeScript, deterministic workflow tests, tour
integrity, CATE safeguards, the production Next.js build, Python domain
tests, and Streamlit interaction regressions. GitHub Actions runs the complete
clean Node validation for main and `codex/**` branch updates.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/PHASE2_IMPLEMENTATION_MAP.md`
- `docs/PHASE2_KPI_CATALOG.md`
- `docs/PHASE2_CATE_EVALUATION.md`
- `docs/PHASE2_RUNBOOK.md`
- `docs/PHASE2_SECURITY_AND_LIMITATIONS.md`
- `docs/BRAND.md`
- `docs/PHASE3_ARCHITECTURE.md`
- `docs/PHASE3_DEPLOYMENT.md`
- `docs/PHASE2_COMPLETION.md`
- `docs/PHASE1_HANDOFF.md`

## Sales kit

- `sales/EXECUTIVE_DECK.md`
- `sales/ROI_ONE_PAGER.md`
- `sales/SECURITY_OVERVIEW.md`
- `sales/FOUNDING_PARTNER_PILOT.md`
- `sales/PRESENTER_PLAYBOOK.md`
