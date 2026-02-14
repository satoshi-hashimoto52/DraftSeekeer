from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import cv2
import numpy as np

from .nms import BoxLike, compute_iou
from .templates import TemplateImage, TemplateVariant


LINEART_TOPK_RERANK = 24
LINEART_TIE_EPS = 0.01
LINEART_HIST_BINS = 18


def preprocess_edge(gray: np.ndarray) -> np.ndarray:
    if gray is None or gray.size == 0:
        return gray
    bin_img = preprocess_binary_inv(gray)
    blur = cv2.GaussianBlur(bin_img, (3, 3), 0)
    edges = cv2.Canny(blur, 50, 150)
    return np.where(edges > 0, 255, 0).astype(np.uint8)


def preprocess_binary_inv(gray: np.ndarray) -> np.ndarray:
    if gray is None or gray.size == 0:
        return gray
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, bin_img = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return bin_img


def _angle_hist_from_window(
    angle_patch: np.ndarray, mag_patch: np.ndarray, edge_patch: np.ndarray, bins: int = LINEART_HIST_BINS
) -> np.ndarray:
    if (
        angle_patch is None
        or mag_patch is None
        or edge_patch is None
        or angle_patch.size == 0
        or mag_patch.size == 0
        or edge_patch.size == 0
    ):
        return np.zeros((bins,), dtype=np.float32)
    sel = (edge_patch > 0) & (mag_patch > 1e-3)
    if int(np.count_nonzero(sel)) == 0:
        return np.zeros((bins,), dtype=np.float32)
    hist, _ = np.histogram(
        angle_patch[sel], bins=bins, range=(0.0, 180.0), weights=mag_patch[sel]
    )
    hist = hist.astype(np.float32)
    norm = float(np.linalg.norm(hist))
    if norm > 1e-6:
        hist /= norm
    return hist


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    if a is None or b is None or a.size == 0 or b.size == 0:
        return 0.0
    if a.shape != b.shape:
        return 0.0
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na <= 1e-6 or nb <= 1e-6:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _chamfer_score(dist_patch: np.ndarray, template_edge: np.ndarray) -> float:
    if dist_patch is None or template_edge is None:
        return 0.0
    if dist_patch.shape != template_edge.shape:
        return 0.0
    mask = template_edge > 0
    edge_count = int(np.count_nonzero(mask))
    if edge_count <= 0:
        return 0.0
    mean_dist = float(np.mean(dist_patch[mask]))
    return float(1.0 / (1.0 + mean_dist))


def _match_template_with_optional_mask(
    roi_edge: np.ndarray, tpl_edge: np.ndarray, tpl_mask: Optional[np.ndarray]
) -> Tuple[float, Tuple[int, int]]:
    if tpl_mask is not None and tpl_mask.shape == tpl_edge.shape and int(np.count_nonzero(tpl_mask)) > 0:
        try:
            res = cv2.matchTemplate(
                roi_edge, tpl_edge, cv2.TM_CCORR_NORMED, mask=tpl_mask
            )
            _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(res)
            return float(max_val), max_loc
        except cv2.error:
            pass
    res = cv2.matchTemplate(roi_edge, tpl_edge, cv2.TM_CCOEFF_NORMED)
    _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(res)
    return float(max_val), max_loc


@dataclass(frozen=True)
class MatchResult:
    class_name: str
    template_name: str
    score: float
    scale: float
    bbox: Tuple[int, int, int, int]  # tight bbox (x, y, w, h) in original image coords
    outer_bbox: Tuple[int, int, int, int]  # template outer bbox in original image coords
    tight_bbox: Tuple[int, int, int, int]  # same as bbox; kept for debug symmetry
    mode: str  # "edge" or "bin"
    shape_ratio: float = 0.0


def _trim_template_margin(template: np.ndarray) -> np.ndarray:
    """Trim zero-value outer margins from a processed template image."""
    if template is None or template.size == 0:
        return template
    ys, xs = np.where(template > 0)
    if ys.size == 0 or xs.size == 0:
        return template
    y0, y1 = ys.min(), ys.max() + 1
    x0, x1 = xs.min(), xs.max() + 1
    trimmed = template[y0:y1, x0:x1]
    return trimmed if trimmed.size > 0 else template


