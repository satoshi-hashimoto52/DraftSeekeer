from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class TemplateInfo(BaseModel):
    class_name: str
    count: int


class ProjectInfo(BaseModel):
    name: str
    classes: List[TemplateInfo]


class UploadResponse(BaseModel):
    image_id: str
    width: int
    height: int


class DetectPointRequest(BaseModel):
    image_id: str
    project: str
    x: int
    y: int
    roi_size: int = Field(..., gt=0)
    scale_min: float = Field(0.5, gt=0)
    scale_max: float = Field(1.5, gt=0)
    scale_steps: int = Field(12, gt=0)
    topk: int = Field(3, gt=0)


class BBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class DetectResult(BaseModel):
    class_name: str
    score: float
    bbox: BBox
    template_name: str
    scale: float


class DetectPointResponse(BaseModel):
    results: List[DetectResult]
