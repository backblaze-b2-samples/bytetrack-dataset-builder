"""Per-track cropped clip encoding — browser-playable H.264.

For each object track we crop the source video to a CONSTANT region (the padded
union of that track's boxes, so the object stays in frame for the whole clip)
and encode an mp4 with H.264 / yuv420p / +faststart so it plays inline in a
`<video>` element (and in the verify/screenshot steps).

Encoding goes through the `imageio-ffmpeg` BUNDLED ffmpeg binary, NOT bare
Homebrew `ffmpeg` (which now ships slim) and NOT `cv2.VideoWriter` `mp4v`
(not universally browser-playable). Frames are read with OpenCV and piped to
that libx264-capable binary.

Heavy imports (cv2, imageio_ffmpeg) are lazy; this module is importable for
structural tests without the CV stack. No boto3 — returns clip bytes for the
repo to store.
"""

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger(__name__)

# Fixed even crop dimensions (libx264 + yuv420p require even width/height).
_PAD_RATIO = 0.15


def _even(n: int) -> int:
    return n if n % 2 == 0 else n + 1


def _crop_region(boxes: list[dict], vid_w: int, vid_h: int) -> tuple[int, int, int, int]:
    """Padded union of a track's boxes, clamped to the frame. Returns x,y,w,h."""
    x0 = min(b["x"] for b in boxes)
    y0 = min(b["y"] for b in boxes)
    x1 = max(b["x"] + b["w"] for b in boxes)
    y1 = max(b["y"] + b["h"] for b in boxes)
    pad_x = (x1 - x0) * _PAD_RATIO
    pad_y = (y1 - y0) * _PAD_RATIO
    x0 = max(0, int(x0 - pad_x))
    y0 = max(0, int(y0 - pad_y))
    x1 = min(vid_w, int(x1 + pad_x))
    y1 = min(vid_h, int(y1 + pad_y))
    w = _even(max(16, x1 - x0))
    h = _even(max(16, y1 - y0))
    # Keep the crop inside the frame after rounding up to even.
    x0 = min(x0, max(0, vid_w - w))
    y0 = min(y0, max(0, vid_h - h))
    return x0, y0, w, h


def encode_track_clip(
    src_path: str, boxes: list[dict], fps: float, vid_w: int, vid_h: int
) -> bytes | None:
    """Render one track's cropped clip and return browser-playable mp4 bytes.

    Reads the frames the track appears in with OpenCV, crops each to the track's
    constant padded region, and pipes raw frames to the bundled libx264 ffmpeg
    (yuv420p, +faststart). Returns None if the track has no usable frames.
    """
    import cv2
    import imageio_ffmpeg

    if not boxes:
        return None
    frames_wanted = {b["frame"] for b in boxes}
    x0, y0, w, h = _crop_region(boxes, vid_w, vid_h)

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    out_fd, out_path = tempfile.mkstemp(suffix=".mp4")
    os.close(out_fd)
    cmd = [
        ffmpeg_exe, "-y",
        "-f", "rawvideo",
        "-pix_fmt", "bgr24",
        "-s", f"{w}x{h}",
        "-r", f"{max(1.0, fps):.3f}",
        "-i", "pipe:0",
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_path,
    ]
    cap = cv2.VideoCapture(src_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {src_path}")
    proc = subprocess.Popen(
        cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE
    )
    written = 0
    try:
        idx = 0
        max_frame = max(frames_wanted)
        while idx <= max_frame:
            ok, frame = cap.read()
            if not ok:
                break
            if idx in frames_wanted:
                crop = frame[y0:y0 + h, x0:x0 + w]
                if crop.shape[0] == h and crop.shape[1] == w:
                    proc.stdin.write(crop.tobytes())
                    written += 1
            idx += 1
    finally:
        cap.release()
        if proc.stdin and not proc.stdin.closed:
            proc.stdin.close()
        # stdin is already closed; just drain stderr and wait for the encoder.
        stderr = proc.stderr.read() if proc.stderr else b""
        proc.wait()

    if written == 0:
        if os.path.exists(out_path):
            os.unlink(out_path)
        return None
    if proc.returncode != 0:
        if os.path.exists(out_path):
            os.unlink(out_path)
        raise RuntimeError(f"ffmpeg clip encode failed: {(stderr or b'')[-400:]!r}")

    with open(out_path, "rb") as f:
        data = f.read()
    os.unlink(out_path)
    return data
