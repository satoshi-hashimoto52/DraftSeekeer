from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import cv2
import numpy as np

from .nms import BoxLike, compute_iou
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
        for tpl in template_list:
            for scale, scaled in _iter_scaled_templates(
                tpl.image_gray, scale_min, scale_max, scale_steps
            ):
                th, tw = scaled.shape[:2]
                if th > roi.shape[0] or tw > roi.shape[1]:
                    continue
                res = cv2.matchTemplate(roi, scaled, cv2.TM_CCOEFF_NORMED)
                _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(res)
                bx = x0 + max_loc[0]
                by = y0 + max_loc[1]
                results.append(
                    MatchResult(
                        class_name=class_name,
                        template_name=tpl.template_name,
                        score=float(max_val),
                        scale=scale,
                        bbox=(bx, by, tw, th),
                    )
                )

    results.sort(key=lambda r: r.score, reverse=True)
    return results


def refine_match_bboxes(
    image_gray: np.ndarray,
    matches: List[MatchResult],
    click_xy: Tuple[int, int] | None = None,
    pad: int = 12,
) -> List[MatchResult]:
    if image_gray is None or not matches:
        return matches
    h, w = image_gray.shape[:2]
    refined: List[MatchResult] = []
    for match in matches:
        bx, by, bw, bh = match.bbox
        x0 = max(0, bx - pad)
        y0 = max(0, by - pad)
        x1 = min(w, bx + bw + pad)
        y1 = min(h, by + bh + pad)
        if x1 <= x0 or y1 <= y0:
            refined.append(match)
            continue
        roi = image_gray[y0:y1, x0:x1]
        if roi.size == 0:
            refined.append(match)
            continue
        roi_area = roi.shape[0] * roi.shape[1]
        try:
            blur = cv2.GaussianBlur(roi, (3, 3), 0)
            _, bin_img = cv2.threshold(
                blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
            )
            contours, _ = cv2.findContours(
                bin_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
        except cv2.error:
            refined.append(match)
            continue
        if not contours:
            refined.append(match)
            continue
        if click_xy:
            cx, cy = click_xy
        else:
            cx, cy = bx + bw / 2.0, by + bh / 2.0
        cx -= x0
        cy -= y0
        best = None
        best_contains = False
        best_metric = None
        for cnt in contours:
            x, y, cw, ch = cv2.boundingRect(cnt)
            if cw <= 1 or ch <= 1:
                continue
            area = cw * ch
            if area < max(30, int(roi_area * 0.005)):
                continue
            aspect = max(cw / ch, ch / cw)
            if aspect > 30:
                continue
            contains = x <= cx <= x + cw and y <= cy <= y + ch
            if contains:
                metric = -area
            else:
                dx = (x + cw / 2.0) - cx
                dy = (y + ch / 2.0) - cy
                metric = (dx * dx + dy * dy) ** 0.5
            if best is None:
                best = (x, y, cw, ch)
                best_contains = contains
                best_metric = metric
                continue
            if contains and not best_contains:
                best = (x, y, cw, ch)
                best_contains = True
                best_metric = metric
                continue
            if contains == best_contains:
                if contains:
                    if metric < best_metric:
                        best = (x, y, cw, ch)
                        best_metric = metric
                else:
                    if metric < best_metric:
                        best = (x, y, cw, ch)
                        best_metric = metric
        if best is None:
            refined.append(match)
            continue
        rx, ry, rw, rh = best
        new_bbox = (x0 + rx, y0 + ry, rw, rh)
        refined.append(
            MatchResult(
                class_name=match.class_name,
                template_name=match.template_name,
                score=match.score,
                scale=match.scale,
                bbox=new_bbox,
            )
        )
    return refined


def apply_vertical_padding(
    matches: List[MatchResult],
    image_height: int,
    default_top: int = 2,
    default_bottom: int = 3,
    class_pad_map: Dict[str, Dict[str, int]] | None = None,
) -> List[MatchResult]:
    if not matches or image_height <= 0:
        return matches
    adjusted: List[MatchResult] = []
    for match in matches:
        pad_cfg = class_pad_map.get(match.class_name, {}) if class_pad_map else {}
        pad_top_px = int(pad_cfg.get("top", default_top))
        pad_bottom_px = int(pad_cfg.get("bottom", default_bottom))
        pad_top = int(round(pad_top_px * match.scale))
        pad_bottom = int(round(pad_bottom_px * match.scale))
        bx, by, bw, bh = match.bbox
        new_y = max(0, by - pad_top)
        new_y2 = min(image_height, by + bh + pad_bottom)
        new_h = max(1, new_y2 - new_y)
        adjusted.append(
            MatchResult(
                class_name=match.class_name,
                template_name=match.template_name,
                score=match.score,
                scale=match.scale,
                bbox=(bx, new_y, bw, new_h),
            )
        )
    return adjusted


def filter_overlapping_matches(
    matches: List[MatchResult],
    confirmed_boxes: Iterable[BoxLike],
    iou_threshold: float = 0.5,
) -> List[MatchResult]:
    if not matches:
        return matches
    confirmed = [c for c in confirmed_boxes if c is not None]
    if not confirmed:
        return matches
    filtered: List[MatchResult] = []
    for match in matches:
        keep = True
        for box in confirmed:
            if compute_iou(match.bbox, box) >= iou_threshold:
                keep = False
                break
        if keep:
            filtered.append(match)
    return filtered
