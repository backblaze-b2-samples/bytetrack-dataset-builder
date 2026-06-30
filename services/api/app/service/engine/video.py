"""OpenCV decode loop: video frames -> detect -> ByteTrack -> per-track boxes.

OpenCV (`cv2`, installed transitively by the `inference` runtime) is a heavy
dependency, so per the engine layout it lives here. This wires `detect` +
`track` over a decoded video and returns PLAIN per-track box records (no CV
types leak to the service layer), which the build service packages into
annotations, clips, and the MOT release.

Everything is imported lazily so the module stays importable for structural
tests without the CV runtime installed. This is local compute on a file the
repo already downloaded; it owns NO boto3.
"""

import logging

from app.service.engine import detect, track

logger = logging.getLogger(__name__)


def probe_video(path: str) -> dict:
    """Return {fps, width, height, frame_count} for a local video via OpenCV."""
    import cv2

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {path}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    finally:
        cap.release()
    return {"fps": fps, "width": width, "height": height, "frame_count": frame_count}


def detect_and_track(
    src_path: str,
    *,
    model_id: str,
    keep_classes: list[str],
    confidence: float,
    activation_threshold: float,
    track_buffer: int,
    max_frames: int,
    on_progress=None,
) -> dict:
    """Decode the video, run detection + ByteTrack on every frame, and collect
    per-track bounding boxes.

    Returns a plain dict (no CV types):
        {
          "fps": float, "width": int, "height": int,
          "frames_processed": int, "detections_total": int,
          "tracks": { track_id(int): {
              "class_name": str,
              "boxes": [ {frame, x, y, w, h, confidence}, ... ]
          } }
        }

    `keep_classes` are lower-cased COCO class names to retain; everything else
    is dropped before tracking. `max_frames` caps a CPU demo.
    """
    import cv2

    keep = set(keep_classes)
    cap = cv2.VideoCapture(src_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {src_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    tracker = track.new_tracker(activation_threshold, track_buffer, fps)
    tracks: dict[int, dict] = {}
    detections_total = 0
    idx = 0
    try:
        while idx < max_frames:
            ok, frame = cap.read()
            if not ok:
                break
            dets = detect.infer_frame(frame, model_id, confidence)
            dets = _filter_classes(dets, keep)
            tracked = track.track(tracker, dets)
            detections_total += len(tracked)
            _accumulate(tracks, tracked, idx)

            idx += 1
            if on_progress and (idx % 10 == 0 or idx == max_frames):
                on_progress(idx)
    finally:
        cap.release()

    return {
        "fps": float(fps),
        "width": width,
        "height": height,
        "frames_processed": idx,
        "detections_total": detections_total,
        "tracks": tracks,
    }


def _filter_classes(detections, keep: set[str]):
    """Keep only detections whose class name is in `keep` (empty = keep all)."""
    if not keep:
        return detections
    names = detect.class_names_of(detections)
    mask = [n in keep for n in names]
    return detections[mask]


def _accumulate(tracks: dict[int, dict], tracked, frame_idx: int) -> None:
    """Append this frame's tracked boxes to their per-track box lists."""
    if tracked.tracker_id is None:
        return
    names = detect.class_names_of(tracked)
    for i, tid in enumerate(tracked.tracker_id):
        tid = int(tid)
        x1, y1, x2, y2 = (float(v) for v in tracked.xyxy[i])
        conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
        name = names[i] or "object"
        entry = tracks.setdefault(tid, {"class_name": name, "boxes": []})
        entry["boxes"].append(
            {
                "frame": frame_idx,
                "x": round(x1, 2),
                "y": round(y1, 2),
                "w": round(x2 - x1, 2),
                "h": round(y2 - y1, 2),
                "confidence": round(conf, 4),
            }
        )
