from __future__ import annotations

"""Detection core for full-image template-based annotation.

This module provides a high-level API to scan a full image, generate
candidate bounding boxes using existing template matching, score them,
filter by threshold, and export annotations.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import cv2
import numpy as np

from .matching import MatchResult, match_templates
from .templates import TemplateImage
from .candidate_scoring import score_candidates
from .annotation_exporter import export_annotations


@dataclass(frozen=True)
class Candidate:
    """Intermediate candidate produced by template matching."""

    class_name: str
    bbox: Tuple[int, int, int, int]
    edge_score: float
    template_name: str


def _group_templates(templates: Iterable[TemplateImage]) -> Dict[str, List[TemplateImage]]:
    grouped: Dict[str, List[TemplateImage]] = {}
    for tpl in templates:
        grouped.setdefault(tpl.class_name, []).append(tpl)
    return grouped


def _iter_tiles(width: int, height: int, tile_size: int, stride: int) -> Iterable[Tuple[int, int, int, int]]:
    y = 0
    while y < height:
        x = 0
        y1 = min(height, y + tile_size)
        while x < width:
            x1 = min(width, x + tile_size)
            yield x, y, x1, y1
            x += stride
        y += stride


def _match_tile(
    tile: np.ndarray,
    x0: int,
    y0: int,
    templates: Dict[str, List[TemplateImage]],
    scale_min: float,
    scale_max: float,
    scale_steps: int,
    max_per_tile: int,
    roi_size: int,
) -> List[Candidate]:
    h, w = tile.shape[:2]
    cx = w // 2
    cy = h // 2
    roi_size = max(1, int(roi_size))
    matches: List[MatchResult] = match_templates(
        image_bgr=tile,
        x=cx,
        y=cy,
        roi_size=roi_size,
        templates=templates,
        scale_min=scale_min,
        scale_max=scale_max,
        scale_steps=scale_steps,
    )
    if max_per_tile > 0:
        matches = matches[:max_per_tile]

    candidates: List[Candidate] = []
    for m in matches:
        bx, by, bw, bh = m.bbox
        candidates.append(
            Candidate(
                class_name=m.class_name,
                bbox=(bx + x0, by + y0, bw, bh),
                edge_score=float(m.score),
                template_name=m.template_name,
            )
        )
    return candidates


def annotate_all(
    image_path: Path,
    templates: list,
    threshold: float,
    output_format: str,  # 'yolo' or 'coco'
    roi_size: int = 200,
    scale_min: float = 0.5,
    scale_max: float = 1.5,
    scale_steps: int = 12,
    stride: int | None = None,
) -> dict:
    """Run full-image template matching and export annotations.

    Args:
        image_path: Path to the image file.
        templates: List[TemplateImage] or Dict[str, List[TemplateImage]].
        threshold: Final score threshold.
        output_format: 'yolo' or 'coco'.

    Returns:
        dict containing annotations and export payload.

    Raises:
        ValueError: If image cannot be read or format invalid.
    """

    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"failed to read image: {image_path}")

    if isinstance(templates, dict):
        templates_by_class = templates
    else:
        templates_by_class = _group_templates(templates)

    height, width = img.shape[:2]

    # Sliding window for recall
    tile_size = max(64, int(roi_size))
    stride = max(1, int(stride if stride is not None else tile_size * 0.25))
    max_per_tile = 50

    candidates: List[Candidate] = []
    for x0, y0, x1, y1 in _iter_tiles(width, height, tile_size, stride):
        tile = img[y0:y1, x0:x1]
        if tile.size == 0:
            continue
        candidates.extend(
            _match_tile(
                tile,
                x0,
                y0,
                templates_by_class,
                scale_min,
                scale_max,
                scale_steps,
                max_per_tile,
                roi_size,
            )
        )

    scored = score_candidates(img, candidates)
    confirmed = [c for c in scored if c["final_score"] >= threshold]

    export_payload = export_annotations(
        image_path=image_path,
        image_size=(width, height),
        candidates=confirmed,
        output_format=output_format,
    )

    return {
        "image": str(image_path),
        "threshold": threshold,
        "total_candidates": len(scored),
        "confirmed": confirmed,
        "export": export_payload,
    }


def annotate_all_manual(
    image_path: Path,
    templates: list,
    threshold: float,
    output_format: str,  # 'yolo' or 'coco'
    roi_size: int = 200,
    scale_min: float = 0.5,
    scale_max: float = 1.5,
    scale_steps: int = 12,
    stride: int | None = None,
) -> dict:
    """Run full-image template matching using raw match scores only.

    This mode mirrors the manual matching pipeline (matching.py) and uses
    edge_score as final_score without additional scoring.
    """
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"failed to read image: {image_path}")

    if isinstance(templates, dict):
        templates_by_class = templates
    else:
        templates_by_class = _group_templates(templates)

    height, width = img.shape[:2]

    tile_size = max(64, int(roi_size))
    stride = max(1, int(stride if stride is not None else tile_size * 0.25))
    max_per_tile = 50

    candidates: List[Candidate] = []
    for x0, y0, x1, y1 in _iter_tiles(width, height, tile_size, stride):
        tile = img[y0:y1, x0:x1]
        if tile.size == 0:
            continue
        candidates.extend(
            _match_tile(
                tile,
                x0,
                y0,
                templates_by_class,
                scale_min,
                scale_max,
                scale_steps,
                max_per_tile,
                roi_size,
            )
        )

    scored = [
        {
            "class_name": c.class_name,
            "bbox": c.bbox,
            "edge_score": float(c.edge_score),
            "contour_score": 0.0,
            "layout_score": 0.0,
            "shape_score": 0.0,
            "final_score": float(c.edge_score),
            "template_name": c.template_name,
        }
        for c in candidates
    ]
    confirmed = [c for c in scored if c["final_score"] >= threshold]

    export_payload = export_annotations(
        image_path=image_path,
        image_size=(width, height),
        candidates=confirmed,
        output_format=output_format,
    )

    return {
        "image": str(image_path),
        "threshold": threshold,
        "total_candidates": len(scored),
        "confirmed": confirmed,
        "export": export_payload,
    }
