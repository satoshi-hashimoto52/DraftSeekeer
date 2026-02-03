from __future__ import annotations

from typing import List, Tuple


BBox = Tuple[int, int, int, int]


def nms(bboxes: List[BBox], scores: List[float], iou_threshold: float) -> List[int]:
    """Placeholder for Step2. Returns all indices without suppression."""
    return list(range(len(bboxes)))
