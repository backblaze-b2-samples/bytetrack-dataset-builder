"""ByteTrack multi-object tracking — the central, named component.

This runs the genuine ByteTrack association algorithm via `supervision`'s
maintained, pip-installable `sv.ByteTrack` (a faithful implementation of the
ByteTrack paper, https://github.com/ifzhang/ByteTrack — NOT a substitute
tracker like DeepSORT/OC-SORT). The keyless `rfdetr-base` detector is a
supporting box source; ByteTrack is what turns per-frame detections into
persistent object tracks via its byte-level (high- + low-confidence)
association.

`supervision` is imported lazily so the module stays importable without the CV
runtime installed (structural tests). No boto3 — local compute only.
"""


def new_tracker(activation_threshold: float, track_buffer: int, fps: float):
    """Return a fresh `sv.ByteTrack` tracker configured for one video.

    One tracker instance per video so track ids never collide across sources.
    """
    import supervision as sv

    return sv.ByteTrack(
        track_activation_threshold=activation_threshold,
        lost_track_buffer=track_buffer,
        frame_rate=max(1, round(fps)),
    )


def track(tracker, detections):
    """Advance ByteTrack with this frame's detections.

    Returns tracked detections carrying `tracker_id` for every associated box.
    """
    return tracker.update_with_detections(detections)
