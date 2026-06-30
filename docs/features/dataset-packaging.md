<!-- last_verified: 2026-06-30 -->
# Feature: Dataset packaging

## Purpose
Turn the kept tracks into training-ready artifacts on B2: one annotation JSON per track, a cropped clip per track, and a versioned MOT-format label release (manifest + `labels.zip`). *No external API.*

## Used By
- Job: dataset build pipeline (`service/build.py`)

## Core Functions
- `services/api/app/service/build.py` — `build_dataset()`, `_export_tracks()`, `_cut_release()`, `_stats()`
- `services/api/app/service/engine/mot.py` — `annotation_payload()`, `mot_gt_lines()`, `build_labels_zip()`, `release_manifest()`
- `services/api/app/service/engine/clips.py` — `encode_track_clip()` (per-track crop → H.264)
- `services/api/app/repo/dataset_store.py` — `put_bytes()`, `put_json()`

## Canonical Files
- Build + packaging: `services/api/app/service/build.py`

## Inputs
- The kept tracks (class, per-frame boxes) from the ByteTrack pipeline
- The source video path (for clip cropping) + video id derived from the source key

## Outputs (on B2, isolated under `dataset/<id>/`)
```
dataset/<id>/annotations/<video_id>/<track_id>.json   per-track: frames, bboxes, confidence, class
dataset/<id>/clips/<track_id>.mp4                      cropped clip (H.264, yuv420p, +faststart)
dataset/<id>/releases/<version>/manifest.json         videos, classes, track/clip counts, params
dataset/<id>/releases/<version>/labels.zip            MOTChallenge gt.txt per source video
dataset/<id>/dataset.json                             top-level manifest: config + stats + track index
```
MOT `gt.txt` rows are **1-indexed** by frame (`<frame>,<id>,<bb_left>,<bb_top>,<w>,<h>,<conf>,-1,-1,-1`). A re-build cuts a new release version (`_next_version()`).

## Flow
- `_export_tracks()`: for each kept track → write `annotation_payload()` JSON → `encode_track_clip()` crops the padded bounding region to a constant-size H.264 clip → `put_bytes` to `clips/`
- `_cut_release()`: assemble per-video `mot_gt_lines()` → `build_labels_zip()` → write `labels.zip` + `release_manifest()` JSON under `releases/<version>/`
- `_stats()` + the top-level `dataset.json` manifest are written with status `ready`

## Edge Cases
- No tracks pass filters → empty release, manifest still written (track/clip counts 0)
- Build failure → manifest persisted with status `error` and the message
- B2 write failure → `RuntimeError`, recorded on the job + manifest
- Clip codec: encoding goes through the bundled imageio-ffmpeg libx264 binary (not bare system ffmpeg)

## UX States
- Surfaced as the "exporting" → "packaging" → "done" build-progress badges; counts render on the detail page

## Verification
- Test files: `services/api/tests/test_engine.py` (MOT line indexing, `labels.zip` layout, annotation payload shape), `services/api/tests/test_datasets.py`
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: MOT + dataset tests green; a real build writes annotations, clips, and a `releases/<version>/` with `labels.zip` + manifest

## Related Docs
- [ByteTrack pipeline](bytetrack-pipeline.md)
- [Serve from B2](serve-from-b2.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
