<!-- last_verified: 2026-06-30 -->
# Feature: Track filters

## Purpose
Keep only training-worthy tracks by dropping weak detections and short-lived tracks via confidence / activation / minimum-length thresholds. *No external API.*

## Used By
- Job: dataset build pipeline (`service/build.py::_export_tracks`)
- UI: the create/edit dataset form thresholds

## Core Functions
- `services/api/app/service/engine/detect.py::infer_frame` — applies `detection_confidence` at inference time
- `services/api/app/service/engine/track.py::new_tracker` — applies `track_activation_threshold` + `track_buffer` to ByteTrack
- `services/api/app/service/build.py::_export_tracks` — drops tracks shorter than `min_track_length`

## Canonical Files
- Threshold plumbing: `services/api/app/service/build.py`

## Inputs (dataset config, overridable per build)
- detection_confidence: float (default 0.25) — minimum detector score for a box to count
- track_activation_threshold: float (default 0.25) — ByteTrack's high-confidence activation gate
- track_buffer: int (default 30) — frames a lost track survives before it's closed
- min_track_length: int (default 30) — tracks with fewer frames than this are discarded

## Outputs
- The filtered set of tracks that proceed to annotation export + clip cropping
- `clips_dropped` / track counts reflected in the manifest stats

## Flow
- Low-score boxes never enter association (confidence gate at detect time)
- ByteTrack uses activation + buffer to start/maintain/close tracks (its byte-level low-score recovery still runs)
- After tracking, tracks below `min_track_length` frames are dropped before export

## Edge Cases
- Thresholds too strict → zero tracks kept; build completes with an empty dataset
- `min_track_length` larger than `max_frames` → nothing survives (documented in form guidance)

## UX States
- Form fields with safe defaults shown as placeholder/`FormDescription` guidance (create form); pre-filled on edit
- Config is locked once a build has materialized tracks

## Verification
- Test files: `services/api/tests/test_datasets.py` (config validation), `services/api/tests/test_engine.py`
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: config round-trips through create/edit; raising `min_track_length` reduces kept tracks

## Related Docs
- [ByteTrack pipeline](bytetrack-pipeline.md)
- [Dataset packaging](dataset-packaging.md)
- [docs/app-workflows.md](../app-workflows.md)
