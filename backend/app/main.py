from __future__ import annotations

from typing import List

import cv2
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import (
    DEFAULT_SCALE_MAX,
    DEFAULT_SCALE_MIN,
    DEFAULT_SCALE_STEPS,
    DEFAULT_TOPK,
    IMAGES_DIR,
    TEMPLATES_ROOT,
)
from .matching import match_templates
from .schemas import (
    DetectPointRequest,
    DetectPointResponse,
    DetectResult,
    ProjectInfo,
    TemplateInfo,
    UploadResponse,
)
from .storage import resolve_image_path, save_upload
from .templates import scan_templates


app = FastAPI(title="Annotator MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates_cache = scan_templates(TEMPLATES_ROOT)


@app.get("/templates", response_model=List[ProjectInfo])
def list_templates() -> List[ProjectInfo]:
    projects: List[ProjectInfo] = []
    for project, classes in templates_cache.items():
        templates: List[TemplateInfo] = [
            TemplateInfo(class_name=class_name, count=len(items))
            for class_name, items in classes.items()
        ]
        templates.sort(key=lambda t: t.class_name)
        projects.append(ProjectInfo(name=project, classes=templates))
    projects.sort(key=lambda p: p.name)
    return projects


@app.get("/projects", response_model=List[str])
def list_projects() -> List[str]:
    return sorted(templates_cache.keys())


@app.post("/image/upload", response_model=UploadResponse)
def upload_image(file: UploadFile = File(...)) -> UploadResponse:
    try:
        image_id, width, height = save_upload(file, IMAGES_DIR)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return UploadResponse(image_id=image_id, width=width, height=height)


@app.post("/detect/point", response_model=DetectPointResponse)
def detect_point(payload: DetectPointRequest) -> DetectPointResponse:
    try:
        image_path = resolve_image_path(IMAGES_DIR, payload.image_id)
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="invalid image_id")

    image = cv2.imread(str(image_path))
    if image is None:
        raise HTTPException(status_code=400, detail="failed to read image")

    project_templates = templates_cache.get(payload.project)
    if project_templates is None:
        raise HTTPException(status_code=400, detail="invalid project")

    matches = match_templates(
        image_bgr=image,
        x=payload.x,
        y=payload.y,
        roi_size=payload.roi_size,
        templates=project_templates,
        topk=payload.topk,
        scale_min=payload.scale_min or DEFAULT_SCALE_MIN,
        scale_max=payload.scale_max or DEFAULT_SCALE_MAX,
        scale_steps=payload.scale_steps or DEFAULT_SCALE_STEPS,
    )

    results: List[DetectResult] = [
        DetectResult(
            class_name=match.class_name,
            score=match.score,
            bbox={"x": match.bbox[0], "y": match.bbox[1], "w": match.bbox[2], "h": match.bbox[3]},
            template_name=match.template_name,
            scale=match.scale,
        )
        for match in matches
    ]

    return DetectPointResponse(results=results)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
