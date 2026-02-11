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
    filename: Optional[str] = None


class DetectPointRequest(BaseModel):
    image_id: str
    project: str
    x: float
    y: float
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
    confirmed_annotations: Optional[List["ConfirmedAnnotation"]] = None
    exclude_enabled: bool = True
    exclude_mode: str = Field("same_class", pattern="^(same_class|any_class)$")
    exclude_center: bool = True
    exclude_iou_threshold: float = Field(0.6, ge=0, le=1)


class BBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class DetectResult(BaseModel):
    class_name: str
    score: float
    bbox: BBox
    template_name: str
    scale: float
    contour: Optional[List[Point]] = None


class DetectPointResponse(BaseModel):
    results: List[DetectResult]
    debug: Optional["DetectPointDebug"] = None


class DetectPointDebug(BaseModel):
    clicked_image_xy: Optional["DebugPoint"] = None
    roi_click_xy: Optional["DebugPoint"] = None
    roi_bbox: Optional[dict] = None
    roi_preview_base64: Optional[str] = None
    roi_preview_marked_base64: Optional[str] = None
    roi_edge_preview_base64: Optional[str] = None
    template_edge_preview_base64: Optional[str] = None
    match_score: Optional[float] = None
    match_offset_in_roi: Optional["DebugPoint"] = None
    match_mode: Optional[str] = None
    outer_bbox: Optional[dict] = None
    tight_bbox: Optional[dict] = None


class DebugPoint(BaseModel):
    x: float
    y: float


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
    confirmed_annotations: Optional[List["ConfirmedAnnotation"]] = None
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
    click: Optional[Point] = None
    expand: float = Field(0.2, ge=0)
    simplify_eps: float = Field(2.0, ge=0)


class SegmentMeta(BaseModel):
    device: str
    method: str
    area: int


class SegmentCandidateResponse(BaseModel):
    ok: bool
    polygon: Optional[List[Point]] = None
    bbox: Optional[BBox] = None
    meta: Optional[SegmentMeta] = None
    error: Optional[str] = None


class ExportAnnotation(BaseModel):
    class_name: str
    bbox: BBox
    segPolygon: Optional[List[Point]] = None


class ExportYoloRequest(BaseModel):
    project: str
    image_id: str
    annotations: List[ExportAnnotation]
    output_dir: str
    project_name: Optional[str] = None
    image_key: Optional[str] = None


class ExportYoloResponse(BaseModel):
    ok: bool
    saved_path: Optional[str] = None
    text_preview: Optional[str] = None
    error: Optional[str] = None


class AnnotationPayload(BaseModel):
    class_name: str
    bbox: BBox
    score: Optional[float] = None
    segPolygon: Optional[List[Point]] = None
    source: Optional[str] = None
    created_at: Optional[str] = None
    segMethod: Optional[str] = None


class SaveAnnotationsRequest(BaseModel):
    project_name: str
    image_key: str
    annotations: List[AnnotationPayload]


class LoadAnnotationsResponse(BaseModel):
    ok: bool
    annotations: List[AnnotationPayload]


class ClearAnnotationsRequest(BaseModel):
    project_name: str


class ClearAnnotationsResponse(BaseModel):
    ok: bool
    deleted: int = 0


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
    output_dir: Optional[str] = None
    export_id: Optional[str] = None
    counts: Optional[dict] = None
    error: Optional[str] = None


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
    output_dir: Optional[str] = None
    export_id: Optional[str] = None
    counts: Optional[dict] = None
    error: Optional[str] = None


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
    updated_at: Optional[str] = None


class DatasetSelectRequest(BaseModel):
    project_name: Optional[str] = None
    dataset_id: Optional[str] = None
    filename: Optional[str] = None


class ProjectCreateRequest(BaseModel):
    project_name: str


class DatasetImageEntry(BaseModel):
    original_filename: str
    filename: Optional[str] = None
    internal_id: str
    import_order: int
    width: Optional[int] = None
    height: Optional[int] = None


class AutoAnnotateRequest(BaseModel):
    image_id: str
    project: str
    threshold: float = 0.8
    method: str = Field("combined", pattern="^(combined|scaled_templates)$")
    # deprecated (backward compatibility)
    mode: Optional[str] = None
    class_filter: Optional[List[str]] = None
    # advanced settings (optional)
    scale_min: Optional[float] = None
    scale_max: Optional[float] = None
    scale_steps: Optional[int] = None
    stride: Optional[int] = None
    roi_size: Optional[int] = None
    project_name: Optional[str] = None
    image_key: Optional[str] = None


class AutoAnnotationItem(BaseModel):
    class_name: str
    bbox: BBox
    score: float


class AutoAnnotateResponse(BaseModel):
    added_count: int
    rejected_count: int
    threshold: float
    created_annotations: Optional[List[AutoAnnotationItem]] = None
    preview_image_url: Optional[str] = None
