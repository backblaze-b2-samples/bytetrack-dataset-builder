<!-- last_verified: 2026-06-30 -->
# AGENTS.md

This is the authoritative control surface for all coding agents. Read this first.

## 1. Repository Map

```
apps/web/          Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  src/app/         Dashboard (/), upload, datasets, datasets/[id], datasets/[id]/edit,
                   datasets/new, files, settings, design
  src/components/  dashboard/, datasets/, files/, upload/, settings/, layout/, ui/ (generated)
  src/lib/         api-client.ts, queries.ts (TanStack), dataset-format.ts, app-config.ts
services/api/      FastAPI backend (layered: types/config/repo/service/runtime)
  app/service/engine/   Local CV engine — lazy-imported (device / detect / track / clips / mot / video)
  scripts/         build_dataset.py (bulk CLI)
  requirements.txt + requirements-ml.txt   base vs heavy CV stack
packages/shared/   Shared TypeScript types (mirrors Pydantic models)
docs/              System of record (features, workflows, security, reliability)
docs/exec-plans/   Execution plans and tech debt tracker
infra/railway/     Deployment config
```

## 2. The Realized Contract (built on the starter kit)

This app was built on the vibe-coding-starter-kit. The starter contract was honored as follows — keep these distinctions when extending.

**Kept verbatim (do not strip, rename, or edit)**
- **UI kit / design system.** `apps/web/src/components/ui/` (shadcn primitives), the design tokens in `apps/web/src/app/globals.css`, and the `/design` reference page. Build new screens with these primitives; never edit generated `components/ui/` files directly. Restyle via tokens in `globals.css`.
- **Bucket Explorer (Files).** `/files` route, `apps/web/src/app/files/`, and `apps/web/src/components/files/` — the full-bucket browse. Its sidebar entry stays. (This app *also* adds a scoped Datasets explorer — see below. The two coexist: Files = whole bucket, Datasets = this app's own prefixes.)
- **Upload.** `/upload` route and `apps/web/src/components/upload/` — now the on-ramp for raw footage, writing to the `raw/` prefix.

**Added for this app**
- **Datasets** (`/datasets`, `/datasets/[id]`, `/datasets/[id]/edit`, `/datasets/new`) — the scoped explorer + full CRUD + run-with-live-progress for the primary entity (Dataset). Mirrors the starter's library/detail structure.
- New backend: `runtime/datasets.py`, `service/{datasets,build,jobs}.py`, `service/engine/`, `repo/dataset_store.py`, `types/dataset.py`.
- **Bulk CLI:** `scripts/build_dataset.py` (`pnpm build:dataset`).

**Adapted**
- **Dashboard.** `/` and `apps/web/src/components/dashboard/` now show builder metrics (footage ingested, datasets built, total tracks, total clips, total releases, storage used) and recent builds. Aggregations flow through `runtime -> service -> repo` and TanStack Query hooks in `apps/web/src/lib/queries.ts` — no bare `useEffect + fetch`.
- **Settings.** `settings-form.tsx` is the form-UX exemplar (selectors for finite-value fields + create-form default hints) for the dataset create/edit forms.

**Trimmed**
- Image/PDF metadata extraction (the old `service/metadata.py`, Pillow/PyPDF2 deps, and its doc) — irrelevant to video tracking.

## 3. Architectural Invariants

**Backend layering**: `types` -> `config` -> `repo` -> `service` -> `runtime`

- No backward imports across layers
- No `boto3` outside `repo/` (both `b2_client.py` and `dataset_store.py` live there)
- **CV inference is local compute, not storage**: `service/engine/` runs models on bytes the repo fetched; it owns no boto3
- **Heavy CV imports are lazy** (inside engine functions) so the API boots and tests pass without `requirements-ml.txt`. Roboflow `inference` (detector) and `supervision` (`sv.ByteTrack`) are used directly so detection and tracking are visible, standalone steps
- **Device selection auto-detects CUDA → MPS → CPU and defaults to CPU** (`service/engine/device.py`); never hard-require a GPU. `MAX_FRAMES` caps a CPU demo so a build finishes fast
- **Keyless by default**: the default `rfdetr-base` detector runs locally with no API key (weights auto-download); `ROBOFLOW_API_KEY` is optional, so the app runs end-to-end with B2 credentials alone
- **Dataset deletes are prefix-scoped** to `dataset/<id>/` (`dataset_store.delete_prefix` refuses an empty/root prefix)
- No business logic in route handlers (`runtime/`)
- All request/response data validated at boundary (Pydantic models)
- The only module-level mutable state is the explicitly-ephemeral build-job registry (`service/jobs.py`); B2 manifests are authoritative

**Frontend**: shadcn/ui components in `src/components/ui/` are generated — never modify them.

**Data fetching**: every API call flows through TanStack Query hooks in `apps/web/src/lib/queries.ts`. No bare `useEffect + fetch`. New endpoints touch three files: `runtime/<router>.py`, `lib/api-client.ts`, `lib/queries.ts`.

## 4. Quality Expectations

- **DRY** — do not duplicate logic, types, or constants. Extract shared code only when used in 2+ places.
- Structured JSON logging only — no `print()` statements
- No raw SDK calls outside `repo/` layer
- Files stay under 300 lines
- Tests added or updated for every behavior change
- Docs updated in same PR as code changes
- Lint clean before merge
- Prefer boring, composable libraries over clever abstractions
- No implicit type assumptions — use typed models

## 5. Mechanical Enforcement

| Rule | Enforced by |
|------|-------------|
| No backward imports | `tests/test_structure.py::test_no_backward_imports` |
| No boto3 outside repo/ | `tests/test_structure.py::test_boto3_only_in_repo` |
| File size < 300 lines | `tests/test_structure.py::test_file_size_limits` |
| All layers exist | `tests/test_structure.py::test_all_layers_exist` |
| Engine imports without CV stack | `tests/test_engine.py::test_engine_imports_without_cv_stack` |
| No bare print() | `ruff` rule T20 |
| Import ordering | `ruff` rule I001 |
| Frontend strict equality | `eslint` rule eqeqeq |
| No unused vars | `eslint` + `ruff` rules |

## 6. Commands

```bash
# Run
pnpm dev               # start both frontend and backend
pnpm dev:web           # frontend only
pnpm dev:api           # backend only

# Test & Lint (none of these need the CV stack)
pnpm lint              # frontend lint (eslint)
pnpm build             # frontend type check + build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests (pytest)
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests

# Dataset pipeline
pnpm build:dataset     # bulk-build datasets from B2 source videos under raw/

# Enabling the pipeline (one-time)
#   cd services/api && source .venv/bin/activate && pip install -r requirements-ml.txt
#   ffmpeg is bundled via imageio-ffmpeg (no system install); the default
#   rfdetr-base detector weights auto-download on first build — no API key
```

## 7. Agent Workflow

1. Read this file first.
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) before structural changes.
3. For non-trivial changes, create a plan in `docs/exec-plans/active/`.
4. Implement the smallest coherent change.
5. Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
6. Update docs in the same PR (see §9).
7. Move completed plans to `docs/exec-plans/completed/`.
8. Only change files relevant to the task. No drive-by improvements.

## 8. Frontend Conventions

See [docs/dev-workflows.md](docs/dev-workflows.md) for full details.

## 9. Doc Update Mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs, tests | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or scope changes | `README.md` |
| Security changes | `docs/SECURITY.md` |
| Reliability changes | `docs/RELIABILITY.md` |
| Active work plans | `docs/exec-plans/active/` |
| Known tech debt | `docs/exec-plans/tech-debt-tracker.md` |

If documentation and implementation conflict, update docs in the same PR. Documentation rot destroys agent reliability.

## 10. Doc Map

| Topic | Location |
|-------|----------|
| System layout, data flows, boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Feature docs | [docs/features/](docs/features/) |
| User journeys | [docs/app-workflows.md](docs/app-workflows.md) |
| Engineering workflows and testing | [docs/dev-workflows.md](docs/dev-workflows.md) |
| Security principles | [docs/SECURITY.md](docs/SECURITY.md) |
| Reliability expectations | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| Execution plans | [docs/exec-plans/](docs/exec-plans/) |
| Tech debt | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## 11. When Unsure

- Prefer boring, stable libraries
- Prefer small PRs over large changes
- Add tests with every change
- Never bypass lint rules without explicit instruction
- Ask before making destructive or irreversible changes
