# Build plan — `bytetrack-dataset-builder`

Source of truth for the starter tree: `.claude/scratch/vcsk-f15ea2ab-be2c-4cc8-8052-33af2ceff6af/`
(vibe-coding-starter-kit, cloned fresh in Phase 0). All keep/trim/add deltas below
are computed against that tree.

Two in-repo sibling samples are the proven references for this exact app shape —
the builder should mirror them closely:
- **`../whisper-dataset-builder`** — the canonical *dataset-builder* skeleton:
  Standard-#3 env vars, primary entity "Dataset" with full create/read/edit/delete/run,
  `service/engine/` layout (device autodetect, `_torch_safe.py`), `repo/` = B2 only.
- **`../supervision-sports-highlights`** — the proven *detector + tracker* stack:
  Roboflow `inference` (`rfdetr-base`, COCO, **local + keyless**) for boxes +
  `sv.ByteTrack()` for persistent IDs.

---

## 1. Purpose

`bytetrack-dataset-builder` turns raw surveillance / dashcam / drone footage stored in
Backblaze B2 into **training-ready multi-object-tracking datasets**. A data engineer
uploads raw video to B2, creates a *Tracking Dataset*, and the app runs an object
detector + **ByteTrack** locally to associate detections into persistent object tracks.
It then exports, back into B2: per-track annotation JSON, a cropped video clip per
tracked object, and a versioned **MOT-format** label release (`gt.txt` per video +
manifest) ready to feed a tracker-training pipeline. It is for computer-vision and
autonomous-vehicle teams who need to convert large raw-video archives into labeled MOT
datasets, and it shows B2 as the storage layer for raw video, per-track clips,
annotations, and versioned releases — all over the **S3-compatible API**, keyless,
no second cloud (B2 credentials only).

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit is the ceiling. Keep the whole shared scaffold (UI kit, layered FastAPI,
TanStack Query data layer, structural tests, `/health` + `/metrics`, doctor preflight,
Upload + Files + Settings + Design). Strip only the illustrative dashboard defaults;
add the tracking-dataset engine + the primary-entity surface.

### KEEP (as-is — starter contract, do not strip/rename/replace)
- Entire UI kit: `apps/web/src/components/ui/**`, design tokens in `globals.css`, `/design` page.
- **Bucket explorer (NON-NEGOTIABLE keep):** `/files` route + `apps/web/src/app/files/**`
  + `apps/web/src/components/files/**` — full-bucket browse. Stays in the sidebar.
- **Upload:** `/upload` route + `apps/web/src/components/upload/**` — repurposed as the raw-footage
  *ingest* surface (uploads land under the `raw/` prefix — see §4 ingest). Stays in the sidebar.
- Settings page (`/settings`), `danger-zone.tsx`, `settings-form.tsx` (the form-UX exemplar — see §4).
- Backend layered architecture (`types -> config -> repo -> service -> runtime`) + all
  structural/boundary tests, ruff/eslint config, `/health`, `/metrics`, JSON logging,
  CORS-on-errors middleware ordering, `scripts/` (dev/doctor/pick-port), `infra/railway`.
- TanStack Query data layer contract: every new endpoint touches exactly
  `runtime/<router>.py` + `lib/api-client.ts` + `lib/queries.ts`. No bare `useEffect+fetch`.

### TRIM (remove starter defaults that this app replaces)
- Dashboard illustrative defaults — `apps/web/src/components/dashboard/{stats-cards,upload-chart,recent-uploads-table}.tsx`
  get **rewritten** (not deleted) to tracking-dataset metrics (§ Dashboard below). `docs/features/dashboard.md` updated same change.
- Starter feature docs that no longer apply: rewrite `metadata-extraction.md` → tracking-dataset docs
  (see §5). No starter source files are deleted outright — the kit is mostly kept.

