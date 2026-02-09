from __future__ import annotations

"""Annotation exporters for YOLO and COCO formats."""

from pathlib import Path
from typing import Dict, List, Tuple


def _build_class_map(candidates: List[Dict]) -> Dict[str, int]:
    classes = sorted({c["class_name"] for c in candidates})
    return {name: idx for idx, name in enumerate(classes)}


def export_annotations(
    image_path: Path,
    image_size: Tuple[int, int],
    candidates: List[Dict],
    output_format: str,
) -> Dict:
    """Export annotations in YOLO or COCO format.

    Args:
        image_path: Path to the image.
        image_size: (width, height)
        candidates: list of confirmed candidates with final_score.
        output_format: 'yolo' or 'coco'.

    Returns:
        dict containing export payload.
    """

    width, height = image_size
    class_to_id = _build_class_map(candidates)

    if output_format == "yolo":
        lines: List[str] = []
        for c in candidates:
            cls_id = class_to_id[c["class_name"]]
            x, y, w, h = c["bbox"]
            cx = (x + w / 2.0) / float(width)
            cy = (y + h / 2.0) / float(height)
            nw = w / float(width)
            nh = h / float(height)
            line = f"{cls_id} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f} {c['final_score']:.6f}"
            lines.append(line)
        return {
            "format": "yolo",
            "image": str(image_path),
            "classes": class_to_id,
            "lines": lines,
        }

    if output_format == "coco":
        annotations = []
        for idx, c in enumerate(candidates, start=1):
            x, y, w, h = c["bbox"]
            annotations.append(
                {
                    "id": idx,
                    "image_id": 1,
                    "category_id": class_to_id[c["class_name"]],
                    "bbox": [float(x), float(y), float(w), float(h)],
                    "score": float(c["final_score"]),
                    "iscrowd": 0,
                }
            )
        categories = [
            {"id": cid, "name": name} for name, cid in class_to_id.items()
        ]
        return {
            "format": "coco",
            "images": [
                {
                    "id": 1,
                    "file_name": image_path.name,
                    "width": width,
                    "height": height,
                }
            ],
            "categories": categories,
            "annotations": annotations,
        }

    raise ValueError("output_format must be 'yolo' or 'coco'")
