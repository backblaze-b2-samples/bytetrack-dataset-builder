"""torch `weights_only` allowlist guard (no-op for the default keyless model).

torch 2.6+ flipped `torch.load`'s default to `weights_only=True`, which can
reject the non-tensor globals baked into some checkpoints. The default
detection model (`rfdetr-base`) is served through Roboflow `inference`, which
loads its weights as ONNX, NOT via `torch.load` — so the safe-unpickler flip
does not affect the default keyless pipeline and this guard is a no-op for it.

We keep the hook (mirroring the proven `whisper-dataset-builder` precedent) so
that if you swap in a Roboflow Universe model whose checkpoint IS unpickled via
`torch.load`, you have one single-sourced place to allowlist the globals it
needs instead of blanket-disabling `weights_only`.

The torch import stays lazy (inside the function) per the engine's lazy-import
invariant, so importing this module is free even without the CV stack.
"""


def allowlist_detection_globals() -> None:
    """Allowlist globals for torch-checkpoint-backed detection models.

    Idempotent and process-global. A no-op for the default ONNX-served
    `rfdetr-base`; extend the allowlist here if you load a `.pt`/`.pth`
    checkpoint that trips torch 2.6+'s safe unpickler.
    """
    try:
        import torch  # type: ignore  # noqa: F401
    except ImportError:
        return
    # Default keyless path needs no allowlist (ONNX weights, not torch.load).
    # Add `torch.serialization.add_safe_globals([...])` here for custom
    # torch-checkpoint models.
