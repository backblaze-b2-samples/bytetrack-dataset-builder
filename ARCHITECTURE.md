<!-- last_verified: 2026-06-30 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with builder metrics (footage ingested, datasets built, total tracks, total clips, total releases, storage used) + recent builds
  - Datasets explorer (scoped) with full CRUD + run-with-live-progress and a per-track detail view with in-browser clip playback
  - Upload (drag-and-drop) — on-ramp for raw footage
  - Files (full-bucket explorer, kept from the starter)
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - REST API for source upload, dataset CRUD, build runs, stats, release download
  - B2 S3 integration via boto3
  - Local CV engine (lazy-imported): Roboflow `inference` detector + `sv.ByteTrack` association + per-track clip encode + MOT packaging
  - Health check endpoint with B2 connectivity verification
  - Structured JSON logging with request tracing + Prometheus-format metrics
- **packages/shared/** — TypeScript type definitions mirroring the Pydantic models

## Backend Layering

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic + CV engine — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer (`b2_client.py` + `dataset_store.py`)
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (Dataset, Track, Release, BuildJob, FileMetadata, …)
    config/                Settings loaded from environment (region-derived endpoint)
    repo/                  B2 S3 client + dataset_store (data access layer)
    service/               Business logic (datasets, build, jobs) + engine/
    service/engine/        Local CV — device, detect, track, clips, mot, video (lazy imports)
    runtime/               FastAPI route handlers
  scripts/build_dataset.py Bulk CLI
  tests/                   pytest tests (structural + integration + engine guard)
```

## The CV Engine

`service/engine/` performs local compute on bytes the repo already fetched from B2. It owns no boto3 (CV is compute, not storage). Every heavy import (Roboflow `inference`, `supervision`, OpenCV, imageio, torch) is **lazy** — done inside functions — so the API boots and `pnpm test:api` / `pnpm check:structure` / `pnpm lint:api` all pass without `requirements-ml.txt`.

- **device.py** — auto-detect CUDA → MPS → CPU, default CPU. Never hard-requires a GPU; `MAX_FRAMES` caps a CPU demo so a build finishes fast.
- **detect.py** — Roboflow `inference` adapter. The default `rfdetr-base` COCO model runs locally with no API key; weights auto-download on first use. Detections returned as `sv.Detections` so the rest of the pipeline is decoupled from the raw response shape.
- **track.py** — the genuine ByteTrack association via `sv.ByteTrack` (one tracker per video). Associates per-frame boxes into persistent track ids using byte-level association.
- **clips.py** — per-track clip crop + encode to browser-playable H.264 (yuv420p, +faststart) via the bundled imageio-ffmpeg binary.
- **mot.py** — per-track annotation JSON, MOTChallenge `gt.txt` lines (1-indexed frames), and the `labels.zip` + manifest assembly.
- **video.py** — frame decode (OpenCV) with the `MAX_FRAMES` cap.
- **_torch_safe.py** — torch `weights_only` allowlist guard for model checkpoints when torch is present.

## Boundary Invariants

- **No external SDK leakage**: `boto3` only in `app/repo/`.
- **No raw dicts at boundaries**: typed Pydantic models cross every layer.
- **Lazy CV**: heavy model libs never imported at module top level.
- **Never require a GPU**: device defaults to CPU with runtime autodetect.
- **Scoped deletes**: `dataset_store.delete_prefix` refuses an empty/root prefix, so a delete only ever targets one `dataset/<id>/` prefix.
- **Validated inputs**: all HTTP inputs validated by FastAPI/Pydantic; keys validated against path-traversal.

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API). No application database — the `dataset/<id>/dataset.json` manifest is authoritative for each dataset; raw footage lives under `raw/`.

On-B2 layout:
```
raw/<video>.<ext>
dataset/<id>/dataset.json                               manifest: config + stats + track index
dataset/<id>/annotations/<video_id>/<track_id>.json     per-track annotations
dataset/<id>/clips/<track_id>.mp4                        per-track cropped clip (H.264)
dataset/<id>/releases/<version>/manifest.json           release manifest
dataset/<id>/releases/<version>/labels.zip              MOTChallenge gt.txt per video
```

## Deployment

- **Local dev** — `pnpm dev` runs both services (web `:3000`, API `:8000`). The pipeline is `deployment: local`: CPU-default, GPU auto-detected.
- **Railway** — two services from the same repo; see `infra/railway/README.md`.

## Data Flows

- **Upload (source)**: Browser -> `POST /upload` -> API validates -> service -> repo writes to `raw/`
- **Create dataset**: Browser -> `POST /datasets` -> service writes a draft `dataset/<id>/dataset.json`
- **Build (run)**: Browser -> `POST /datasets/{id}/build` -> background task: repo downloads source -> engine detect -> ByteTrack associate -> filter -> write annotations + crop clips + package MOT release + manifest. Progress streams via the ephemeral job registry, polled by the UI.
- **Read**: Browser -> `GET /datasets` / `GET /datasets/{id}` -> service reads manifests via repo. Clip playback + release download use presigned URLs.
- **Delete**: Browser -> `DELETE /datasets/{id}` -> service -> repo `delete_prefix("dataset/{id}/")` (scoped).

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware
- `/metrics` (Prometheus format) and `/health` (B2 connectivity)

## Canonical Files

- Layered API handler: `services/api/app/runtime/datasets.py`
- Build orchestration: `services/api/app/service/build.py`
- Dataset CRUD + stats: `services/api/app/service/datasets.py`
- CV engine: `services/api/app/service/engine/`
- B2 data access (repo): `services/api/app/repo/{b2_client,dataset_store}.py`
- Pydantic models: `services/api/app/types/dataset.py`
- Config: `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TS types: `packages/shared/src/types.ts`

## Core Features

- [Source ingest](docs/features/source-ingest.md)
- [ByteTrack pipeline](docs/features/bytetrack-pipeline.md)
- [Track filters](docs/features/track-filters.md)
- [Dataset packaging](docs/features/dataset-packaging.md)
- [Serve from B2](docs/features/serve-from-b2.md)
- [Datasets explorer](docs/features/datasets-explorer.md)
- [File Browser](docs/features/file-browser.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/RELIABILITY.md](docs/RELIABILITY.md)
- [AGENTS.md](AGENTS.md)
