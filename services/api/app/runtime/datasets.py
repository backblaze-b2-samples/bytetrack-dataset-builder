"""Datasets router: CRUD, build runs with live progress, stats, sources.

Thin HTTP layer — validation + status mapping only. All work flows through the
service layer (datasets / build / jobs); no boto3, no CV imports here.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.service import jobs
from app.service.build import run_job
from app.service.datasets import (
    DatasetLocked,
    DatasetNotFound,
    create_dataset,
    delete_dataset,
    get_dashboard_stats,
    get_dataset,
    list_datasets,
    list_sources,
    mark_building,
    serve_snippet,
    update_dataset,
)
from app.service.files import FileKeyError, get_download_url, get_preview_url
from app.types import (
    BuildJob,
    Dataset,
    DatasetConfig,
    DatasetStatsSummary,
    DatasetSummary,
    SourceVideo,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/datasets/sources", response_model=list[SourceVideo])
async def list_sources_endpoint():
    return list_sources()


@router.get("/datasets/stats", response_model=DatasetStatsSummary)
async def dataset_stats_endpoint():
    return get_dashboard_stats()


@router.get("/datasets", response_model=list[DatasetSummary])
async def list_datasets_endpoint():
    return list_datasets()


@router.post("/datasets", response_model=Dataset)
async def create_dataset_endpoint(payload: dict):
    name = (payload or {}).get("name", "")
    description = (payload or {}).get("description", "")
    config_data = (payload or {}).get("config") or {}
    try:
        config = DatasetConfig(**config_data)
        return create_dataset(name, description, config)
    except FileKeyError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.get("/datasets/{dataset_id}", response_model=Dataset)
async def get_dataset_endpoint(dataset_id: str):
    try:
        return get_dataset(dataset_id)
    except DatasetNotFound:
        raise HTTPException(status_code=404, detail="Dataset not found") from None


@router.get("/datasets/{dataset_id}/snippet")
async def dataset_snippet_endpoint(dataset_id: str):
    try:
        ds = get_dataset(dataset_id)
    except DatasetNotFound:
        raise HTTPException(status_code=404, detail="Dataset not found") from None
    return {"snippet": serve_snippet(ds)}


@router.patch("/datasets/{dataset_id}", response_model=Dataset)
async def update_dataset_endpoint(dataset_id: str, payload: dict):
    payload = payload or {}
    config = None
    if payload.get("config") is not None:
        try:
            config = DatasetConfig(**payload["config"])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from None
    try:
        return update_dataset(
            dataset_id,
            name=payload.get("name"),
            description=payload.get("description"),
            config=config,
        )
    except DatasetNotFound:
        raise HTTPException(status_code=404, detail="Dataset not found") from None
    except DatasetLocked:
        raise HTTPException(
            status_code=409,
            detail="Build config is locked after a successful build",
        ) from None
    except FileKeyError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None


@router.delete("/datasets/{dataset_id}")
async def delete_dataset_endpoint(dataset_id: str):
    try:
        deleted = delete_dataset(dataset_id)
    except DatasetNotFound:
        raise HTTPException(status_code=404, detail="Dataset not found") from None
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Failed to delete dataset") from None
    return {"deleted": True, "id": dataset_id, "objects": deleted}


@router.post("/datasets/{dataset_id}/build", response_model=BuildJob)
async def build_dataset_endpoint(dataset_id: str, background_tasks: BackgroundTasks):
    try:
        ds = get_dataset(dataset_id)
    except DatasetNotFound:
        raise HTTPException(status_code=404, detail="Dataset not found") from None

    existing = jobs.active_job_for(dataset_id)
    if existing is not None:
        return existing

    ds = mark_building(dataset_id)
    job = jobs.create_job(dataset_id)
    background_tasks.add_task(run_job, job.id, ds)
    logger.info("Enqueued build job=%s dataset=%s", job.id, dataset_id)
    return job


@router.get("/datasets/jobs/list", response_model=list[BuildJob])
async def list_jobs_endpoint():
    return jobs.list_jobs()


@router.get("/datasets/{dataset_id}/tracks/{track_id}/clip")
async def track_clip_endpoint(dataset_id: str, track_id: int):
    """Presigned URL for in-browser playback of a per-track cropped clip."""
    try:
        ds = get_dataset(dataset_id)
    except DatasetNotFound:
        raise HTTPException(status_code=404, detail="Dataset not found") from None
    track = next((t for t in ds.tracks if t.track_id == track_id), None)
    if track is None or not track.clip_key:
        raise HTTPException(status_code=404, detail="Track clip not found")
    try:
        return {"url": get_preview_url(track.clip_key)}
    except FileKeyError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None


@router.get("/datasets/{dataset_id}/releases/{version}/download")
async def release_download_endpoint(dataset_id: str, version: str):
    """Presigned download URL for a versioned MOT label release (labels.zip)."""
    try:
        ds = get_dataset(dataset_id)
    except DatasetNotFound:
        raise HTTPException(status_code=404, detail="Dataset not found") from None
    release = next((r for r in ds.releases if r.version == version), None)
    if release is None:
        raise HTTPException(status_code=404, detail="Release not found")
    try:
        return {"url": get_download_url(release.labels_zip_key)}
    except FileKeyError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
