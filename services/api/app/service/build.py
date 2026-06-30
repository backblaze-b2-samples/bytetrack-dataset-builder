"""Tracking-dataset build pipeline: one raw video -> many object tracks.

Flow (the write-amplification story — 1 video -> N labeled tracks + clips):

    raw/<video>  --download-->  decode frames (OpenCV) -->
        rfdetr-base detection (Roboflow inference, keyless COCO) -->
        sv.ByteTrack association -> persistent per-object tracks -->
    write  dataset/<id>/annotations/<video_id>/<track_id>.json  (per track)
           dataset/<id>/clips/<track_id>.mp4                    (H.264 crop)
           dataset/<id>/releases/<version>/manifest.json + labels.zip (MOT gt.txt)
           dataset/<id>/dataset.json (manifest + stats)

This module owns NO boto3 — it calls the repo for all B2 I/O and the engine for
all local CV compute. The engine's heavy imports stay lazy, so importing this
module is cheap. Builds run in a background thread; progress is reported via the
ephemeral jobs registry.
"""

import logging
import os
import re
import tempfile
from datetime import UTC, datetime

from app.config import settings
from app.repo import get_object_bytes, put_bytes, put_json
from app.service import engine, jobs
from app.types import Dataset, DatasetStats, Release, Track, TrackBox

logger = logging.getLogger(__name__)


def manifest_key(dataset_id: str) -> str:
    return f"{settings.dataset_prefix}{dataset_id}/dataset.json"


def _annotation_key(dataset_id: str, video_id: str, track_id: int) -> str:
    return f"{settings.dataset_prefix}{dataset_id}/annotations/{video_id}/{track_id}.json"


def _clip_key(dataset_id: str, track_id: int) -> str:
    return f"{settings.dataset_prefix}{dataset_id}/clips/{track_id}.mp4"


def _release_prefix(dataset_id: str, version: str) -> str:
    return f"{settings.dataset_prefix}{dataset_id}/releases/{version}/"


def video_id_for(source_key: str) -> str:
    """Stable, filesystem-safe id derived from a raw video's object key."""
    base = os.path.splitext(os.path.basename(source_key))[0]
    return re.sub(r"[^A-Za-z0-9_-]+", "_", base).strip("_") or "video"


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _next_version(dataset: Dataset) -> str:
    """Next release label: v1, v2, ... based on existing releases."""
    return f"v{len(dataset.releases) + 1}"


def build_dataset(dataset: Dataset, job_id: str | None = None) -> Dataset:
    """Run the full detect -> track -> clip -> MOT pipeline for one dataset.

    Persists every artifact to B2 and returns the updated manifest. Raises on
    engine / B2 failure (caller records the error on the job + manifest).
    """

    def progress(status, pct, message=None):
        if job_id:
            jobs.update_job(job_id, status=status, progress=pct, message=message)

    cfg = dataset.config
    video_id = video_id_for(cfg.source_key)

    progress("loading", 0.05, "Downloading raw video from B2")
    media_bytes = get_object_bytes(cfg.source_key)
    suffix = os.path.splitext(cfg.source_key)[1] or ".mp4"
    fd, src_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(media_bytes)

        progress("detecting", 0.15, "Detecting + tracking objects (ByteTrack)")

        def on_frame(done: int):
            frac = min(done / max(1, cfg.max_frames), 1.0)
            progress("tracking", 0.15 + 0.55 * frac, f"Tracking frame {done}/{cfg.max_frames}")

        result = engine.video.detect_and_track(
            src_path,
            model_id=cfg.detection_model,
            keep_classes=[c.lower() for c in cfg.track_classes],
            confidence=cfg.detection_confidence,
            activation_threshold=cfg.track_activation_threshold,
            track_buffer=cfg.track_buffer,
            max_frames=cfg.max_frames,
            on_progress=on_frame,
        )

        tracks, clips_generated = _export_tracks(
            dataset, video_id, src_path, result, cfg.min_track_length, progress
        )

        release = _cut_release(dataset, video_id, tracks, result, progress)
    finally:
        if os.path.exists(src_path):
            os.unlink(src_path)

    stats = _stats(result, tracks, clips_generated)
    updated = dataset.model_copy(
        update={
            "status": "ready",
            "stats": stats,
            "tracks": tracks,
            "releases": [*dataset.releases, release],
            "error": None,
            "updated_at": _now(),
        }
    )
    put_json(manifest_key(dataset.id), updated.model_dump())

    progress("done", 1.0, f"Built {len(tracks)} tracks ({stats.tracks_per_video:g}x)")
    logger.info(
        "Built dataset id=%s tracks=%d clips=%d frames=%d",
        dataset.id,
        len(tracks),
        clips_generated,
        result["frames_processed"],
    )
    return updated


