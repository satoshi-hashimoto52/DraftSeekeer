from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import cv2
import numpy as np

from .templates import TemplateImage


@dataclass(frozen=True)
class MatchResult:
    class_name: str
    template_name: str
    score: float
    scale: float
    bbox: Tuple[int, int, int, int]  # x, y, w, h in original image coords


def _clip_roi(x: int, y: int, roi_size: int, width: int, height: int) -> Tuple[int, int, int, int]:
    half = roi_size // 2
    x0 = max(0, x - half)
    y0 = max(0, y - half)
    x1 = min(width, x + half)
    y1 = min(height, y + half)
    if x1 <= x0:
        x1 = min(width, x0 + 1)
    if y1 <= y0:
        y1 = min(height, y0 + 1)
    return x0, y0, x1, y1


def _iter_scaled_templates(
    template: np.ndarray,
    scale_min: float,
    scale_max: float,
    scale_steps: int,
) -> Iterable[Tuple[float, np.ndarray]]:
    if scale_steps <= 1:
        yield 1.0, template
        return
    scales = np.linspace(scale_min, scale_max, scale_steps)
    for scale in scales:
        if scale <= 0:
            continue
        h, w = template.shape[:2]
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        resized = cv2.resize(template, (new_w, new_h), interpolation=cv2.INTER_AREA)
        yield float(scale), resized


def match_templates(
    image_bgr: np.ndarray,
    x: int,
    y: int,
    roi_size: int,
    templates: Dict[str, List[TemplateImage]],
    topk: int,
    scale_min: float,
    scale_max: float,
    scale_steps: int,
) -> List[MatchResult]:
    if image_bgr is None:
        return []
    image_gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    height, width = image_gray.shape[:2]
    x0, y0, x1, y1 = _clip_roi(x, y, roi_size, width, height)
    roi = image_gray[y0:y1, x0:x1]

    results: List[MatchResult] = []

    for class_name, template_list in templates.items():
        best_score = None
        best_bbox = None
        best_template_name = None
        best_scale = None
        for tpl in template_list:
            for scale, scaled in _iter_scaled_templates(
                tpl.image_gray, scale_min, scale_max, scale_steps
            ):
                th, tw = scaled.shape[:2]
                if th > roi.shape[0] or tw > roi.shape[1]:
                    continue
                res = cv2.matchTemplate(roi, scaled, cv2.TM_CCOEFF_NORMED)
                _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(res)
                if best_score is None or max_val > best_score:
                    best_score = float(max_val)
                    bx = x0 + max_loc[0]
                    by = y0 + max_loc[1]
                    best_bbox = (bx, by, tw, th)
                    best_template_name = tpl.template_name
                    best_scale = scale

        if (
            best_score is not None
            and best_bbox is not None
            and best_template_name is not None
            and best_scale is not None
        ):
            results.append(
                MatchResult(
                    class_name=class_name,
                    template_name=best_template_name,
                    score=best_score,
                    scale=best_scale,
                    bbox=best_bbox,
                )
            )

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:topk]