### ADD (new for `bytetrack-dataset-builder`)
- **Primary entity "Tracking Dataset"** — new route `/datasets`, mirroring
  `whisper-dataset-builder`'s primary-entity surface, with full lifecycle UI (§4).
- **Scoped asset explorer (NON-NEGOTIABLE add):** the Dataset *detail* view is the
  sample-specific explorer scoped to this app's own `dataset/<id>/` prefix — it lists the
  dataset's tracks, plays each cropped per-track clip, and links its annotation JSON + MOT
  release. Distinct from the full-bucket `/files` explorer (which is kept). (Analog of the
  TTS "Library" requirement.)
- Backend `service/engine/` (local CV engine): `device.py` (CUDA→MPS→CPU autodetect),
  `detect.py` (Roboflow `inference` adapter), `track.py` (`sv.ByteTrack` loop),
  `clips.py` (per-track crop+encode), `mot.py` (annotation JSON + MOT `gt.txt` + manifest),
  `errors.py`, `_torch_safe.py` (mirror whisper's torch-load guard if torch weights are loaded).
- Backend `service/{datasets,build,jobs}.py` + `repo/dataset_store.py` (B2 read/write of records,
  annotations, clips, releases; **scoped** deletes).
- Backend `runtime/datasets.py` router.
- Frontend `apps/web/src/app/datasets/page.tsx` + `apps/web/src/components/datasets/{datasets-list,dataset-form,dataset-edit,dataset-detail,track-row}.tsx`.
- Sidebar nav entry "Datasets". Header `pageTitles` entry for `/datasets`.

**Note on the bucket-explorer tension:** none — the full-bucket `/files` explorer is kept
unchanged *and* the scoped per-dataset explorer is added on top. No conflict.

## 3. B2 surface (S3-compatible API only — no b2-native)

Single boto3 S3 client in `repo/b2_client.py`, `signature_version=s3v4`,
`user_agent_extra="b2ai-bytetrack-dataset-builder"`. Operations exercised:

| Op | Where | Why |
|----|-------|-----|
| `put_object` | upload raw video (`raw/`), write annotations, clips, release manifest+labels.zip, dataset record JSON | ingest + all dataset outputs |
| `get_object` | download raw video to a temp file for local decode; fetch records/manifests | run the engine + render detail |
| `list_objects_v2` | source picker (`raw/`), dataset list, per-dataset asset listing, full-bucket `/files`, dashboard stats (paginated) | browse + metrics |
| `head_object` | object metadata | detail / files |
| `delete_object` | **scoped** delete: enumerate keys under `dataset/<dataset_id>/` (and only those) and delete each | delete a dataset's artifacts without touching shared data |
| `generate_presigned_url` | serve raw-video preview, per-track clip mp4, downloadable release archive to the browser | media playback + downloads |

**No b2-native API anywhere.** All five Standard-#3 env vars used (see §6). This is a
deviation-free S3-only sample.

## 4. Key features (seed README + `docs/features/*.md`)

1. **Ingest raw footage to B2** — drag-and-drop upload of raw video into the `raw/` prefix
   (repurposed starter Upload). `deployment: local` (pure B2 I/O, no provider).
2. **Detect + track with ByteTrack (local, keyless)** — Roboflow `inference` `rfdetr-base`
   (COCO, weights auto-download, no API key) supplies per-frame boxes; **`sv.ByteTrack`**
   associates them into persistent track IDs via its byte-level association. Tracked COCO
   classes default to surveillance/dashcam set (person, car, truck, bus, bicycle, motorcycle),
   configurable. `deployment: local` — **CPU default, device auto-detected CUDA→MPS→CPU**
   per `api-provider-selection.md` hard rule (mirror `whisper-dataset-builder/service/engine/device.py`).
3. **Per-track annotation export** — one JSON per track (frame IDs, bbox `[x,y,w,h]`, conf,
   track_id, class label) written under the dataset prefix. `deployment: local`.
4. **Per-track cropped clips** — a short mp4 cropped to each track's padded bounding region
   (constant crop size = padded union of the track's boxes, so the object stays in frame),
   browser-playable H.264. `deployment: local`.
5. **Versioned MOT-format release** — `manifest.json` (videos, classes, track/clip counts,
   params, created_at) + `labels.zip` containing MOTChallenge `gt.txt` per source video,
   written to a versioned release prefix for direct training consumption. `deployment: local`.
6. **Tracking-dataset dashboard** — datasets built, total tracks extracted, clips generated,
   releases, B2 storage used; recent-builds table + a tracks-per-dataset chart.

**External API provider:** NONE. The entire heavy workload (detection + tracking + crop +
packaging) runs on-device → every feature is `deployment: local`, keyless, $0.00 per demo
run, no provider env var. The optional `ROBOFLOW_API_KEY` is **not required** and is omitted
from the required-env set (default `rfdetr-base` runs locally without it; mirror
sports-highlights' optional handling — do not require it).

**Genblaze:** not applicable — the description's stack is ByteTrack (local OSS), no
Genblaze / `genblaze-*` mention. Do **not** route through the Genblaze SDK.

### Vendor-fidelity note (record in plan + README)
Theme = **ByteTrack** (the tracker). We run the genuine ByteTrack association algorithm via
`supervision`'s maintained, pip-installable `sv.ByteTrack` — a faithful implementation of the
ByteTrack paper, **not a substitute tracker** (not DeepSORT/OC-SORT). It is the central,
named component (`sv.ByteTrack()` in `service/engine/track.py`). The detector (`rfdetr-base`,
keyless COCO) is a supporting box source, exactly as in the published
`supervision-sports-highlights` sample. README/docs attribute ByteTrack
(https://github.com/ifzhang/ByteTrack) and explain that the maintained `supervision`
implementation is used so the sample stays CPU-runnable and keyless. This satisfies vendor
fidelity (genuine ByteTrack algorithm, central to the app) — recorded as a justified choice,
not a deviation.

### Primary-entity lifecycle (mandatory UI completeness)
**Primary entity = "Tracking Dataset"** (a build config bound to one source video that, once
built, owns its tracks/annotations/clips/MOT release). State persisted as JSON on B2 under
the app prefix (no DB) — mirror `whisper-dataset-builder`'s record store. ALL lifecycle verbs
are built in the UI (target: `omitted_ui_verbs = []`):

| Verb | Endpoint | UI |
|------|----------|----|
| **create** | `POST /datasets` | `dataset-form.tsx` — New Dataset dialog/page |
| **read** | `GET /datasets`, `GET /datasets/{id}` | `datasets-list.tsx` + `dataset-detail.tsx` (the scoped asset explorer) |
| **edit** | `PATCH /datasets/{id}` | `dataset-edit.tsx` — edit name + tracking params before/after a run |
| **delete** | `DELETE /datasets/{id}` | delete action in `dataset-detail.tsx` (alert-dialog), **scoped** B2 cleanup |
| **run** | `POST /datasets/{id}/build` | "Build" / "Re-build" action in `dataset-detail.tsx` (a re-build cuts a new release version) |

No verb is omitted; none requires a justification entry.

### Form UX conventions (mirror `settings-form.tsx`)
CREATE form (`dataset-form.tsx`) and EDIT form (`dataset-edit.tsx`):
- **Selector (finite values → `Select`/`RadioGroup`, never free text):**
  - *Source video* → `Select` populated from `list_objects_v2(prefix="raw/")` (finite set).
  - *Detection model* → `Select` (default `rfdetr-base`).
  - *Classes to track* → multi-select checkbox group over the COCO surveillance set.
- **Free text:** dataset *name*, release *version label* (default `v1`).
- **Numeric params with safe defaults** surfaced as `placeholder` / `FormDescription` guidance
  (NOT an autofill button), for a sound CPU demo run:
  - detection confidence `0.25`, track activation `0.25`, min track length `30` frames,
    track buffer `30`, **max frames `300`** (caps a CPU demo at a few hundred frames so it
    completes fast — document this clearly).
- The default-hint rule applies to CREATE only; EDIT opens pre-filled with the real record.

## 5. Doc transforms
- **Rewrite** `README.md` end-to-end to the new app (title, what-it-does, the
  ingest→detect/track→export→release workflow, B2 layout, ByteTrack attribution + fidelity
  note, quickstart with Standard-#3 env vars). Replace all starter branding.
- **Rewrite** `AGENTS.md` §2/§ map references and `ARCHITECTURE.md` data-flow to describe the
  tracking-dataset pipeline + `service/engine/` layer.
- `docs/features/`: **rewrite** `dashboard.md`; **delete** `metadata-extraction.md`; **keep**
  `file-upload.md` + `file-browser.md` (still accurate); **add stubs** from `_template.md`:
  `tracking-datasets.md`, `bytetrack-pipeline.md`, `mot-release.md`.
- Update `docs/app-workflows.md` (user journey: upload raw → create dataset → build → inspect
  tracks/clips → download MOT release) and `docs/dev-workflows.md` (engine knobs, device, ffmpeg).
- Keep `SECURITY.md` / `RELIABILITY.md`; add a line on scoped-delete safety to `SECURITY.md`.

## 6. Standardization + known-pitfall checklist (MUST DO — these are recurring defects)

1. **Env vars → Standard #3** (starter ships the old names; this is a recurring miss). Mirror
   `whisper-dataset-builder` exactly:
   - `config/settings.py`: `b2_application_key_id`, `b2_application_key`, `b2_bucket_name`,
     `b2_region` (default `us-west-004`), `b2_public_url_base`; add a `b2_endpoint` **property**
     deriving `https://s3.{b2_region}.backblazeb2.com` (no hardcoded endpoint/region elsewhere).
   - `repo/b2_client.py`: use the derived endpoint + the new key/secret fields;
     `user_agent_extra="b2ai-bytetrack-dataset-builder"`.
   - `services/api/main.py`: update `REQUIRED_B2_SETTINGS` + `PLACEHOLDER_VALUES` to the new names.
   - `.env.example`, `README.md`, `scripts/doctor.mjs` (if it checks env names), `infra/railway/**`.
   - Add app env: `RAW_PREFIX=raw/`, `DATASET_PREFIX=dataset/`, `DEVICE=auto`,
     `DETECTION_MODEL=rfdetr-base`, `TRACK_CLASSES=person,car,truck,bus,bicycle,motorcycle`,
     `MAX_FRAMES=300` (+ the threshold defaults).
2. **Custom UA** on the S3 client: `b2ai-bytetrack-dataset-builder`. **UTM content tag**
   `utm_content=b2ai-bytetrack-dataset-builder` everywhere it appears.
3. **Header/branding leak:** rebrand via `apps/web/src/lib/app-config.ts`
   (`APP_NAME="ByteTrack Dataset Builder"`, fitting `APP_DESCRIPTION`). Add `/datasets` to the
   header `pageTitles` map. No app name hardcoded in `header.tsx`.
4. **Clip encoding for browser playback:** write per-track clips as **H.264 / yuv420p, faststart**
   so they `<video>`-play in the verify/screenshot steps. Use a libx264-capable encoder
   (`imageio[ffmpeg]` / `imageio-ffmpeg` bundled binary preferred over bare Homebrew `ffmpeg`,
   which may be slim). Read frames with OpenCV. Do NOT rely on `cv2.VideoWriter` `mp4v` (not
   universally browser-playable).
5. **Requirements pins (avoid false-green clean installs):** mirror the proven
   `supervision-sports-highlights` CV pins — `inference>=0.30.0`, `supervision>=0.25.0`,
   plus `opencv-python-headless`, `imageio-ffmpeg`, `imageio[ffmpeg]`. Keep the starter's
   pinned fastapi/uvicorn/pydantic/boto3 + ruff/pytest. If torch is pulled transitively and
   weights are loaded, add the `add_safe_globals` guard (`_torch_safe.py`, mirror whisper).
6. **Layering:** B2/boto3 stays **only** in `repo/`. The CV engine (inference/supervision/cv2/
   imageio/torch) lives in `service/engine/` — this matches the accepted
   `whisper-dataset-builder` precedent (the `test_boto3_only_in_repo` structural test guards
   boto3 only; local-compute engines in `service/` are fine). Keep every file < 300 lines.
7. **Scoped deletes (safety):** `dataset_store.delete_dataset` must list keys under exactly
   `dataset/<dataset_id>/` (+ the record key) and delete only those. Never a bucket-wide or
   prefix-wide-of-another-app delete.
8. **B2 object layout** (per-dataset isolation enables safe scoped deletes — a justified
   refinement of the description's literal paths, all named components preserved):
   - record: `dataset/<dataset_id>/dataset.json`
   - annotations: `dataset/<dataset_id>/annotations/<video_id>/<track_id>.json`
   - clips: `dataset/<dataset_id>/clips/<track_id>.mp4`
   - release: `dataset/<dataset_id>/releases/<version>/manifest.json` + `labels.zip` (MOT `gt.txt` per video)
9. **Frontend wiring is not optional:** every new route must resolve and be reachable from the
   sidebar; `pnpm lint` + `pnpm build` must pass (no unused imports, no 404 nav). The build
   pipeline must run with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` so the doc+frontend phases
   aren't truncated by the 600s ceiling.

## 7. Rename table (`vibe-coding-starter-kit` → `bytetrack-dataset-builder`)

| Identifier | From | To |
|------------|------|----|
| Display name | Vibe Coding Starter Kit / OSS Starter Kit | **ByteTrack Dataset Builder** |
| kebab dir/slug | vibe-coding-starter-kit | bytetrack-dataset-builder |
| npm workspace scope | `@vibe-coding-starter-kit/web` | `@bytetrack-dataset-builder/web` |
| root `package.json` name | vibe-coding-starter-kit | bytetrack-dataset-builder |
| pnpm `--filter` in README/scripts | `@vibe-coding-starter-kit/web` | `@bytetrack-dataset-builder/web` |
| FastAPI `title=` (main.py) | OSS Starter Kit API | ByteTrack Dataset Builder API |
| `APP_NAME` (app-config.ts) | OSS Starter Kit | ByteTrack Dataset Builder |
| S3 `user_agent_extra` | b2ai-oss-start | b2ai-bytetrack-dataset-builder |
| UTM `utm_content=` | b2ai-oss-start | b2ai-bytetrack-dataset-builder |
| infra/railway service slug + image tag | vibe-coding-starter-kit | bytetrack-dataset-builder |
| e2e/workflow/doc references | "Vibe Coding Starter Kit" | "ByteTrack Dataset Builder" |

Grep the whole tree for `vibe-coding-starter-kit`, `Vibe Coding Starter Kit`, `OSS Starter Kit`,
`oss-starter-kit`, `b2ai-oss-start`, `b2_key_id`/`B2_KEY_ID`, `b2_endpoint`/`B2_ENDPOINT`,
`b2_public_url`/`B2_PUBLIC_URL` and replace per the tables above.

---

### Build order (suggested)
1. Copy starter tree → strip git → rename identifiers (table §7) + env standardization (§6.1–3).
2. Backend: `repo/{b2_client,dataset_store}.py`, `service/engine/*`, `service/{datasets,build,jobs}.py`,
   `runtime/datasets.py`, shared types; tests for each behavior; keep structural tests green.
3. Frontend: `lib/{api-client,queries}.ts` endpoints, `app/datasets/page.tsx`,
   `components/datasets/*`, sidebar + header, dashboard rewrite.
4. Docs (§5) + README + `.env.example`.
5. Verify: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build`.
