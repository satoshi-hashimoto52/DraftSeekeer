from __future__ import annotations

"""Candidate scoring utilities.

Computes multi-factor scores for template-matching candidates and
returns final scores with weights.
"""

from typing import Dict, List, Tuple, Protocol

import cv2
import numpy as np

class CandidateLike(Protocol):
    class_name: str
    bbox: Tuple[int, int, int, int]
    edge_score: float
    template_name: str


def _contour_score(image_bgr: np.ndarray, bbox: Tuple[int, int, int, int]) -> float:
    x, y, w, h = bbox
    if w <= 0 or h <= 0:
        return 0.0
    roi = image_bgr[y : y + h, x : x + w]
    if roi.size == 0:
        return 0.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _th, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours_data = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = contours_data[0] if len(contours_data) == 2 else contours_data[1]
    if not contours:
        return 0.0

    area_sum = float(sum(cv2.contourArea(c) for c in contours))
    area_ratio = min(1.0, area_sum / float(w * h))
    aspect = w / float(h) if h > 0 else 0.0
    aspect_score = 1.0 - min(1.0, abs(aspect - 1.0))  # closer to square -> higher
    count_score = 1.0 / (1.0 + abs(len(contours) - 1))

    return float(0.5 * area_ratio + 0.3 * aspect_score + 0.2 * count_score)


def _layout_score(class_candidates: List[Dict]) -> float:
    if len(class_candidates) <= 1:
        return 0.2
    centers = np.array(
        [
            [c["bbox"][0] + c["bbox"][2] / 2.0, c["bbox"][1] + c["bbox"][3] / 2.0]
            for c in class_candidates
        ]
    )
    xs = np.sort(centers[:, 0])
    ys = centers[:, 1]
    widths = np.array([c["bbox"][2] for c in class_candidates])
    heights = np.array([c["bbox"][3] for c in class_candidates])

    if len(xs) >= 2:
        spacing = np.diff(xs)
        spacing_std = np.std(spacing)
        spacing_mean = np.mean(spacing) if np.mean(spacing) > 0 else 1.0
        spacing_score = np.exp(-spacing_std / spacing_mean)
    else:
        spacing_score = 0.2

    y_std = np.std(ys)
    y_mean = np.mean(ys) if np.mean(ys) > 0 else 1.0
    y_score = np.exp(-y_std / y_mean)

    w_score = np.exp(-np.std(widths) / (np.mean(widths) if np.mean(widths) > 0 else 1.0))
    h_score = np.exp(-np.std(heights) / (np.mean(heights) if np.mean(heights) > 0 else 1.0))

    return float(0.4 * spacing_score + 0.3 * y_score + 0.15 * w_score + 0.15 * h_score)


def _shape_score(class_candidates: List[Dict]) -> Dict[int, float]:
    areas = np.array([c["bbox"][2] * c["bbox"][3] for c in class_candidates], dtype=float)
    if areas.size == 0:
        return {}
    median_area = np.median(areas)
    if median_area <= 0:
        return {i: 0.0 for i in range(len(class_candidates))}
    scores: Dict[int, float] = {}
    for i, area in enumerate(areas):
        diff = abs(area - median_area) / median_area
        scores[i] = float(np.exp(-diff))
    return scores


def score_candidates(image_bgr: np.ndarray, candidates: List[CandidateLike]) -> List[Dict]:
    """Compute multi-factor scores for candidates.

    Returns:
        List of dicts with bbox, class_name, edge_score, contour_score,
        layout_score, shape_score, final_score.
    """

    if not candidates:
        return []

    scored: List[Dict] = []
    for c in candidates:
        contour_score = _contour_score(image_bgr, c.bbox)
        scored.append(
            {
                "class_name": c.class_name,
                "bbox": c.bbox,
                "edge_score": float(c.edge_score),
                "contour_score": float(contour_score),
                "template_name": c.template_name,
            }
        )

    # layout/shape are class-level
    by_class: Dict[str, List[Dict]] = {}
    for item in scored:
        by_class.setdefault(item["class_name"], []).append(item)

    for cls, group in by_class.items():
        layout_score = _layout_score(group)
        shape_scores = _shape_score(group)
        for idx, item in enumerate(group):
            shape_score = shape_scores.get(idx, 0.0)
            final_score = (
                0.35 * item["edge_score"]
                + 0.25 * item["contour_score"]
                + 0.30 * layout_score
                + 0.10 * shape_score
            )
            item["layout_score"] = float(layout_score)
            item["shape_score"] = float(shape_score)
            item["final_score"] = float(final_score)

    return scored
