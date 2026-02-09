from __future__ import annotations

from typing import Iterable, List, Mapping, Optional, Tuple, Union

from .nms import compute_iou


BBox = Tuple[int, int, int, int]
BoxLike = Union[BBox, Mapping[str, float]]


def _as_box_tuple(box: BoxLike) -> BBox:
    if isinstance(box, tuple):
        if len(box) != 4:
            raise ValueError("bbox tuple must have 4 elements")
        return int(box[0]), int(box[1]), int(box[2]), int(box[3])
    return int(box["x"]), int(box["y"]), int(box["w"]), int(box["h"])


def _extract_bbox_score(item: object) -> Tuple[BBox, float]:
    if hasattr(item, "bbox") and hasattr(item, "score"):
        bbox = getattr(item, "bbox")
        score = getattr(item, "score")
        return _as_box_tuple(bbox), float(score)
    if isinstance(item, Mapping):
        if "bbox" in item and "score" in item:
            return _as_box_tuple(item["bbox"]), float(item["score"])
        if {"x", "y", "w", "h", "score"}.issubset(item.keys()):
            bbox = {"x": item["x"], "y": item["y"], "w": item["w"], "h": item["h"]}
            return _as_box_tuple(bbox), float(item["score"])
    if isinstance(item, tuple) and len(item) == 2:
        bbox, score = item
        return _as_box_tuple(bbox), float(score)
    raise ValueError("unsupported bbox item; expected bbox+score")


def filter_bboxes(
    bboxes: Iterable[object],
    roi_size: int,
    score_threshold: float,
) -> List[object]:
    min_size = roi_size * 0.05
    max_area = roi_size * roi_size * 0.8
    filtered: List[object] = []
    for item in bboxes:
        bbox, score = _extract_bbox_score(item)
        _, _, w, h = bbox
        if w < min_size or h < min_size:
            continue
        if (w * h) > max_area:
            continue
        if score < score_threshold:
            continue
        filtered.append(item)
    return filtered


def exclude_confirmed_candidates(
    candidates: List[object],
    confirmed: List[dict],
    exclude_mode: str = "same_class",
    center_check: bool = True,
    iou_threshold: float = 0.6,
    any_overlap: bool = False,
) -> List[object]:
    if not candidates or not confirmed:
        return candidates

    def _center_in(box: BBox, cbox: BBox) -> bool:
        x, y, w, h = box
        cx = x + w / 2.0
        cy = y + h / 2.0
        bx, by, bw, bh = cbox
        return bx <= cx <= bx + bw and by <= cy <= by + bh

    def _as_bbox(obj: object) -> BBox:
        if hasattr(obj, "bbox"):
            b = getattr(obj, "bbox")
            return _as_box_tuple(b)
        if isinstance(obj, Mapping) and "bbox" in obj:
            return _as_box_tuple(obj["bbox"])
        return _as_box_tuple(obj)  # fallback

    def _as_class(obj: object) -> Optional[str]:
        if hasattr(obj, "class_name"):
            return getattr(obj, "class_name")
        if isinstance(obj, Mapping):
            return obj.get("class_name")
        return None

    confirmed_pairs: List[Tuple[BBox, Optional[str]]] = []
    for item in confirmed:
        if not item:
            continue
        bbox = _as_box_tuple(item.get("bbox") if isinstance(item, Mapping) else item)
        cname = item.get("class_name") if isinstance(item, Mapping) else None
        confirmed_pairs.append((bbox, cname))
    if not confirmed_pairs:
        return candidates

    def _match_excluded(candidate: object, use_iou: bool) -> bool:
        cbbox = _as_bbox(candidate)
        cname = _as_class(candidate)
        for bbox, cls in confirmed_pairs:
            if exclude_mode == "same_class" and cls and cname and cls != cname:
                continue
            if any_overlap:
                ax, ay, aw, ah = cbbox
                bx, by, bw, bh = bbox
                if (ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by):
                    return True
            if center_check and _center_in(cbbox, bbox):
                return True
            if use_iou and iou_threshold > 0 and compute_iou(cbbox, bbox) >= iou_threshold:
                return True
        return False

    filtered = [c for c in candidates if not _match_excluded(c, use_iou=True)]
    if filtered:
        return filtered
    relaxed = [c for c in candidates if not _match_excluded(c, use_iou=False)]
    return relaxed
