<!-- last_verified: 2026-06-30 -->
# Feature: Serve / read-from-B2

## Purpose
Play each track's cropped clip in the browser, download the MOT label release, and show a copy-paste snippet to load the release directly from B2 in a training pipeline. *No external API.*

## Used By
- UI: `/datasets/[id]` detail page
- API: `GET /datasets/{id}/snippet`, `GET /datasets/{id}/tracks/{track_id}/clip`, `GET /datasets/{id}/releases/{version}/download`

## Core Functions
- `apps/web/src/components/datasets/dataset-detail.tsx` — stats, snippet, MOT release download, track list
- `apps/web/src/components/datasets/track-row.tsx` — in-browser `<video>` playback per track clip
- `services/api/app/service/datasets.py` — `serve_snippet()`
- `services/api/app/runtime/datasets.py` — snippet + track-clip + release-download endpoints
- `services/api/app/repo/b2_client.py` — `get_presigned_url()`

## Canonical Files
- Detail view: `apps/web/src/components/datasets/dataset-detail.tsx`

## Inputs
- dataset id, track id, release version

## Outputs
- `GET /datasets/{id}/snippet` → `{ snippet: string }` (how to load the MOT release straight from the B2 S3 endpoint)
- `GET /datasets/{id}/tracks/{track_id}/clip` → presigned URL for the per-track `.mp4`
- `GET /datasets/{id}/releases/{version}/download` → presigned URL for `labels.zip`

## Flow
- Detail page renders stats + the load-from-B2 snippet (for ready datasets) + a release-download button
- Each track row lazily fetches a presigned URL and plays its cropped clip inline (H.264 `<video>`)
- The snippet shows how to read the MOT release directly from B2 in a training job

## Edge Cases
- Draft dataset (no tracks) → empty state prompting a build
- Missing track / version → 404
- Presigned URL fetch fails → loading spinner / inline message

## UX States
- Loading: skeletons; per-track clip loader
- Empty: "No tracks yet"
- Loaded: stats cards, snippet block, release download, playable track rows

## Verification
- Test files: `services/api/tests/test_datasets.py`
- Required cases: snippet for a ready dataset, clip/release 404 for unknown id
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: dataset tests green; `pnpm build` passes

## Related Docs
- [Dataset packaging](dataset-packaging.md)
- [Datasets explorer](datasets-explorer.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
