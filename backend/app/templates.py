from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

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
    tight_bbox: Tuple[int, int, int, int]
    outer_bbox: Tuple[int, int, int, int]
    image_proc_edge: "cv2.typing.MatLike"
    image_proc_bin: "cv2.typing.MatLike"


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
        img_gray = _load_template_gray(img_path)
        if img_gray is None:
            continue
        h, w = img_gray.shape[:2]
        outer_bbox = (0, 0, w, h)
        tight_bbox = _compute_tight_bbox(img_gray)
        if tight_bbox[2] <= 0 or tight_bbox[3] <= 0:
            tight_bbox = outer_bbox
        tx, ty, tw, th = tight_bbox
        cropped_tight = img_gray[ty : ty + th, tx : tx + tw] if tw > 0 and th > 0 else img_gray
        if cropped_tight.size == 0:
            cropped_tight = img_gray
        image_proc_edge = _preprocess_edge(cropped_tight)
        image_proc_bin = _preprocess_binary_inv(cropped_tight)
        templates.setdefault(project, {}).setdefault(class_name, []).append(
            TemplateImage(
                project=project,
                class_name=class_name,
                template_name=img_path.name,
                path=img_path,
                image_gray=img_gray,
                tight_bbox=tight_bbox,
                outer_bbox=outer_bbox,
                image_proc_edge=image_proc_edge,
                image_proc_bin=image_proc_bin,
            )
        )


def _load_template_gray(img_path: Path) -> Optional["cv2.typing.MatLike"]:
    img = cv2.imread(str(img_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.ndim == 2:
        return img
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
        ys, xs = np.where(alpha > 0)
        if ys.size > 0 and xs.size > 0:
            y0, y1 = ys.min(), ys.max() + 1
            x0, x1 = xs.min(), xs.max() + 1
            img = img[y0:y1, x0:x1]
        bgr = img[:, :, :3]
        alpha = img[:, :, 3]
        if bgr.max() == 0 and bgr.min() == 0:
            # use alpha as line mask when RGB is empty
            return 255 - alpha
        return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def _compute_tight_bbox(gray: "cv2.typing.MatLike") -> Tuple[int, int, int, int]:
    h, w = gray.shape[:2]
    if h == 0 or w == 0:
        return (0, 0, w, h)
    try:
        mask = gray < 128
    except Exception:
        return (0, 0, w, h)
    ys, xs = np.where(mask)
    if ys.size == 0 or xs.size == 0:
        return (0, 0, w, h)
    x0, x1 = xs.min(), xs.max() + 1
    y0, y1 = ys.min(), ys.max() + 1
    return (int(x0), int(y0), int(x1 - x0), int(y1 - y0))


def _preprocess_edge(gray: "cv2.typing.MatLike") -> "cv2.typing.MatLike":
    if gray.size == 0:
        return gray
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 50, 150)
    kernel = np.ones((3, 3), np.uint8)
    return cv2.dilate(edges, kernel, iterations=1)


def _preprocess_binary_inv(gray: "cv2.typing.MatLike") -> "cv2.typing.MatLike":
    if gray.size == 0:
        return gray
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, bin_img = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return bin_img
