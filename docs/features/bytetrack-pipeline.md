<!-- last_verified: 2026-06-30 -->
# Feature: ByteTrack pipeline (detect + track)

## Purpose
Find objects in each frame with a keyless local detector, then associate them across frames into persistent object tracks using the **ByteTrack** byte-level association algorithm. *No external API — runs locally, CPU by default.*

## Used By
- Job: dataset build pipeline (`service/build.py` → `service/engine/video.py::detect_and_track`)

## Core Functions
- `services/api/app/service/engine/detect.py` — `infer_frame()`, `class_names_of()` (Roboflow `inference` adapter; `rfdetr-base` COCO, keyless)
- `services/api/app/service/engine/track.py` — `new_tracker()`, `track()` (the genuine `sv.ByteTrack`)
- `services/api/app/service/engine/video.py` — `detect_and_track()`, `probe_video()`, `_filter_classes()`, `_accumulate()`
- `services/api/app/service/engine/device.py` — `select_device()` (CUDA → MPS → CPU, default CPU)

## Canonical Files
- Per-frame loop + track accumulation: `services/api/app/service/engine/video.py`

## Inputs
- A local path to the downloaded source video (the repo fetches it from `raw/`)
- detection_model: str (default `rfdetr-base`)
- track_classes: list[str] (COCO class names kept; default surveillance/dashcam set)
- detection_confidence, track_activation_threshold, track_buffer, max_frames: from the dataset config

## Outputs
- An in-memory map of `track_id -> {class_name, boxes:[{frame,x,y,w,h,confidence}]}` plus video metadata (fps, width, height, frames processed)

## Flow
- `probe_video()` reads fps / dimensions; the decode loop reads up to `MAX_FRAMES` frames (OpenCV)
- Per frame: `infer_frame()` runs the detector → `sv.Detections`; `_filter_classes()` keeps only the configured classes (matched by class *name*, model-agnostic)
- `track()` feeds the filtered detections to the per-video `sv.ByteTrack` tracker → detections gain persistent `tracker_id`s
- `_accumulate()` appends each tracked box to its track record

## Edge Cases
- Detector weights not yet cached → auto-download on first build (network needed once); no API key
- No objects of the configured classes → zero tracks, build still completes (empty dataset)
- GPU absent → `select_device()` returns `cpu`; `MAX_FRAMES` keeps a CPU demo fast
- Class names differ by model base (COCO-80 vs COCO-91) → matching is on `class_name` strings, not integer ids

## UX States
- Surfaced as the "detecting" → "tracking" build-progress badges; per-frame progress drives the percentage

## Verification
- Test files: `services/api/tests/test_engine.py` (lazy-import guard, device autodetect; full detect/track needs the CV stack)
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: engine + dataset tests green; a real build extracts ≥1 track from footage containing tracked classes

## Related Docs
- [Track filters](track-filters.md)
- [Dataset packaging](dataset-packaging.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
