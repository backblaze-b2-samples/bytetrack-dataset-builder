"""Local CV inference engine for the tracking-dataset builder.

Everything here is LAZY: heavy dependencies (inference, supervision, cv2,
imageio-ffmpeg, torch) are imported *inside the functions*, never at module top
level. That keeps the API bootable and `pnpm test:api` / `pnpm check:structure`
green without requirements-ml.txt installed.

This package performs local compute on bytes already pulled from B2 by the repo
layer (the boto3-only-in-repo invariant stays intact — CV inference is compute,
not storage). The named, central component is ByteTrack (`sv.ByteTrack` in
track.py); `rfdetr-base` (keyless COCO) is the supporting detector.

A MissingMLDependencies error is raised with an actionable message when the
heavy stack is absent, so callers can surface a clear "install
requirements-ml.txt" hint instead of an opaque ImportError.
"""

from app.service.engine import clips, detect, mot, track, video
from app.service.engine.device import select_device
from app.service.engine.errors import MissingMLDependencies

__all__ = [
    "MissingMLDependencies",
    "clips",
    "detect",
    "mot",
    "select_device",
    "track",
    "video",
]
