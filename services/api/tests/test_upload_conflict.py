"""Unit tests for raw-footage upload handling."""

from app.service import upload as upload_service
from app.types import FileUploadResponse


def _fake_upload(file_data, key, content_type):
    return FileUploadResponse(
        key=key,
        filename="dashcam.mp4",
        size_bytes=len(file_data),
        size_human="5 B",
        content_type=content_type,
        uploaded_at="2026-02-14T00:00:00Z",
        url=None,
        metadata=None,
    )


def test_upload_allows_duplicate_filename(monkeypatch):
    """B2 is always versioned — re-uploading the same name creates a new version."""
    monkeypatch.setattr(upload_service, "upload_file", _fake_upload)

    result = upload_service.process_upload(
        file_data=b"hello",
        filename="dashcam.mp4",
        content_type="video/mp4",
        content_length=5,
    )

    assert result.key == "raw/dashcam.mp4"


def test_upload_writes_to_raw_prefix(monkeypatch):
    monkeypatch.setattr(upload_service, "upload_file", _fake_upload)

    result = upload_service.process_upload(
        file_data=b"hello",
        filename="dashcam.mp4",
        content_type="video/mp4",
        content_length=5,
    )

    assert result.key == "raw/dashcam.mp4"


def test_upload_rejects_non_video_type(monkeypatch):
    monkeypatch.setattr(upload_service, "upload_file", _fake_upload)

    try:
        upload_service.process_upload(
            file_data=b"hello",
            filename="report.pdf",
            content_type="application/pdf",
            content_length=5,
        )
    except upload_service.UploadError as e:
        assert e.status_code == 415
    else:  # pragma: no cover - assertion failure path
        raise AssertionError("Expected UploadError for non-video type")