def _export_tracks(dataset, video_id, src_path, result, min_len, progress):
    """Write per-track annotation JSON + cropped H.264 clip; return Track models."""
    raw_tracks = result["tracks"]
    kept = {tid: t for tid, t in raw_tracks.items() if len(t["boxes"]) >= min_len}
    tracks: list[Track] = []
    clips_generated = 0
    total = max(1, len(kept))
    for i, (tid, t) in enumerate(sorted(kept.items())):
        boxes = t["boxes"]
        progress("clipping", 0.7 + 0.2 * (i / total), f"Exporting track {tid}")

        ann_key = _annotation_key(dataset.id, video_id, tid)
        put_json(ann_key, engine.mot.annotation_payload(tid, t["class_name"], video_id, boxes))

        clip_key = None
        clip_bytes = engine.clips.encode_track_clip(
            src_path, boxes, result["fps"], result["width"], result["height"]
        )
        if clip_bytes:
            clip_key = _clip_key(dataset.id, tid)
            put_bytes(clip_key, clip_bytes, "video/mp4")
            clips_generated += 1

        first = boxes[0]
        tracks.append(
            Track(
                track_id=tid,
                class_name=t["class_name"],
                video_id=video_id,
                frame_count=len(boxes),
                start_frame=boxes[0]["frame"],
                end_frame=boxes[-1]["frame"],
                annotation_key=ann_key,
                clip_key=clip_key,
                sample_box=TrackBox(**first),
            )
        )
    return tracks, clips_generated


def _cut_release(dataset, video_id, tracks, result, progress):
    """Write a versioned MOT release: gt.txt -> labels.zip + manifest.json."""
    progress("packaging", 0.92, "Writing MOT release to B2")
    version = _next_version(dataset)
    prefix = _release_prefix(dataset.id, version)

    gt_lines: list[str] = []
    for t in tracks:
        boxes = result["tracks"][t.track_id]["boxes"]
        gt_lines.extend(engine.mot.mot_gt_lines(t.track_id, boxes))

    labels_zip = engine.mot.build_labels_zip(video_id, gt_lines)
    labels_key = f"{prefix}labels.zip"
    put_bytes(labels_key, labels_zip, "application/zip")

    classes = sorted({t.class_name for t in tracks})
    manifest = engine.mot.release_manifest(
        version=version,
        video_id=video_id,
        classes=classes,
        track_count=len(tracks),
        clip_count=sum(1 for t in tracks if t.clip_key),
        params={
            "detection_model": dataset.config.detection_model,
            "track_classes": dataset.config.track_classes,
            "detection_confidence": dataset.config.detection_confidence,
            "track_activation_threshold": dataset.config.track_activation_threshold,
            "min_track_length": dataset.config.min_track_length,
            "track_buffer": dataset.config.track_buffer,
            "max_frames": dataset.config.max_frames,
        },
        created_at=_now(),
    )
    manifest_k = f"{prefix}manifest.json"
    put_json(manifest_k, manifest)

    return Release(
        version=version,
        manifest_key=manifest_k,
        labels_zip_key=labels_key,
        track_count=len(tracks),
        video_count=1,
        created_at=manifest["created_at"],
    )


def _stats(result, tracks, clips_generated) -> DatasetStats:
    classes = sorted({t.class_name for t in tracks})
    return DatasetStats(
        frames_processed=result["frames_processed"],
        detections_total=result["detections_total"],
        tracks_total=len(tracks),
        clips_generated=clips_generated,
        fps=round(result["fps"], 2),
        # One raw video -> N persistent object tracks. The headline B2 story.
        tracks_per_video=float(len(tracks)),
        classes_seen=classes,
    )


def run_job(job_id: str, dataset: Dataset) -> None:
    """Background entrypoint: run the build, recording errors on job + manifest."""
    try:
        build_dataset(dataset, job_id=job_id)
    except Exception as e:  # surface any failure on the job + manifest
        logger.exception("Build job failed: dataset=%s", dataset.id)
        jobs.update_job(job_id, status="error", error=str(e))
        failed = dataset.model_copy(
            update={"status": "error", "error": str(e), "updated_at": _now()}
        )
        try:
            put_json(manifest_key(dataset.id), failed.model_dump())
        except Exception:  # best effort — the job already carries the error
            logger.exception("Failed to persist error manifest: %s", dataset.id)
