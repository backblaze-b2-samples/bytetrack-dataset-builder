"""Engine tests that run WITHOUT the heavy CV stack installed.

These guard the lazy-import contract: importing the engine package and its
modules must not pull in inference/supervision/cv2/torch. They also exercise the
pure-python paths (device autodetect, MOT packaging) that need no model
download or video decode.
"""

import builtins
import sys
import zipfile


def test_engine_imports_without_cv_stack():
    """Importing the engine package must not import the heavy CV modules."""
    import app.service.engine  # noqa: F401
    from app.service import build  # noqa: F401

    # None of the heavy deps should have been imported as a side effect.
    for heavy in ("torch", "inference", "supervision", "cv2", "imageio_ffmpeg"):
        assert heavy not in sys.modules, f"{heavy} was eagerly imported"


def test_device_defaults_to_cpu_without_torch(monkeypatch):
    """With torch absent, the device helper reports CPU (never require a GPU).

    Simulate torch being uninstalled by making its import raise, so the result
    is deterministic regardless of the test host (a dev Mac has torch+MPS, CI
    may have neither) — otherwise this asserts on whatever accelerator the host
    happens to expose.
    """
    real_import = builtins.__import__

    def _no_torch(name, *args, **kwargs):
        if name == "torch" or name.startswith("torch."):
            raise ImportError("torch absent (simulated)")
        return real_import(name, *args, **kwargs)

    monkeypatch.delitem(sys.modules, "torch", raising=False)
    monkeypatch.setattr(builtins, "__import__", _no_torch)

    from app.service.engine.device import select_device

    assert select_device("auto") == "cpu"


def test_device_auto_returns_valid_device():
    """Auto-detect never raises and only ever returns a known device string."""
    from app.service.engine.device import select_device

    assert select_device("auto") in {"cpu", "cuda", "mps"}


def test_device_honors_explicit_override():
    from app.service.engine.device import select_device

    assert select_device("cuda") == "cuda"
    assert select_device("mps") == "mps"


def test_mot_gt_lines_are_one_indexed():
    """MOTChallenge gt.txt frames are 1-indexed; our decode loop is 0-indexed."""
    from app.service.engine import mot

    boxes = [
        {"frame": 0, "x": 10.0, "y": 20.0, "w": 30.0, "h": 40.0, "confidence": 0.9},
        {"frame": 1, "x": 11.0, "y": 21.0, "w": 30.0, "h": 40.0, "confidence": 0.8},
    ]
    lines = mot.mot_gt_lines(7, boxes)
    assert lines[0].startswith("1,7,10.00,20.00,30.00,40.00,0.9000,-1,-1,-1")
    assert lines[1].startswith("2,7,")


def test_build_labels_zip_has_mot_layout():
    """labels.zip contains <video_id>/gt/gt.txt in canonical MOT order."""
    from app.service.engine import mot

    lines = ["2,1,0,0,1,1,0.5,-1,-1,-1", "1,1,0,0,1,1,0.5,-1,-1,-1"]
    data = mot.build_labels_zip("clip01", lines)
    with zipfile.ZipFile(__import__("io").BytesIO(data)) as zf:
        assert "clip01/gt/gt.txt" in zf.namelist()
        body = zf.read("clip01/gt/gt.txt").decode()
    # Sorted by (frame, track) -> frame 1 must come before frame 2.
    assert body.splitlines()[0].startswith("1,")
    assert body.splitlines()[1].startswith("2,")


def test_annotation_payload_shape():
    from app.service.engine import mot

    boxes = [{"frame": 0, "x": 1, "y": 2, "w": 3, "h": 4, "confidence": 0.7}]
    payload = mot.annotation_payload(3, "car", "clip01", boxes)
    assert payload["track_id"] == 3
    assert payload["class_name"] == "car"
    assert payload["video_id"] == "clip01"
    assert payload["frame_count"] == 1
    assert payload["boxes"] == boxes


def test_video_id_is_filesystem_safe():
    from app.service.build import video_id_for

    assert video_id_for("raw/Dashcam Clip 01.mp4") == "Dashcam_Clip_01"
    assert video_id_for("raw/highway-feed.mov") == "highway-feed"
