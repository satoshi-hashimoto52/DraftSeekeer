# API

## 要約
- 本書は `backend/app/main.py` と `backend/app/schemas.py` を根拠に記述。
- FastAPI で JSON API を提供。
- 検出は `/detect/point` と `/detect/full`。
- Dataset 管理は `/dataset/*`。
- セグは `/segment/candidate`。
- Export は dataset と YOLO 単体。
- 不明点は【要確認】として関数名と確認箇所を明記。

## 目次
- [Endpoint 一覧](#endpoint-一覧)
- [共通仕様](#共通仕様)
- [Schema 定義](#schema-定義)
- [各 Endpoint 詳細](#各-endpoint-詳細)
- [エラー仕様](#エラー仕様)
- [主要フロー](#主要フロー)
- [互換性/バージョニング](#互換性バージョニング)

## Endpoint 一覧
| Method | Path | Summary |
|---|---|---|
| GET | `/templates` | テンプレート構成の取得 |
| GET | `/projects` | テンプレートプロジェクト名一覧 |
| GET | `/dataset/projects` | Dataset プロジェクト一覧 |
| POST | `/dataset/projects` | Dataset プロジェクト作成 |
| DELETE | `/dataset/projects/{project_name}` | Dataset プロジェクト削除 |
| POST | `/dataset/import` | Dataset 画像インポート |
| GET | `/dataset/{project_name}` | Dataset 詳細取得 |
| GET | `/dataset/{project_name}/image/{filename}` | Dataset 画像取得 |
| POST | `/dataset/select` | Dataset 画像選択（image_id 発行） |
| POST | `/annotations/save` | アノテーション保存 |
| GET | `/annotations/load` | アノテーション取得 |
| POST | `/export/dataset/bbox` | Dataset(BBox) export |
| POST | `/export/dataset/seg` | Dataset(Seg) export |
| GET | `/dataset/export/download` | Dataset export zip ダウンロード |
| POST | `/image/upload` | 単体画像アップロード |
| POST | `/detect/point` | クリックROI検出 |
| POST | `/detect/full` | 全体検出 |
| POST | `/segment/candidate` | セグメント生成 |
| POST | `/export/yolo` | YOLO 単体出力 |
| GET | `/export/yolo/download` | YOLO 出力ファイル取得 |

## 共通仕様
- Base URL: `http://127.0.0.1:8000`
- Content-Type: `application/json`
- 画像形式: `.jpg/.jpeg/.png`
- CORS: allow_origins = `*`（`backend/app/main.py` の `CORSMiddleware`）
- BBox: `{x, y, w, h}`（float）
- Point: `{x, y}`（int 定義だが float 入力は一部で許容）

## Schema 定義
（`backend/app/schemas.py` ベース）

### TemplateInfo
- `class_name: str`
- `count: int`

### ProjectInfo
- `name: str`
- `classes: List[TemplateInfo]`

### UploadResponse
- `image_id: str`
- `width: int`
- `height: int`
- `filename?: str`

### BBox
- `x: float`
- `y: float`
- `w: float`
- `h: float`

### Point
- `x: int`
- `y: int`

### DetectPointRequest
- `image_id: str`
- `project: str`
- `x: float`
- `y: float`
- `roi_size: int`（gt 0）
- `scale_min: float`（gt 0, default 0.5）
- `scale_max: float`（gt 0, default 1.5）
- `scale_steps: int`（gt 0, default 12）
- `score_threshold: float`（-1.0..1.0）
- `iou_threshold: float`（0..1）
- `topk: int`（gt 0）
- `template_off: bool`
- `confirmed_boxes: List[BBox]`
- `exclude_same_class_only: bool`
- `refine_contour: bool`
- `confirmed_annotations?: List[ConfirmedAnnotation]`
- `exclude_enabled: bool`
- `exclude_mode: "same_class" | "any_class"`
- `exclude_center: bool`
- `exclude_iou_threshold: float`（0..1）

### DetectResult
- `class_name: str`
- `score: float`
- `bbox: BBox`
- `template_name: str`
- `scale: float`
- `contour?: List[Point]`

### DetectPointDebug
- `clicked_image_xy?: DebugPoint`
- `roi_click_xy?: DebugPoint`
- `roi_bbox?: dict`
- `roi_preview_base64?: str`
- `roi_preview_marked_base64?: str`
- `roi_edge_preview_base64?: str`
- `template_edge_preview_base64?: str`
- `match_score?: float`
- `match_offset_in_roi?: DebugPoint`
- `match_mode?: str`
- `outer_bbox?: dict`
- `tight_bbox?: dict`

### DetectPointResponse
- `results: List[DetectResult]`
- `debug?: DetectPointDebug`

### DetectFullRequest
- `image_id: str`
- `project: str`
- `scale_min: float`（default 0.5）
- `scale_max: float`（default 1.5）
- `scale_steps: int`（default 12）
- `score_threshold: float`（-1.0..1.0）
- `iou_threshold: float`（0..1）
- `topk: int`（default 20）
- `confirmed_boxes: List[BBox]`
- `exclude_same_class_only: bool`
- `confirmed_annotations?: List[ConfirmedAnnotation]`
- `exclude_enabled: bool`
- `exclude_mode: "same_class" | "any_class"`
- `exclude_center: bool`
- `exclude_iou_threshold: float`（0..1）

### DetectFullResult
- `class_name: str`
- `score: float`
- `bbox: BBox`

### DetectFullResponse
- `results: List[DetectFullResult]`

### ConfirmedAnnotation
- `class_name: str`
- `bbox: BBox`

### SegmentCandidateRequest
- `image_id: str`
- `bbox: BBox`
- `click?: Point`
- `expand: float`（default 0.2, ge 0）
- `simplify_eps: float`（default 2.0, ge 0）

### SegmentMeta
- `device: str`
- `method: str`
- `area: int`

### SegmentCandidateResponse
- `ok: bool`
- `polygon?: List[Point]`
- `bbox?: BBox`
- `meta?: SegmentMeta`
- `error?: str`

### AnnotationPayload
- `class_name: str`
- `bbox: BBox`
- `segPolygon?: List[Point]`
- `source?: str`
- `created_at?: str`
- `segMethod?: str`

### SaveAnnotationsRequest
- `project_name: str`
- `image_key: str`
- `annotations: List[AnnotationPayload]`

### LoadAnnotationsResponse
- `ok: bool`
- `annotations: List[AnnotationPayload]`

### ExportDatasetBBoxRequest
- `project_name: str`
- `project: str`
- `split_train: int`（default 7）
- `split_val: int`（default 2）
- `split_test: int`（default 1）
- `seed: int`（default 42）
- `include_negatives: bool`（default true）
- `output_dir: str`（absolute path required）

### ExportDatasetBBoxResponse
- `ok: bool`
- `output_dir?: str`
- `export_id?: str`
- `counts?: dict`
- `error?: str`

### ExportDatasetSegRequest
- `project_name: str`
- `project: str`
- `split_train: int`（default 7）
- `split_val: int`（default 2）
- `split_test: int`（default 1）
- `seed: int`（default 42）
- `output_dir: str`（absolute path required）

### ExportDatasetSegResponse
- `ok: bool`
- `output_dir?: str`
- `export_id?: str`
- `counts?: dict`
- `error?: str`

### ExportAnnotation
- `class_name: str`
- `bbox: BBox`
- `segPolygon?: List[Point]`

### ExportYoloRequest
- `project: str`
- `image_id: str`
- `annotations: List[ExportAnnotation]`
- `output_dir: str`（absolute path required）
- `project_name?: str`
- `image_key?: str`

### ExportYoloResponse
- `ok: bool`
- `saved_path?: str`
- `text_preview?: str`
- `error?: str`

### DatasetInfo
- `project_name: str`
- `images: List[DatasetImageEntry]`
- `total_images: int`
- `annotated_images: int`
- `bbox_count: int`
- `seg_count: int`
- `updated_at?: str`

### DatasetImageEntry
- `original_filename: str`
- `filename?: str`
- `internal_id: str`
- `import_order: int`
- `width?: int`
- `height?: int`

### DatasetImportResponse
- `project_name: str`
- `count: int`

### ProjectCreateRequest
- `project_name: str`

### DatasetSelectRequest
- `project_name?: str`
- `dataset_id?: str`
- `filename?: str`

## 各 Endpoint 詳細

### GET /templates
- Response: `List[ProjectInfo]`

### GET /projects
- Response: `List[str]`

### GET /dataset/projects
- Response: `List[DatasetInfo]`

### POST /dataset/projects
- Request: `ProjectCreateRequest`
- Response: `DatasetInfo`
- Errors:
- 400: project_name invalid / already exists

### DELETE /dataset/projects/{project_name}
- Response: `{ok: true}`
- Errors:
- 404: project not found

### POST /dataset/import
- Request: multipart/form-data
- `project_name: str`
- `files: UploadFile[]`
- Response: `DatasetImportResponse`
- Errors:
- 400: no files / project not found

### GET /dataset/{project_name}
- Response: `DatasetInfo`
- Errors:
- 404: project not found

### GET /dataset/{project_name}/image/{filename}
- Response: image binary
- Errors:
- 404: image not found

### POST /dataset/select
- Request: `DatasetSelectRequest`
- Response: `UploadResponse`
- Errors:
- 400: project_name missing / filename missing
- 404: image not found

### POST /annotations/save
- Request: `SaveAnnotationsRequest`
- Response: `{ok: true}`
- Errors:
- 404: project not found

### GET /annotations/load
- Query: `project_name`, `image_key`
- Response: `LoadAnnotationsResponse`
- Errors:
- 404: project not found
- 500: invalid annotations JSON

### POST /export/dataset/bbox
- Request: `ExportDatasetBBoxRequest`
- Response: `ExportDatasetBBoxResponse`
- Errors:
- ok=false + error string（project not found / invalid meta / no images / invalid project / output_dir must be absolute）

### POST /export/dataset/seg
- Request: `ExportDatasetSegRequest`
- Response: `ExportDatasetSegResponse`
- Errors:
- ok=false + error string（project not found / invalid meta / no images / invalid project / output_dir must be absolute）

### GET /dataset/export/download
- Query: `project_name`, `export_id`
- Response: zip file
- Errors:
- 404: export not found

### POST /image/upload
- Request: multipart/form-data (file)
- Response: `UploadResponse`
- Errors:
- 400: unsupported file type / empty file / invalid image

### POST /detect/point
- Request: `DetectPointRequest`
- Response: `DetectPointResponse`
- Errors:
- 400: invalid image_id / failed to read image / invalid project

### POST /detect/full
- Request: `DetectFullRequest`
- Response: `DetectFullResponse`
- Errors:
- 400: invalid image_id / failed to read image / invalid project

### POST /segment/candidate
- Request: `SegmentCandidateRequest`
- Response: `SegmentCandidateResponse`
- Errors:
- ok=false + error string（invalid image_id / failed to read image / invalid bbox size / invalid expanded bbox / empty roi）

### POST /export/yolo
- Request: `ExportYoloRequest`
- Response: `ExportYoloResponse`
- Errors:
- ok=false + error string（invalid image_id / failed to read image / invalid project / output_dir must be absolute）

### GET /export/yolo/download
- Query: `path`
- Response: text file
- Errors:
- 400: invalid path
- 404: file not found

## エラー仕様
HTTP ステータスと body のパターン:

- 400 Bad Request
```json
{"detail":"invalid image_id"}
```

- 404 Not Found
```json
{"detail":"project not found"}
```

- 422 Unprocessable Entity（Pydantic バリデーション）
```json
{"detail":[{"loc":["body","roi_size"],"msg":"Input should be greater than 0","type":"greater_than"}]}
```

- 500 Internal Server Error
```json
{"detail":"invalid annotations"}
```

## 主要フロー

### 画像アップロード → クリック検出
1. `/image/upload` で `image_id` を取得
2. `/detect/point` で ROI 検出
3. UI で候補確定
4. `/annotations/save`

### Dataset インポート → クリック検出
1. `/dataset/projects` でプロジェクト作成
2. `/dataset/import`
3. `/dataset/select` で `image_id` を取得
4. `/detect/point` で検出

### セグ生成
1. `/segment/candidate` に `bbox` と `click` を送信
2. 失敗時は fallback で polygon 生成

### Export
1. `/export/dataset/bbox` or `/export/dataset/seg`
2. `/dataset/export/download` で zip 取得

### YOLO 単体出力
1. `/export/yolo`
2. `/export/yolo/download`

## 互換性/バージョニング
- 破壊的変更: スキーマの必須フィールド変更、型変更、パス変更
- 推奨: `/v1` プレフィックスの導入
- 既存クライアントに影響する場合は api.md に差分を明記

## 【要確認】
- `DetectPointDebug` に `roi_match_preview_base64` が含まれるが、schema 未記載。`backend/app/schemas.py` に未定義のため、必要なら追加。確認箇所: `backend/app/main.py: detect_point` の debug 生成部分。
- `exclude_same_class_only` が Request にあるが main.py で使用していない。確認箇所: `detect_point` / `detect_full`。
