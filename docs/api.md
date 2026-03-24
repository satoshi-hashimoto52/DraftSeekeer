# API Specification

本書は `backend/app/main.py` と `backend/app/schemas.py` を一次情報として記載しています。

## 1. 共通
- Base URL: `http://127.0.0.1:8000`
- 認証: なし
- CORS: 全許可（`allow_origins=["*"]`）
- エラー形式:
  - FastAPI標準: `{"detail": "..."}`
  - API独自: `{"ok": false, "error": "..."}`

## 2. エンドポイント一覧

### 2.1 Templates
- `GET /templates`
- `GET /projects`
- `GET /templates/{project}/{class_name}/{template_name}/preview`
- `GET /templates/{project}/class-previews`
- `GET /templates/{project}/{class_name}/items`
- `GET /templates/{project}/{class_name}/{template_name}/image`
- `GET /templates/{project}/{class_name}/{template_name}/binary-image`
- `GET /templates/{project}/{class_name}/{template_name}/overlay-red`
- `GET /templates/{project}/{class_name}/{template_name}/overlay-blue`

### 2.2 Dataset / Annotation
- `GET /dataset/projects`
- `POST /dataset/projects`
- `DELETE /dataset/projects/{project_name}`
- `POST /dataset/import`（multipart: `project_name`, `files[]`）
- `GET /dataset/{project_name}`
- `GET /dataset/{project_name}/annotation-stats`
- `GET /dataset/{project_name}/image/{filename}`
- `POST /dataset/select`
- `POST /annotations/save`
- `GET /annotations/load`
- `POST /annotations/clear`

### 2.3 Image / Detect / Segment / Auto
- `POST /image/upload`
- `POST /detect/point`
- `POST /detect/full`
- `POST /segment/candidate`
- `POST /annotate/auto`
- `GET /annotate/auto/progress/{progress_id}`
- `GET /benchmarks/{project_name}`
- `DELETE /benchmarks/{project_name}/{run_id}`

### 2.4 Export
- `POST /export/yolo`
- `GET /export/yolo/download?path=...`
- `POST /export/dataset/bbox`
- `POST /export/dataset/seg`
- `GET /dataset/export/download?project_name=...&export_id=...`

### 2.5 App Control
- `POST /app/shutdown`
- `POST /shutdown`（互換ルート）

## 3. 主要リクエスト/レスポンス

### 3.1 `POST /detect/point`
request: `DetectPointRequest`
- 必須: `image_id`, `project`, `x`, `y`, `roi_size`
- 主な任意:
  - `scale_min`, `scale_max`, `scale_steps`, `topk`
  - `class_filter`, `template_off`
  - `shape_ratio_threshold`
- 除外制御:
  - `confirmed_annotations`
  - `exclude_enabled`, `exclude_mode`, `exclude_center`, `exclude_iou_threshold`

response: `DetectPointResponse`
- `results[]`: `class_name`, `score`, `bbox`, `outer_bbox`, `template_name`, `scale` など
- `debug`: ROIプレビュー・マッチ情報（base64含む）

### 3.2 `POST /segment/candidate`
request: `SegmentCandidateRequest`
- `image_id`
- `bbox`
- 任意: `click`, `expand`, `simplify_eps`

response: `SegmentCandidateResponse`
- `ok`, `polygon`, `bbox`, `meta`, `error`
- `meta.method`: `sam` または `fallback`

### 3.3 `POST /annotate/auto`
request: `AutoAnnotateRequest`
- 必須: `image_id`, `project`, `threshold`
- `method`: `combined | scaled_templates | scaled_templates_beta`
- 主な任意:
  - `class_filter`
  - `scale_min/max/steps`
  - `stride`, `roi_size`
  - `project_name`, `image_key`（保存/履歴連携時）
  - `progress_id`

response: `AutoAnnotateResponse`
- `added_count`, `rejected_count`, `threshold`
- `created_annotations[]`
- `class_progress[]`

### 3.4 `GET /benchmarks/{project_name}`
response: `BenchmarkRunsResponse`
- `runs[]`:
  - `run_id`, `status`, `method`, `mode_label`
  - `duration_ms`, `params`, `summary`
  - `class_progress`, `confirmed_annotations`

### 3.5 `POST /export/yolo`
request: `ExportYoloRequest`
- 必須: `project`, `image_id`, `annotations`, `output_dir`
- 任意: `project_name`, `image_key`

response: `ExportYoloResponse`
- `ok`, `saved_path`, `text_preview`, `error`

## 4. 例

### 4.1 クリック検出
```bash
curl -X POST http://127.0.0.1:8000/detect/point \
  -H 'Content-Type: application/json' \
  -d '{
    "image_id":"dataset::project::image.png",
    "project":"estimate",
    "x":1200,
    "y":830,
    "roi_size":340,
    "scale_min":0.65,
    "scale_max":1.20,
    "scale_steps":8,
    "topk":3
  }'
```

### 4.2 全自動（全域精密探索）
```bash
curl -X POST http://127.0.0.1:8000/annotate/auto \
  -H 'Content-Type: application/json' \
  -d '{
    "image_id":"dataset::project::32.png",
    "project":"estimate",
    "threshold":0.81,
    "method":"scaled_templates_beta",
    "project_name":"1",
    "image_key":"32.png"
  }'
```

## 5. 実装上の注意（コード準拠）
- export系 API の `output_dir` は絶対パス必須です。
- `POST /export/dataset/seg` は現行実装に未定義変数参照があり、500 になる可能性があります。
- `/export/yolo/download` は `RUNS_DIR` 配下のみ許可するパス制限があります。
- `frontend/src/api.ts` の debug 型には `roi_match_preview_base64` がある一方、`schemas.py` の `DetectPointDebug` には未定義です（互換上は受信可能）。
