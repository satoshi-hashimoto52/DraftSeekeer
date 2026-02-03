from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import cv2


IMAGE_EXTS = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class TemplateImage:
    project: str
    class_name: str
    template_name: str
    path: Path
    image_gray: "cv2.typing.MatLike"


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
        img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        templates.setdefault(project, {}).setdefault(class_name, []).append(
            TemplateImage(
                project=project,
                class_name=class_name,
                template_name=img_path.name,
                path=img_path,
                image_gray=img,
            )
        )
