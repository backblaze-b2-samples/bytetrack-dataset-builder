"""MOT-format packaging — annotation JSON, MOTChallenge gt.txt, labels.zip.

Pure-python formatting (no heavy CV imports) so it is safe to import anywhere.
This turns the per-track boxes the video engine collected into:

- one annotation JSON per track (frames, [x,y,w,h], conf, track_id, class), and
- a MOTChallenge `gt.txt` per source video:
      <frame>,<track_id>,<x>,<y>,<w>,<h>,<conf>,-1,-1,-1
  packed into a `labels.zip` next to a release `manifest.json`.

No boto3 — returns bytes/dicts for the repo to store.
"""

import io
import json
import zipfile


def annotation_payload(track_id: int, class_name: str, video_id: str, boxes: list[dict]) -> dict:
    """The per-track annotation document written to B2 as JSON."""
    return {
        "track_id": track_id,
        "class_name": class_name,
        "video_id": video_id,
        "frame_count": len(boxes),
        "boxes": boxes,
    }


def mot_gt_lines(track_id: int, boxes: list[dict]) -> list[str]:
    """MOTChallenge `gt.txt` rows for one track (1-indexed frames)."""
    lines: list[str] = []
    for b in boxes:
        # MOT frames are 1-indexed; our decode loop is 0-indexed.
        frame = int(b["frame"]) + 1
        lines.append(
            f"{frame},{track_id},{b['x']:.2f},{b['y']:.2f},"
            f"{b['w']:.2f},{b['h']:.2f},{b['confidence']:.4f},-1,-1,-1"
        )
    return lines


def build_labels_zip(video_id: str, gt_lines: list[str]) -> bytes:
    """Pack a MOTChallenge `gt.txt` for one video into a labels.zip.

    Layout inside the archive (MOTChallenge convention):
        <video_id>/gt/gt.txt
    """
    # Sort by (frame, track_id) so the gt.txt is in canonical MOT order.
    def _key(line: str) -> tuple[int, int]:
        parts = line.split(",")
        return int(parts[0]), int(parts[1])

    ordered = sorted(gt_lines, key=_key)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{video_id}/gt/gt.txt", "\n".join(ordered) + "\n")
    return buf.getvalue()


def release_manifest(
    *,
    version: str,
    video_id: str,
    classes: list[str],
    track_count: int,
    clip_count: int,
    params: dict,
    created_at: str,
) -> dict:
    """The release `manifest.json` describing a versioned MOT label drop."""
    return {
        "version": version,
        "format": "MOTChallenge",
        "videos": [video_id],
        "classes": classes,
        "track_count": track_count,
        "clip_count": clip_count,
        "params": params,
        "created_at": created_at,
        "labels": {"gt_path": f"{video_id}/gt/gt.txt"},
    }


def to_json_bytes(obj: dict) -> bytes:
    return json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
