<!-- last_verified: 2026-06-30 -->
# Feature: Datasets explorer

## Purpose
The scoped, app-specific explorer + full lifecycle (create / read / edit / delete / run) for the primary entity, **Dataset**. Scoped to the app's own `dataset/` prefixes (the full-bucket [File Browser](file-browser.md) coexists alongside it).

## Used By
- UI: `/datasets` (list), `/datasets/new` (create), `/datasets/[id]` (detail), `/datasets/[id]/edit` (edit)
- API: `GET/POST /datasets`, `GET/PATCH/DELETE /datasets/{id}`, `POST /datasets/{id}/build`, `GET /datasets/sources`, `GET /datasets/jobs/list`, `GET /datasets/{id}/tracks/{track_id}/clip`, `GET /datasets/{id}/releases/{version}/download`

## Core Functions
- `apps/web/src/components/datasets/datasets-list.tsx` — list + run + delete
- `apps/web/src/components/datasets/dataset-form.tsx` — create/edit form (selectors + safe-default hints)
- `apps/web/src/components/datasets/dataset-detail.tsx` + `track-row.tsx` — detail + clip playback
- `services/api/app/service/datasets.py` — CRUD + stats + sources
- `services/api/app/service/build.py` — build orchestration
- `services/api/app/service/jobs.py` — ephemeral build-progress registry
- `services/api/app/repo/dataset_store.py` — B2 read/write + scoped delete

## Canonical Files
- Routes: `services/api/app/runtime/datasets.py`
- Form-UX exemplar: `apps/web/src/components/settings/settings-form.tsx`

## Lifecycle verbs (all five in the UI)
| Verb | UI |
|------|----|
| create | `/datasets/new` — selectors for source video / detection model / classes-to-track; numeric thresholds; safe defaults shown as placeholder/description (no autofill button) |
| read | `/datasets` list + `/datasets/[id]` detail (stats, tracks, clip playback, release download, load-from-B2 snippet) |
| edit | `/datasets/[id]/edit` — rename/redescribe anytime; build config editable only while `draft` |
| delete | confirm dialog → scoped delete of `dataset/<id>/` |
| run | Build / Rebuild with live progress via `service/jobs.py` (a rebuild cuts a new release version) |

## Inputs / Outputs
- Create/edit: `{ name, description, config: DatasetConfig }` (source_key, detection_model, track_classes, thresholds, max_frames)
- List: `DatasetSummary[]`; detail: `Dataset` (with tracks); build: `BuildJob`

## Edge Cases
- No source videos → source `Select` shows an upload prompt; create still validates the key
- Editing config on a non-draft dataset → API 409 (locked after tracks exist)
- Delete is prefix-scoped — `delete_prefix` refuses an empty/root prefix
- Bad source key (path traversal) → API 400

## UX States
- Empty: "No datasets yet"
- Loading: skeleton rows; per-build progress badges
- Error: inline error state with retry; failed build shows the error on the detail page

## Verification
- Test files: `services/api/tests/test_datasets.py`
- Required cases: create, get 404, dashboard stats rollup, config-locked-after-build (409), name edit allowed, scoped delete, build enqueue, unscoped-delete guard
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: dataset tests green; `pnpm build` passes

## Related Docs
- [File Browser](file-browser.md)
- [Serve from B2](serve-from-b2.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
