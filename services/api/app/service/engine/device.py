"""Runtime device selection for the local CV engine.

`deployment: local` rule: default to CPU and auto-detect the best available
accelerator (CUDA -> Apple MPS -> CPU). Never hard-require a GPU.

The Roboflow `inference` runtime (ONNX Runtime / torch under the hood) picks
its own execution provider; we only surface the detected device so the engine
can log it and so a future model that honors a torch device can be steered.

All torch imports are lazy so importing this module is free and the API boots
without the ML stack installed. With torch absent, the helper reports "cpu".
"""

import logging

logger = logging.getLogger(__name__)


def _detect_torch_device() -> str:
    """Best available torch device: cuda -> mps -> cpu. 'cpu' if torch absent."""
    try:
        import torch  # type: ignore
    except ImportError:
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def select_device(override: str = "auto") -> str:
    """Auto-detect the inference device. Honors a non-auto override verbatim.

    Defaults to CPU. Never raises and never hard-requires a GPU — a CPU run is
    always a valid fallback (see MAX_FRAMES, which caps a CPU demo).
    """
    if override and override != "auto":
        return override
    device = _detect_torch_device()
    logger.info("Auto-selected inference device: %s", device)
    return device
