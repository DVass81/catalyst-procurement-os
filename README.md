# Catalyst Procurement OS

Catalyst Procurement OS is a deterministic procurement workflow demonstration
by Catalyst Innovations. Phase 2 connects request intake, inventory reuse,
catalog standards, quotes, budgets, approvals, purchase orders, receiving,
invoice matching, exceptions, and audit history.

The fictional Y-12 Credit Union workspace is a private demonstration only. It
is not affiliated with, endorsed by, or connected to Y-12 Credit Union, and it
must not be used with real credentials, financial information, or member data.

## Two presentation surfaces

- `streamlit_app.py` is the deployable Streamlit companion and the primary
  hosted demonstration.
- `src/` contains the complete Next.js 16 application shell and connected
  Phase 2 workflow. It builds as a static export for local presentation.

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

## Run the Streamlit app

```powershell
& "C:\Users\Me\AppData\Local\Programs\Python\Python312\python.exe" -m pip install -r requirements-dev.txt
& "C:\Users\Me\AppData\Local\Programs\Python\Python312\python.exe" -m streamlit run streamlit_app.py
```

Use the sidebar `Reset` control to restore the deterministic seed. Presenter
controls can also switch fictional roles or jump to a workflow stage.

## Run the Next.js app

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. The root route is a mock login; the procurement
workspace begins at `/dashboard`.

## Quality gates

```powershell
npm.cmd run check
& "C:\Users\Me\AppData\Local\Programs\Python\Python312\python.exe" -m pytest -q
```

The checks cover linting, strict TypeScript, 15 deterministic TypeScript
workflow tests, the production static export, 21 Python domain tests, and two
Streamlit interaction regression tests.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/BRAND.md`
- `docs/PHASE2_COMPLETION.md`
- `docs/PHASE1_HANDOFF.md`
