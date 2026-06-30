<!-- last_verified: 2026-06-30 -->
# App Workflows

User journeys inside the application.

## Upload raw footage

- User navigates to `/upload`
- Drops or selects a video file in the dropzone
- Client validates file size (max 500MB) and type (video only)
- Progress bar shows per-file upload status
- On success the video lands under the `raw/` prefix on B2 and becomes selectable in the dataset create form
- See: [Source ingest](features/source-ingest.md)

## Create a dataset

- User navigates to `/datasets` and clicks **New dataset** (`/datasets/new`)
- Picks a source video from a **Select** (populated from `raw/`)
- Chooses build settings via selectors: detection model (`rfdetr-base` …) and classes to track (a checkbox set over the COCO surveillance classes), plus numeric thresholds (detection confidence, track activation, minimum track length, track buffer, frame cap)
- Create-form defaults are shown as placeholder/description guidance (no autofill button), tuned for a quick CPU test run
- On save, a draft `dataset/<id>/dataset.json` manifest is written to B2 and the user lands on the detail page
- See: [Datasets explorer](features/datasets-explorer.md)

## Run a build (the storage-amplification story)

- From the list or detail page the user clicks **Build**
- A background job runs: download source → detect objects per frame → **ByteTrack** association into persistent tracks → track filtering → write per-track annotation JSON → crop a clip per track → package a versioned MOT release (manifest + `labels.zip`)
- Live progress badges (loading → detecting → tracking → filtering → exporting → packaging → done) update via polling
- On completion the dataset flips to **Ready** and shows tracks extracted, clips written, the release version, and the classes tracked
- See: [ByteTrack pipeline](features/bytetrack-pipeline.md), [Track filters](features/track-filters.md), [Dataset packaging](features/dataset-packaging.md)

## Inspect and serve a dataset

- On `/datasets/[id]` the user sees stats, a copy-paste **load-from-B2** snippet for the MOT release, and the list of extracted tracks
- Each track's cropped clip plays in-browser (presigned URL) next to its class and frame span
- The release archive (`labels.zip`) downloads via a presigned URL
- See: [Serve from B2](features/serve-from-b2.md)

## Edit / delete a dataset

- **Edit** (`/datasets/[id]/edit`): rename/redescribe anytime; build config is editable only while the dataset is a draft (locked once tracks exist)
- **Delete**: a confirm dialog removes the dataset record and every artifact under its `dataset/<id>/` prefix on B2 (scoped — never bucket-wide)

## Browse the whole bucket

- User navigates to `/files` (the kept full-bucket explorer): list, preview, download, delete any object — including the `raw/` and `dataset/` prefixes
- See: [File Browser](features/file-browser.md)

## View dashboard

- User navigates to `/` (home)
- Builder metrics load: footage ingested, datasets built, total tracks, total clips, total releases, B2 storage used
- A chart shows tracks per dataset; a table lists recent builds
- See: [Dashboard](features/dashboard.md)
