from __future__ import annotations

from typing import List, Optional

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
    filename: str | None = None


class DetectPointRequest(BaseModel):
    image_id: str
    project: str
    x: int
    y: int
    roi_size: int = Field(..., gt=0)
    scale_min: float = Field(0.5, gt=0)
    scale_max: float = Field(1.5, gt=0)
    scale_steps: int = Field(12, gt=0)
    score_threshold: float = Field(-1.0, ge=-1.0, le=1.0)
    iou_threshold: float = Field(0.4, ge=0, le=1)
    topk: int = Field(3, gt=0)
    template_off: bool = False
    confirmed_boxes: List[BBox] = Field(default_factory=list)
    exclude_same_class_only: bool = False
    refine_contour: bool = False
    confirmed_annotations: List["ConfirmedAnnotation"] | None = None
    exclude_enabled: bool = True
    exclude_mode: str = Field("same_class", pattern="^(same_class|any_class)$")
    exclude_center: bool = True
    exclude_iou_threshold: float = Field(0.6, ge=0, le=1)


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
    contour: Optional[List[Point]] = None


class DetectPointResponse(BaseModel):
    results: List[DetectResult]


class DetectFullRequest(BaseModel):
    image_id: str
    project: str
    scale_min: float = Field(0.5, gt=0)
    scale_max: float = Field(1.5, gt=0)
    scale_steps: int = Field(12, gt=0)
    score_threshold: float = Field(-1.0, ge=-1.0, le=1.0)
    iou_threshold: float = Field(0.4, ge=0, le=1)
    topk: int = Field(20, gt=0)
    confirmed_boxes: List[BBox] = Field(default_factory=list)
    exclude_same_class_only: bool = False
    confirmed_annotations: List["ConfirmedAnnotation"] | None = None
    exclude_enabled: bool = True
    exclude_mode: str = Field("same_class", pattern="^(same_class|any_class)$")
    exclude_center: bool = True
    exclude_iou_threshold: float = Field(0.6, ge=0, le=1)


class DetectFullResult(BaseModel):
    class_name: str
    score: float
    bbox: BBox


class ConfirmedAnnotation(BaseModel):
    class_name: str
    bbox: BBox


class DetectFullResponse(BaseModel):
    results: List[DetectFullResult]


class Point(BaseModel):
    x: int
    y: int


class SegmentCandidateRequest(BaseModel):
    image_id: str
    bbox: BBox
    click: Point | None = None
    expand: float = Field(0.2, ge=0)
    simplify_eps: float = Field(2.0, ge=0)


class SegmentMeta(BaseModel):
    device: str
    method: str
    area: int


class SegmentCandidateResponse(BaseModel):
    ok: bool
    polygon: List[Point] | None = None
    bbox: BBox | None = None
    meta: SegmentMeta | None = None
    error: str | None = None


class ExportAnnotation(BaseModel):
    class_name: str
    bbox: BBox
    segPolygon: List[Point] | None = None


class ExportYoloRequest(BaseModel):
    project: str
    image_id: str
    annotations: List[ExportAnnotation]
    output_dir: str
    project_name: str | None = None
    image_key: str | None = None


class ExportYoloResponse(BaseModel):
    ok: bool
    saved_path: str | None = None
    text_preview: str | None = None
    error: str | None = None


class AnnotationPayload(BaseModel):
    class_name: str
    bbox: BBox
    segPolygon: List[Point] | None = None
    source: str | None = None
    created_at: str | None = None
    segMethod: str | None = None


class SaveAnnotationsRequest(BaseModel):
    project_name: str
    image_key: str
    annotations: List[AnnotationPayload]


class LoadAnnotationsResponse(BaseModel):
    ok: bool
    annotations: List[AnnotationPayload]


class ExportDatasetBBoxRequest(BaseModel):
    project_name: str
    project: str
    split_train: int = 7
    split_val: int = 2
    split_test: int = 1
    seed: int = 42
    include_negatives: bool = True
    output_dir: str


class ExportDatasetBBoxResponse(BaseModel):
    ok: bool
    output_dir: str | None = None
    export_id: str | None = None
    counts: dict | None = None
    error: str | None = None


class ExportDatasetSegRequest(BaseModel):
    project_name: str
    project: str
    split_train: int = 7
    split_val: int = 2
    split_test: int = 1
    seed: int = 42
    output_dir: str


class ExportDatasetSegResponse(BaseModel):
    ok: bool
    output_dir: str | None = None
    export_id: str | None = None
    counts: dict | None = None
    error: str | None = None


class DatasetImportResponse(BaseModel):
    project_name: str
    count: int


class DatasetInfo(BaseModel):
    project_name: str
    images: List["DatasetImageEntry"]
    total_images: int = 0
    annotated_images: int = 0
    bbox_count: int = 0
    seg_count: int = 0
    updated_at: str | None = None


class DatasetSelectRequest(BaseModel):
    project_name: str | None = None
    dataset_id: str | None = None
    filename: str | None = None


class ProjectCreateRequest(BaseModel):
    project_name: str


class DatasetImageEntry(BaseModel):
    original_filename: str
    filename: str | None = None
    internal_id: str
    import_order: int