def _trim_template_pair(template: np.ndarray, mask: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    if (
        template is None
        or mask is None
        or template.size == 0
        or mask.size == 0
        or template.shape != mask.shape
    ):
        return template, mask
    combined = (template > 0) | (mask > 0)
    ys, xs = np.where(combined)
    if ys.size == 0 or xs.size == 0:
        return template, mask
    y0, y1 = ys.min(), ys.max() + 1
    x0, x1 = xs.min(), xs.max() + 1
    return template[y0:y1, x0:x1], mask[y0:y1, x0:x1]


def _foreground_match_ratio(template_proc: np.ndarray, patch_proc: np.ndarray) -> float:
    """Compute overlap ratio on template foreground pixels."""
    if (
        template_proc is None
        or patch_proc is None
        or template_proc.size == 0
        or patch_proc.size == 0
        or template_proc.shape != patch_proc.shape
    ):
        return 0.0
    fg = template_proc > 0
    fg_count = int(np.count_nonzero(fg))
    if fg_count <= 0:
        return 0.0
    matched = int(np.count_nonzero(patch_proc[fg] > 0))
    return float(matched / fg_count)


def _clip_roi(
    x: float, y: float, roi_size: int, width: int, height: int
) -> Tuple[int, int, int, int]:
    half = roi_size / 2.0
    x0 = int(round(x - half))
    y0 = int(round(y - half))
    x1 = int(round(x + half))
    y1 = int(round(y + half))
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(width, x1)
    y1 = min(height, y1)
    if x1 <= x0:
        x1 = min(width, x0 + 1)
    if y1 <= y0:
        y1 = min(height, y0 + 1)
    return x0, y0, x1, y1


def clip_roi(
    x: float, y: float, roi_size: int, width: int, height: int
) -> Tuple[int, int, int, int]:
    return _clip_roi(x, y, roi_size, width, height)


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


@dataclass
class _LineArtCandidate:
    class_name: str
    template_name: str
    scale: float
    mode: str
    score_stage1: float
    shape_ratio: float
    bbox: Tuple[int, int, int, int]
    outer_bbox: Tuple[int, int, int, int]
    tight_bbox: Tuple[int, int, int, int]
    tpl_edge_scaled: np.ndarray
    tpl_hist: np.ndarray
    score_chamfer: float = 0.0
    score_hist: float = 0.0
    score_final: float = 0.0


def _build_template_variants(tpl: TemplateImage) -> List[TemplateVariant]:
    if tpl.line_variants:
        return list(tpl.line_variants)
    h, w = tpl.image_proc_edge.shape[:2]
    zero_hist = tuple(0.0 for _ in range(LINEART_HIST_BINS))
    return [
        TemplateVariant(
            rotation_deg=0,
            edge=tpl.image_proc_edge,
            mask=np.where(tpl.image_proc_edge > 0, 255, 0).astype(np.uint8),
            angle_hist=zero_hist,
            tight_bbox=(0, 0, w, h),
            outer_bbox=(0, 0, w, h),
        )
    ]


def _match_templates_line_art(
    image_bgr: np.ndarray,
    x: float,
    y: float,
    roi_size: int,
    templates: Dict[str, List[TemplateImage]],
    scale_min: float,
    scale_max: float,
    scale_steps: int,
    trim_template_margin: bool,
    rerank_topk: int,
) -> List[MatchResult]:
    image_gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    height, width = image_gray.shape[:2]
    x0, y0, x1, y1 = _clip_roi(x, y, roi_size, width, height)
    roi = image_gray[y0:y1, x0:x1]
    if roi.size == 0:
        return []

    roi_bin = preprocess_binary_inv(roi)
    roi_edge = preprocess_edge(roi)
    if int(np.count_nonzero(roi_edge)) == 0:
        return []

    dist_src = np.where(roi_edge > 0, 0, 255).astype(np.uint8)
    roi_dist = cv2.distanceTransform(dist_src, cv2.DIST_L2, 3)
    roi_bin_f = roi_bin.astype(np.float32)
    gx = cv2.Sobel(roi_bin_f, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(roi_bin_f, cv2.CV_32F, 0, 1, ksize=3)
    roi_mag = cv2.magnitude(gx, gy)
    roi_ang = np.mod(cv2.phase(gx, gy, angleInDegrees=True), 180.0)

    stage1: List[_LineArtCandidate] = []
    for class_name, template_list in templates.items():
        for tpl in template_list:
            for variant in _build_template_variants(tpl):
                tpl_hist = np.array(variant.angle_hist, dtype=np.float32)
                for scale, scaled_edge in _iter_scaled_templates(
                    variant.edge, scale_min, scale_max, scale_steps
                ):
                    scaled_mask = cv2.resize(
                        variant.mask,
                        (scaled_edge.shape[1], scaled_edge.shape[0]),
                        interpolation=cv2.INTER_NEAREST,
                    )
                    if trim_template_margin:
                        scaled_edge, scaled_mask = _trim_template_pair(
                            scaled_edge, scaled_mask
                        )
                    th, tw = scaled_edge.shape[:2]
                    if th > roi_edge.shape[0] or tw > roi_edge.shape[1]:
                        continue
                    if np.count_nonzero(scaled_edge) < max(8, int(scaled_edge.size * 0.002)):
                        continue
                    score1, max_loc = _match_template_with_optional_mask(
                        roi_edge, scaled_edge, scaled_mask
                    )
                    patch_edge = roi_edge[
                        max_loc[1] : max_loc[1] + th, max_loc[0] : max_loc[0] + tw
                    ]
                    shape_ratio = _foreground_match_ratio(scaled_edge, patch_edge)
                    tight_x = x0 + max_loc[0]
                    tight_y = y0 + max_loc[1]
                    tx, ty, _tw0, _th0 = variant.tight_bbox
                    outer_x = int(round(tight_x - (tx * scale)))
                    outer_y = int(round(tight_y - (ty * scale)))
                    outer_w = int(round(variant.outer_bbox[2] * scale))
                    outer_h = int(round(variant.outer_bbox[3] * scale))
                    stage1.append(
                        _LineArtCandidate(
                            class_name=class_name,
                            template_name=tpl.template_name,
                            scale=scale,
                            mode="edge",
                            score_stage1=score1,
                            shape_ratio=shape_ratio,
                            bbox=(tight_x, tight_y, tw, th),
                            outer_bbox=(outer_x, outer_y, outer_w, outer_h),
                            tight_bbox=(tight_x, tight_y, tw, th),
                            tpl_edge_scaled=scaled_edge,
                            tpl_hist=tpl_hist,
                        )
                    )

    if not stage1:
        return []

    stage1.sort(key=lambda c: c.score_stage1, reverse=True)
    topn = max(1, min(rerank_topk, len(stage1)))
    for i in range(topn):
        c = stage1[i]
        bx, by, bw, bh = c.bbox
        rx = bx - x0
        ry = by - y0
        dist_patch = roi_dist[ry : ry + bh, rx : rx + bw]
        edge_patch = roi_edge[ry : ry + bh, rx : rx + bw]
        ang_patch = roi_ang[ry : ry + bh, rx : rx + bw]
        mag_patch = roi_mag[ry : ry + bh, rx : rx + bw]
        hist_patch = _angle_hist_from_window(ang_patch, mag_patch, edge_patch)
        hist_sim = _cosine_sim(hist_patch, c.tpl_hist)
        chamfer = _chamfer_score(dist_patch, c.tpl_edge_scaled)
        c.score_chamfer = chamfer
        c.score_hist = hist_sim
        c.score_final = float(
            0.60 * c.score_stage1 + 0.32 * chamfer + 0.08 * c.shape_ratio
        )

    for i in range(topn, len(stage1)):
        c = stage1[i]
        c.score_final = float(0.95 * c.score_stage1 + 0.05 * c.shape_ratio)

    stage1.sort(key=lambda c: c.score_final, reverse=True)
    swapped = True
    while swapped:
        swapped = False
        for i in range(len(stage1) - 1):
            a = stage1[i]
            b = stage1[i + 1]
            if abs(a.score_final - b.score_final) > LINEART_TIE_EPS:
                continue
            if compute_iou(a.bbox, b.bbox) < 0.30:
                continue
            if b.score_hist > a.score_hist + 1e-6:
                stage1[i], stage1[i + 1] = b, a
                swapped = True

    return [
        MatchResult(
            class_name=c.class_name,
            template_name=c.template_name,
            score=float(c.score_final),
            scale=float(c.scale),
            bbox=c.bbox,
            outer_bbox=c.outer_bbox,
            tight_bbox=c.tight_bbox,
            mode=c.mode,
            shape_ratio=float(c.shape_ratio),
        )
        for c in stage1
    ]


def match_templates(
    image_bgr: np.ndarray,
    x: float,
    y: float,
    roi_size: int,
    templates: Dict[str, List[TemplateImage]],
    scale_min: float,
    scale_max: float,
    scale_steps: int,
    trim_template_margin: bool = False,
    line_art_enhanced: bool = False,
    rerank_topk: int = LINEART_TOPK_RERANK,
) -> List[MatchResult]:
    if image_bgr is None:
        return []
    if line_art_enhanced:
        return _match_templates_line_art(
            image_bgr=image_bgr,
            x=x,
            y=y,
            roi_size=roi_size,
            templates=templates,
            scale_min=scale_min,
            scale_max=scale_max,
            scale_steps=scale_steps,
            trim_template_margin=trim_template_margin,
            rerank_topk=rerank_topk,
        )
    image_gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    height, width = image_gray.shape[:2]
    x0, y0, x1, y1 = _clip_roi(x, y, roi_size, width, height)
    roi = image_gray[y0:y1, x0:x1]
    if roi.size == 0:
        return []
    roi_edge = preprocess_edge(roi)
    roi_bin = preprocess_binary_inv(roi)
    roi_proc = roi_edge

    results: List[MatchResult] = []

    for class_name, template_list in templates.items():
        for tpl in template_list:
            for scale, scaled in _iter_scaled_templates(
                tpl.image_proc_edge, scale_min, scale_max, scale_steps
            ):
                if trim_template_margin:
                    scaled = _trim_template_margin(scaled)
                th, tw = scaled.shape[:2]
                if th > roi_proc.shape[0] or tw > roi_proc.shape[1]:
                    continue
                if np.count_nonzero(scaled) < max(10, int(scaled.size * 0.002)):
                    continue
                res = cv2.matchTemplate(roi_proc, scaled, cv2.TM_CCOEFF_NORMED)
                _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(res)
                tight_x = x0 + max_loc[0]
                tight_y = y0 + max_loc[1]
                patch = roi_proc[max_loc[1] : max_loc[1] + th, max_loc[0] : max_loc[0] + tw]
                shape_ratio = _foreground_match_ratio(scaled, patch)
                tx, ty, tw_tight, th_tight = tpl.tight_bbox
                outer_x = int(round(tight_x - (tx * scale)))
                outer_y = int(round(tight_y - (ty * scale)))
                outer_w = int(round(tpl.outer_bbox[2] * scale))
                outer_h = int(round(tpl.outer_bbox[3] * scale))
                tight_w = tw
                tight_h = th
                results.append(
                    MatchResult(
                        class_name=class_name,
                        template_name=tpl.template_name,
                        score=float(max_val),
                        scale=scale,
                        bbox=(tight_x, tight_y, tight_w, tight_h),
                        outer_bbox=(outer_x, outer_y, outer_w, outer_h),
                        tight_bbox=(tight_x, tight_y, tight_w, tight_h),
                        mode="edge",
                        shape_ratio=shape_ratio,
                    )
                )

    results.sort(key=lambda r: r.score, reverse=True)
    if results:
        return results

    # fallback to binary-inverted matching if edge matching yields nothing
    roi_proc = roi_bin
    results = []
    for class_name, template_list in templates.items():
        for tpl in template_list:
            for scale, scaled in _iter_scaled_templates(
                tpl.image_proc_bin, scale_min, scale_max, scale_steps
            ):
                if trim_template_margin:
                    scaled = _trim_template_margin(scaled)
                th, tw = scaled.shape[:2]
                if th > roi_proc.shape[0] or tw > roi_proc.shape[1]:
                    continue
                if np.count_nonzero(scaled) < max(10, int(scaled.size * 0.002)):
                    continue
                res = cv2.matchTemplate(roi_proc, scaled, cv2.TM_CCOEFF_NORMED)
                _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(res)
                tight_x = x0 + max_loc[0]
                tight_y = y0 + max_loc[1]
                patch = roi_proc[max_loc[1] : max_loc[1] + th, max_loc[0] : max_loc[0] + tw]
                shape_ratio = _foreground_match_ratio(scaled, patch)
                tx, ty, tw_tight, th_tight = tpl.tight_bbox
                outer_x = int(round(tight_x - (tx * scale)))
                outer_y = int(round(tight_y - (ty * scale)))
                outer_w = int(round(tpl.outer_bbox[2] * scale))
                outer_h = int(round(tpl.outer_bbox[3] * scale))
                tight_w = tw
                tight_h = th
                results.append(
                    MatchResult(
                        class_name=class_name,
                        template_name=tpl.template_name,
                        score=float(max_val),
                        scale=scale,
                        bbox=(tight_x, tight_y, tight_w, tight_h),
                        outer_bbox=(outer_x, outer_y, outer_w, outer_h),
                        tight_bbox=(tight_x, tight_y, tight_w, tight_h),
                        mode="bin",
                        shape_ratio=shape_ratio,
                    )
                )
    results.sort(key=lambda r: r.score, reverse=True)
    return results


def refine_match_bboxes(
    image_gray: np.ndarray,
    matches: List[MatchResult],
    click_xy: Optional[Tuple[float, float]] = None,
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
                outer_bbox=match.outer_bbox,
                tight_bbox=new_bbox,
                mode=match.mode,
            )
        )
    return refined


def apply_vertical_padding(
    matches: List[MatchResult],
    image_height: int,
    default_top: int = 2,
    default_bottom: int = 3,
    class_pad_map: Optional[Dict[str, Dict[str, int]]] = None,
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
                outer_bbox=match.outer_bbox,
                tight_bbox=match.tight_bbox,
                mode=match.mode,
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
