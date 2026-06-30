"""Roboflow Inference adapter — the ONLY place the detection model runs.

Pre-trained COCO models (default `rfdetr-base`) run LOCALLY with NO API key;
weights auto-download on first use. `ROBOFLOW_API_KEY` is OPTIONAL and unlocks
Roboflow Universe models + hosted serverless inference — it is NOT required.

Detections are returned as Supervision `sv.Detections` (via
`sv.Detections.from_inference`) so the rest of the pipeline is decoupled from
the raw inference response shape. `inference` / `supervision` are heavy imports,
so they are imported lazily inside the functions — the module stays importable
for structural tests without the CV runtime installed.

This is local compute on frames the repo already decoded; it owns NO boto3.
"""

import functools
import logging

from app.config import settings
from app.service.engine.device import select_device

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def _get_model(model_id: str, api_key: str = ""):
    """Load the detection model once (weights auto-download on first call)."""
    from inference import get_model

    device = select_device(settings.device)
    logger.info("Loading detection model %s (device=%s)", model_id, device)
    kwargs: dict = {"model_id": model_id}
    if api_key:
        # Optional — only set when the operator provided a Universe key.
        kwargs["api_key"] = api_key
    return get_model(**kwargs)


def infer_frame(frame, model_id: str, confidence: float):
    """Run detection on a single BGR frame (numpy array decoded by OpenCV).

    Returns an `sv.Detections` filtered to the confidence threshold. `frame`
    is passed positionally so this works with any model `get_model` returns.
    """
    import supervision as sv

    model = _get_model(model_id, settings.roboflow_api_key)
    results = model.infer(frame, confidence=confidence)[0]
    return sv.Detections.from_inference(results)


def class_names_of(detections) -> list[str | None]:
    """Per-detection class-name strings (lower-cased) for an `sv.Detections`.

    `from_inference` stores them under `data["class_name"]`. Returns one entry
    per detection (`None` where unavailable) so callers match on semantic names
    instead of model-specific integer ids (COCO-80 vs COCO-91). Keeps CV-type
    access inside the engine.
    """
    names = detections.data.get("class_name") if detections.data else None
    if names is None:
        return [None] * len(detections)
    return [str(n).lower() if n is not None else None for n in names]
