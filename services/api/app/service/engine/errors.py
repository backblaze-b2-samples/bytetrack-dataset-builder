"""Shared engine error types (no heavy imports — safe to import anywhere)."""


class MissingMLDependencies(RuntimeError):
    """Raised when the heavy CV stack (requirements-ml.txt) is not installed.

    Carries an actionable, human-readable hint so the API can surface a 503
    telling the operator exactly how to enable the tracking-dataset pipeline.
    """

    def __init__(self, what: str):
        super().__init__(
            f"{what} requires the local CV stack, which is not installed. "
            "Install it with:  cd services/api && "
            "pip install -r requirements-ml.txt  "
            "(inference + supervision + opencv + imageio-ffmpeg)."
        )
