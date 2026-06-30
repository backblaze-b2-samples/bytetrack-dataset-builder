<!-- last_verified: 2026-06-30 -->
# Feature: Source ingest

## Purpose
Upload raw video footage from the browser to Backblaze B2 so it can be turned into tracking datasets. *No external API.*

## Used By
- UI: `/upload` page, upload form component
- API: `POST /upload`

## Core Functions
- `apps/web/src/components/upload/upload-form.tsx` — orchestrates dropzone + progress + upload state
- `apps/web/src/components/upload/dropzone.tsx` — drag-and-drop via `react-dropzone`
- `apps/web/src/lib/api-client.ts` — `uploadFile()` using XHR for progress events
- `services/api/app/runtime/upload.py` — HTTP handler, reads file chunks
- `services/api/app/service/upload.py` — validates and writes to the `raw/` prefix
- `services/api/app/repo/b2_client.py` — `upload_file()` via boto3 `put_object`

## Canonical Files
- Upload handler pattern: `services/api/app/runtime/upload.py`
- Service orchestration pattern: `services/api/app/service/upload.py`

## Inputs
- file: `File` (browser multipart) — video only (mp4, webm, mov, mkv, avi)
- content_type: string (file MIME type)

## Outputs
- `FileUploadResponse`: key, filename, size, content_type, uploaded_at, url
- Side effect: file stored in B2 under `raw/{sanitized_filename}`

## Flow
- User drops or selects a video file in the dropzone
- Client validates size (max 500MB) and type — rejected files show a toast
- XHR sends multipart POST to `/upload` with progress events
- API checks `Content-Length` early, validates content type against the video allowlist, sanitizes the filename, validates extension↔MIME, reads in 1MB chunks with streaming size enforcement, rejects empty files
- API stores under `raw/{sanitized_filename}` and returns `FileUploadResponse`
- The video now appears in the Files explorer and is selectable in the dataset create form

## Edge Cases
- File exceeds 500MB → client rejection + API 413 if bypassed
- Non-video type → API 415
- Extension mismatches MIME → API 415
- No filename / empty file → API 400
- Duplicate filename → B2 creates a new version (buckets are versioned)
- B2 unreachable → API 500

## UX States
- Empty: dropzone with instructions
- Loading: per-file progress bars
- Error: red status icon, per-file message
- Complete: green checkmark, "Clear completed"

## Verification
- Test files: `services/api/tests/test_upload_conflict.py`, `services/api/tests/test_error_handling.py`
- Required cases: successful upload to `raw/`, non-video rejection, empty file, duplicate filename allowed
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Datasets explorer](datasets-explorer.md)
- [App Workflows](../app-workflows.md)
