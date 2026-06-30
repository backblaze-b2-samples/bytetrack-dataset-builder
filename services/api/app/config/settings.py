from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Backblaze B2 (Standard #3 env var names) ---
    # Region drives the S3 endpoint; we never store the full endpoint URL,
    # so there is no hardcoded region string anywhere in source.
    b2_region: str = "us-west-004"
    b2_application_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""
    b2_public_url_base: str = ""

    api_port: int = 8000
    # Explicit allowlist by default — covers Next on :3000 and the
    # fallback :3001 it picks if 3000 is busy. Production deploys should
    # override with the exact frontend origin.
    api_cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Optional dev-only escape hatch: a regex that matches additional
    # allowed origins. Empty by default — set this to e.g.
    # `^http://localhost:\d+$` to accept any localhost port without
    # listing each one. NEVER ship this to production.
    api_cors_origin_regex: str = ""

    # Upload limits — raw surveillance / dashcam / drone footage can be large.
    max_file_size: int = 500 * 1024 * 1024  # 500MB

    # Small durable counters (downloads, etc). Point at a persistent
    # volume in production if you care about surviving restarts.
    download_count_file: str = "data/download_count.json"

    # --- Tracking-dataset builder pipeline ---
    # Uploaded raw footage lands here; the build form and the bulk CLI both
    # list this prefix to find source videos.
    raw_prefix: str = "raw/"
    # Generated tracking datasets (records, annotations, per-track clips, MOT
    # releases) live under this prefix, isolated per dataset id.
    dataset_prefix: str = "dataset/"

    # Detection model id (Roboflow Inference). The default `rfdetr-base` is a
    # pre-trained COCO model that runs LOCALLY with NO API key; weights
    # auto-download on first use.
    detection_model: str = "rfdetr-base"
    # OPTIONAL. Unlocks Roboflow Universe models + hosted serverless inference.
    # NOT required — the default `rfdetr-base` runs keyless. Leave empty.
    roboflow_api_key: str = ""

    # Local CV engine knobs — CPU-friendly defaults so a short clip runs
    # without a GPU. The device is auto-detected (CUDA -> Apple MPS -> CPU)
    # at runtime; this is only the floor / explicit override.
    # "auto" lets the engine pick CUDA -> MPS -> CPU. Set "cpu"/"cuda"/"mps"
    # to force a device.
    device: str = "auto"

    # COCO classes tracked by default — the surveillance / dashcam set.
    # Comma-separated, case-insensitive class NAMES (model-agnostic; we match
    # on `sv.Detections.from_inference`'s class_name strings, not integer ids).
    track_classes: str = "person,car,truck,bus,bicycle,motorcycle"

    # Tracking + clip defaults (overridable per dataset build). Tuned for a
    # quick, no-GPU CPU demo run.
    detection_confidence: float = 0.25
    track_activation_threshold: float = 0.25
    min_track_length: int = 30
    track_buffer: int = 30
    # Caps a CPU demo at a few hundred frames so a build completes fast.
    max_frames: int = 300

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]

    @property
    def b2_endpoint(self) -> str:
        """Derive the S3-compatible endpoint from the region.

        Keeping only the region in config means no hardcoded endpoint /
        region string lives anywhere else in the source tree.
        """
        return f"https://s3.{self.b2_region}.backblazeb2.com"

    @staticmethod
    def _normalize_classes(raw: str) -> list[str]:
        """Comma-separated class names -> a lower-cased, trimmed, ordered list."""
        seen: list[str] = []
        for c in raw.split(","):
            name = c.strip().lower()
            if name and name not in seen:
                seen.append(name)
        return seen

    @property
    def track_class_list(self) -> list[str]:
        return self._normalize_classes(self.track_classes)


settings = Settings()
