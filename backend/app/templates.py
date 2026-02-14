from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np


IMAGE_EXTS = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class TemplateVariant:
    rotation_deg: int
    edge: "cv2.typing.MatLike"
    mask: "cv2.typing.MatLike"
    angle_hist: Tuple[float, ...]
    tight_bbox: Tuple[int, int, int, int]
    outer_bbox: Tuple[int, int, int, int]


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
    line_variants: Tuple[TemplateVariant, ...]


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
        loaded = _load_template_gray_and_mask(img_path)
        if loaded is None:
            continue
        img_gray, alpha_mask = loaded
        h, w = img_gray.shape[:2]
        outer_bbox = (0, 0, w, h)
        tight_bbox = _compute_tight_bbox(img_gray)
        if tight_bbox[2] <= 0 or tight_bbox[3] <= 0:
            tight_bbox = outer_bbox
        tx, ty, tw, th = tight_bbox
        cropped_tight = img_gray[ty : ty + th, tx : tx + tw] if tw > 0 and th > 0 else img_gray
        if cropped_tight.size == 0:
            cropped_tight = img_gray
        cropped_mask = (
            alpha_mask[ty : ty + th, tx : tx + tw]
            if tw > 0 and th > 0
            else alpha_mask
        )
        if cropped_mask.size == 0:
            cropped_mask = alpha_mask
        image_proc_edge = _preprocess_edge(cropped_tight, cropped_mask)
        image_proc_bin = _preprocess_binary_inv(cropped_tight, cropped_mask)
        line_variants = _build_line_variants(cropped_tight, cropped_mask)
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
                line_variants=line_variants,
            )
        )


def _load_template_gray_and_mask(
    img_path: Path,
) -> Optional[Tuple["cv2.typing.MatLike", "cv2.typing.MatLike"]]:
    img = cv2.imread(str(img_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.ndim == 2:
        gray = img
        mask = np.where(gray < 250, 255, 0).astype(np.uint8)
        mask = _fallback_mask_if_empty(mask, gray)
        return gray, mask
    if img.shape[2] == 4:
        alpha0 = img[:, :, 3]
        ys, xs = np.where(alpha0 > 0)
        if ys.size > 0 and xs.size > 0:
            y0, y1 = ys.min(), ys.max() + 1
            x0, x1 = xs.min(), xs.max() + 1
            img = img[y0:y1, x0:x1]
        bgr = img[:, :, :3]
        alpha = img[:, :, 3]
        mask = np.where(alpha > 0, 255, 0).astype(np.uint8)
        if bgr.max() == 0 and bgr.min() == 0:
            # use alpha as line mask when RGB is empty
            gray = 255 - alpha
        else:
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        mask = _fallback_mask_if_empty(mask, gray)
        return gray, mask
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = np.where(gray < 250, 255, 0).astype(np.uint8)
    mask = _fallback_mask_if_empty(mask, gray)
    return gray, mask


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


def _fallback_mask_if_empty(mask: "cv2.typing.MatLike", gray: "cv2.typing.MatLike") -> "cv2.typing.MatLike":
    if int(np.count_nonzero(mask)) > 0:
        return mask
    _, bin_img = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return np.where(bin_img > 0, 255, 0).astype(np.uint8)


def _preprocess_edge(
    gray: "cv2.typing.MatLike", mask: Optional["cv2.typing.MatLike"] = None
) -> "cv2.typing.MatLike":
    if gray.size == 0:
        return gray
    bin_img = _preprocess_binary_inv(gray, mask)
    blur = cv2.GaussianBlur(bin_img, (3, 3), 0)
    edges = cv2.Canny(blur, 30, 100)
    if mask is not None and mask.shape == edges.shape:
        edges = cv2.bitwise_and(edges, mask)
    return np.where(edges > 0, 255, 0).astype(np.uint8)


def _preprocess_binary_inv(
    gray: "cv2.typing.MatLike", mask: Optional["cv2.typing.MatLike"] = None
) -> "cv2.typing.MatLike":
    if gray.size == 0:
        return gray
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, bin_img = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    if mask is not None and mask.shape == bin_img.shape:
        bin_img = cv2.bitwise_and(bin_img, mask)
    return bin_img


def _angle_hist(
    gray: "cv2.typing.MatLike", edge: "cv2.typing.MatLike", bins: int = 18
) -> Tuple[float, ...]:
    if gray.size == 0 or edge.size == 0:
        return tuple(0.0 for _ in range(bins))
    gray_f = gray.astype(np.float32)
    gx = cv2.Sobel(gray_f, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_f, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    ang = cv2.phase(gx, gy, angleInDegrees=True)
    ang = np.mod(ang, 180.0)
    sel = (edge > 0) & (mag > 1e-3)
    if int(np.count_nonzero(sel)) == 0:
        return tuple(0.0 for _ in range(bins))
    hist, _ = np.histogram(
        ang[sel], bins=bins, range=(0.0, 180.0), weights=mag[sel]
    )
    hist = hist.astype(np.float32)
    norm = float(np.linalg.norm(hist))
    if norm > 1e-6:
        hist /= norm
    return tuple(float(v) for v in hist.tolist())


def _rotate_90(gray: "cv2.typing.MatLike", k: int) -> "cv2.typing.MatLike":
    kk = k % 4
    if kk == 1:
        return cv2.rotate(gray, cv2.ROTATE_90_CLOCKWISE)
    if kk == 2:
        return cv2.rotate(gray, cv2.ROTATE_180)
    if kk == 3:
        return cv2.rotate(gray, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return gray


def _build_line_variants(
    gray: "cv2.typing.MatLike", mask: "cv2.typing.MatLike"
) -> Tuple[TemplateVariant, ...]:
    variants: List[TemplateVariant] = []
    for deg, k in ((0, 0), (90, 1), (180, 2)):
        g = _rotate_90(gray, k)
        m = _rotate_90(mask, k)
        edge = _preprocess_edge(g, m)
        hist = _angle_hist(g, edge, bins=18)
        h, w = g.shape[:2]
        variants.append(
            TemplateVariant(
                rotation_deg=deg,
                edge=edge,
                mask=m,
                angle_hist=hist,
                tight_bbox=(0, 0, w, h),
                outer_bbox=(0, 0, w, h),
            )
        )
    return tuple(variants)
