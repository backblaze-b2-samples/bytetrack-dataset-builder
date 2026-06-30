#!/usr/bin/env python
"""Bulk-build tracking datasets for raw videos on B2.

Lists the raw/ prefix and runs the full detect -> ByteTrack -> clip -> MOT
pipeline (via the service layer) for each video, creating one dataset per
source. This is the write-amplification demo: one pass over the raw-footage
library fans out many labeled object tracks + clips + MOT releases on B2.

Run from the repo root:
    pnpm build:dataset                       # build a dataset for every video
    pnpm build:dataset -- --source KEY       # only this raw video
    pnpm build:dataset -- --max-frames 600   # raise the CPU frame cap

Or directly:
    cd services/api && .venv/bin/python scripts/build_dataset.py

Requires the CV stack (requirements-ml.txt). The default detector is keyless;
the .env at the repo root supplies B2 credentials. No GPU is required.
"""

import argparse
import logging
import sys
from pathlib import Path

# Make `app` importable when run as `python scripts/build_dataset.py`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from app.config import settings  # noqa: E402
from app.service.build import build_dataset  # noqa: E402
from app.service.datasets import create_dataset, list_sources  # noqa: E402
from app.service.engine import select_device  # noqa: E402
from app.types import DatasetConfig  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("build_dataset")


def main() -> int:
    parser = argparse.ArgumentParser(description="Bulk build tracking datasets from B2 video")
    parser.add_argument("--source", help="Only build for this raw video key")
    parser.add_argument("--model", default=settings.detection_model)
    parser.add_argument("--max-frames", type=int, default=settings.max_frames)
    parser.add_argument(
        "--classes",
        default=settings.track_classes,
        help="Comma-separated COCO class names to track",
    )
    args = parser.parse_args()

    log.info("Inference device: %s (auto-detected, CPU default)", select_device(settings.device))

    sources = list_sources()
    if args.source:
        sources = [s for s in sources if s.key == args.source]
    if not sources:
        log.info("No matching raw videos under raw/ — upload some first.")
        return 0

    classes = [c.strip().lower() for c in args.classes.split(",") if c.strip()]
    log.info("Building tracking datasets for %d raw video(s).", len(sources))
    failures = 0
    for i, s in enumerate(sources, start=1):
        log.info("[%d/%d] Building dataset for %s", i, len(sources), s.key)
        try:
            ds = create_dataset(
                name=s.filename,
                description=f"Auto-built from {s.key}",
                config=DatasetConfig(
                    source_key=s.key,
                    detection_model=args.model,
                    track_classes=classes,
                    max_frames=args.max_frames,
                ),
            )
            built = build_dataset(ds)
            log.info(
                "  -> %d tracks, %d clips (%.0fx amplification)",
                built.stats.tracks_total,
                built.stats.clips_generated,
                built.stats.tracks_per_video,
            )
        except Exception:  # keep going through the batch
            failures += 1
            log.exception("Failed: %s", s.key)

    log.info("Done. %d succeeded, %d failed.", len(sources) - failures, failures)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
