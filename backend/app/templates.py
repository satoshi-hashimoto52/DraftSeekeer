from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np


IMAGE_EXTS = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class TemplateImage:
    project: str
    class_name: str
    template_name: str
    path: Path
    image_gray: "cv2.typing.MatLike"
    content_bbox: Tuple[int, int, int, int]


def scan_templates(templates_root: Path) -> Dict[str, Dict[str, List[TemplateImage]]]:
    templates: Dict[str, Dict[str, List[TemplateImage]]] = {}
    if not templates_root.exists():
        return templates

    class_dirs = [p for p in templates_root.iterdir() if p.is_dir()]
    if not class_dirs:
        return templates

    has_nested = any(any(child.is_dir() for child in d.iterdir()) for d in class_dirs)

    if has_nested:
        for level1 in class_dirs:
            for class_dir in level1.iterdir():
                if not class_dir.is_dir():
                    continue
                _load_class_dir(level1.name, class_dir, templates)
    else:
        for class_dir in class_dirs:
            _load_class_dir("default", class_dir, templates)

    return templates


def _load_class_dir(
    project: str,
    class_dir: Path,
    templates: Dict[str, Dict[str, List[TemplateImage]]],
) -> None:
    class_name = class_dir.name
    for img_path in class_dir.iterdir():
        if img_path.suffix.lower() not in IMAGE_EXTS:
            continue
        template = _load_template_gray(img_path)
        if template is None:
            continue
        img_gray, content_bbox = template
        x0, y0, w, h = content_bbox
        if w <= 0 or h <= 0:
            content_bbox = (0, 0, img_gray.shape[1], img_gray.shape[0])
            x0, y0, w, h = content_bbox
        cropped = img_gray[y0 : y0 + h, x0 : x0 + w]
        if cropped.size == 0:
            cropped = img_gray
            content_bbox = (0, 0, img_gray.shape[1], img_gray.shape[0])
        templates.setdefault(project, {}).setdefault(class_name, []).append(
            TemplateImage(
                project=project,
                class_name=class_name,
                template_name=img_path.name,
                path=img_path,
                image_gray=cropped,
                content_bbox=content_bbox,
            )
        )


def _load_template_gray(
    img_path: Path,
) -> Tuple["cv2.typing.MatLike", Tuple[int, int, int, int]] | None:
    img = cv2.imread(str(img_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.ndim == 2:
        gray = img
        return gray, _compute_content_bbox(gray)
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
        ys, xs = np.where(alpha > 0)
        if ys.size > 0 and xs.size > 0:
            y0, y1 = ys.min(), ys.max() + 1
            x0, x1 = xs.min(), xs.max() + 1
            img = img[y0:y1, x0:x1]
        bgr = img[:, :, :3]
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        return gray, _compute_content_bbox(gray)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return gray, _compute_content_bbox(gray)


def _compute_content_bbox(gray: "cv2.typing.MatLike") -> Tuple[int, int, int, int]:
    h, w = gray.shape[:2]
    if h == 0 or w == 0:
        return (0, 0, w, h)
    try:
        _, bin_img = cv2.threshold(
            gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
    except cv2.error:
        return (0, 0, w, h)
    contours, _ = cv2.findContours(bin_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return (0, 0, w, h)
    cnt = max(contours, key=cv2.contourArea)
    x, y, cw, ch = cv2.boundingRect(cnt)
    if cw <= 1 or ch <= 1:
        return (0, 0, w, h)
    area = cw * ch
    if area < max(25, int(w * h * 0.005)):
        return (0, 0, w, h)
    pad = 2
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(w, x + cw + pad)
    y1 = min(h, y + ch + pad)
    return (x0, y0, x1 - x0, y1 - y0)
