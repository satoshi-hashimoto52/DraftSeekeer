from __future__ import annotations

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
TEMPLATES_ROOT = DATA_DIR / "templates_root"
IMAGES_DIR = DATA_DIR / "images"
RUNS_DIR = DATA_DIR / "runs"

DEFAULT_SCALE_MIN = 0.5
DEFAULT_SCALE_MAX = 1.5
DEFAULT_SCALE_STEPS = 12
DEFAULT_TOPK = 3
