# backend/app/schemas.py

## 役割
FastAPI 入出力スキーマを定義します。`main.py` の `response_model` / request body と1対1で対応します。

## 主要カテゴリ
- Detect: `DetectPointRequest/Response`, `DetectFullRequest/Response`
- Segment: `SegmentCandidateRequest/Response`, `SegmentMeta`
- Annotation保存: `AnnotationPayload`, `SaveAnnotationsRequest`, `LoadAnnotationsResponse`
- Dataset: `DatasetInfo`, `DatasetImageEntry`, `DatasetImportResponse`, `ProjectCreateRequest`, `DatasetSelectRequest`
- Auto annotate: `AutoAnnotateRequest/Response`, `AutoAnnotateProgressResponse`, `AutoAnnotateClassProgress`
- Benchmark: `BenchmarkRunRecord`, `BenchmarkRunsResponse`
- Export: `ExportYoloRequest/Response`, `ExportDatasetBBoxRequest/Response`, `ExportDatasetSegRequest/Response`

## 重要フィールド

### AutoAnnotateRequest
- 必須: `image_id`, `project`
- `method`: `combined | scaled_templates | scaled_templates_beta`
- `mode` は後方互換用（deprecated）
- 任意詳細: `scale_min/max/steps`, `stride`, `roi_size`, `class_filter`

### DetectPointRequest
- 必須: `image_id`, `project`, `x`, `y`, `roi_size`
- 除外制御: `exclude_enabled`, `exclude_mode`, `exclude_center`, `exclude_iou_threshold`
- 形状閾値: `shape_ratio_threshold`

### BenchmarkRunRecord
- 実行メタ: `run_id`, `status`, `method`, `mode_label`, `duration_ms`, `threshold`
- 再現用パラメータ: `params`
- 実績: `summary`, `class_progress`, `confirmed_annotations`

## バリデーション例
- `roi_size > 0`
- `exclude_mode in {same_class, any_class}`
- `method in {combined, scaled_templates, scaled_templates_beta}`

## 互換性方針（現状）
- `AutoAnnotateRequest.mode` は legacy 受け口として維持
- Dataset メタは旧形式（文字列配列）読み込み互換を `main.py` 側で吸収

## 参照
- `backend/app/main.py`
- `docs/api.md`
