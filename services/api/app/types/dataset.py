"""Pydantic models for the ByteTrack tracking-dataset builder.

Pure data — no logic, no imports from other app layers (types is the bottom
layer). These are the contract shared with the frontend via
packages/shared/src/types.ts.
"""

from typing import Literal

from pydantic import BaseModel

# Build-job lifecycle, surfaced live in the UI via service/jobs.py.
JobStatus = Literal[
    "queued",
    "loading",
    "detecting",
    "tracking",
    "clipping",
    "packaging",
    "done",
    "error",
]

DatasetStatus = Literal["draft", "building", "ready", "error"]


class DatasetConfig(BaseModel):
    """The build configuration for one dataset (editable while draft)."""

    # The raw source video this dataset is built from (a raw/ object key).
    source_key: str
    # Roboflow Inference model id. `rfdetr-base` is keyless COCO.
    detection_model: str = "rfdetr-base"
    # COCO class NAMES to keep (ordered, lower-cased on the server).
    track_classes: list[str] = [
        "person",
        "car",
        "truck",
        "bus",
        "bicycle",
        "motorcycle",
    ]
    # Detector + tracker thresholds. CPU-friendly defaults.
    detection_confidence: float = 0.25
    track_activation_threshold: float = 0.25
    min_track_length: int = 30
    track_buffer: int = 30
    # Caps a CPU demo at a few hundred frames so a build finishes fast.
    max_frames: int = 300


class TrackBox(BaseModel):
    """One bounding box for a track at one frame. MOT-style [x, y, w, h]."""

    frame: int
    x: float
    y: float
    w: float
    h: float
    confidence: float


class Track(BaseModel):
    """One persistent object track produced by ByteTrack."""

    track_id: int
    class_name: str
    # The video this track belongs to (its source-derived id), used for MOT.
    video_id: str
    frame_count: int
    start_frame: int
    end_frame: int
    # B2 keys for this track's exported artifacts.
    annotation_key: str
    clip_key: str | None = None
    # The first/representative bbox, for a compact list view.
    sample_box: TrackBox | None = None


class DatasetStats(BaseModel):
    """Roll-up stats for a built dataset (stored in dataset.json)."""

    frames_processed: int = 0
    detections_total: int = 0
    tracks_total: int = 0
    clips_generated: int = 0
    fps: float = 0.0
    # The headline B2 story: one raw video -> N labeled object tracks.
    tracks_per_video: float = 0.0
    classes_seen: list[str] = []


class Release(BaseModel):
    """A versioned MOT-format label release written under the dataset prefix."""

    version: str
    manifest_key: str
    labels_zip_key: str
    track_count: int
    video_count: int
    created_at: str


class Dataset(BaseModel):
    """Primary entity. The manifest persisted at dataset/<id>/dataset.json."""

    id: str
    name: str
    description: str = ""
    status: DatasetStatus = "draft"
    config: DatasetConfig
    stats: DatasetStats = DatasetStats()
    tracks: list[Track] = []
    releases: list[Release] = []
    error: str | None = None
    created_at: str
    updated_at: str


class DatasetSummary(BaseModel):
    """Lightweight dataset row for the list view (no per-track detail)."""

    id: str
    name: str
    description: str = ""
    status: DatasetStatus
    source_key: str
    tracks_total: int = 0
    clips_generated: int = 0
    release_count: int = 0
    created_at: str
    updated_at: str


class BuildJob(BaseModel):
    """Live, process-local build progress. Ephemeral — see service/jobs.py."""

    id: str
    dataset_id: str
    status: JobStatus
    progress: float = 0.0
    message: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


class DatasetStatsSummary(BaseModel):
    """Dashboard metrics derived from B2 listings + manifests."""

    footage_ingested: int
    datasets_built: int
    total_tracks: int
    total_clips: int
    total_releases: int
    storage_used_human: str


class SourceVideo(BaseModel):
    """An uploaded raw video selectable in the build form."""

    key: str
    filename: str
    size_bytes: int
    size_human: str
    uploaded_at: str
