"""Process-local dataset-build job registry.

EPHEMERAL by design: this tracks *live* progress (queued -> loading ->
detecting -> tracking -> clipping -> packaging -> done/error) for the UI.
It resets on restart and is not shared across workers. The authoritative answer
to "is this dataset built?" is the dataset.json manifest's status in B2 (see
service/datasets.py), never this registry.

Thread-safe so a FastAPI BackgroundTask thread can update progress while the
request thread reads it.
"""

import uuid
from datetime import UTC, datetime
from threading import Lock

from app.types import BuildJob, JobStatus

_jobs: dict[str, BuildJob] = {}
_lock = Lock()


def _now() -> str:
    return datetime.now(UTC).isoformat()


def create_job(dataset_id: str) -> BuildJob:
    """Register a new queued build job for a dataset and return it."""
    job_id = uuid.uuid4().hex
    now = _now()
    job = BuildJob(
        id=job_id,
        dataset_id=dataset_id,
        status="queued",
        progress=0.0,
        created_at=now,
        updated_at=now,
    )
    with _lock:
        _jobs[job_id] = job
    return job


def update_job(
    job_id: str,
    *,
    status: JobStatus | None = None,
    progress: float | None = None,
    message: str | None = None,
    error: str | None = None,
) -> None:
    """Patch a job's live fields. No-op if the job id is unknown."""
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        data = job.model_dump()
        if status is not None:
            data["status"] = status
        if progress is not None:
            data["progress"] = progress
        if message is not None:
            data["message"] = message
        if error is not None:
            data["error"] = error
        data["updated_at"] = _now()
        _jobs[job_id] = BuildJob(**data)


def get_job(job_id: str) -> BuildJob | None:
    with _lock:
        return _jobs.get(job_id)


def list_jobs() -> list[BuildJob]:
    with _lock:
        return sorted(_jobs.values(), key=lambda j: j.created_at, reverse=True)


def active_job_for(dataset_id: str) -> BuildJob | None:
    """Return a non-terminal job for this dataset, if any (avoid double-run)."""
    terminal = {"done", "error"}
    with _lock:
        for job in _jobs.values():
            if job.dataset_id == dataset_id and job.status not in terminal:
                return job
    return None
