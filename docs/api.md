# API Specification

本書は現行コードから仕様を抽出して記載しています。動作確認・実運用での検証は別途必要です。

対象実装:
- `backend/app/main.py`
- `backend/app/schemas.py`
- `frontend/src/api.ts`

## 共通
- Base URL: `http://127.0.0.1:8000`
- CORS: `allow_origins=["*"]`, `allow_methods=["*"]`, `allow_headers=["*"]` (`main.py`)
- 主なエラー形式: FastAPI の `{"detail": "..."}`

## エンドポイント一覧

### Templates / Projects
- `GET /templates`
  - response: `ProjectInfo[]`
- `GET /projects`
  - response: `string[]`
- `GET /templates/{project}/{class_name}/{template_name}/preview`
  - response: `{ base64: string | null }`

### Dataset / Project管理
- `GET /dataset/projects`
  - response: `DatasetInfo[]`
- `POST /dataset/projects`
  - request: `{ project_name: string }`
  - response: `DatasetInfo`
- `DELETE /dataset/projects/{project_name}`
  - response: `{ ok: true }`
- `POST /dataset/import` (multipart)
  - form: `project_name`, `files[]`
  - response: `{ project_name, count }`
- `GET /dataset/{project_name}`
  - response: `DatasetInfo`
- `GET /dataset/{project_name}/image/{filename}`
  - response: image binary
- `POST /dataset/select`
  - request: `{ project_name?, dataset_id?, filename? }`
  - response: `UploadResponse`

### Annotation
- `POST /annotations/save`
  - request: `{ project_name, image_key, annotations[] }`
  - response: `{ ok: boolean }`
- `GET /annotations/load?project_name=...&image_key=...`
  - response: `{ ok, annotations[] }`
- `POST /annotations/clear`
  - request: `{ project_name }`
  - response: `{ ok, deleted }`

### Detect / Segment / Auto
- `POST /detect/point`
  - request: `DetectPointRequest`
  - response: `DetectPointResponse`
- `POST /detect/full`
  - request: `DetectFullRequest`
  - response: `DetectFullResponse`
- `POST /segment/candidate`
  - request: `SegmentCandidateRequest`
  - response: `SegmentCandidateResponse`
- `POST /annotate/auto`
  - request: `AutoAnnotateRequest`
  - response: `AutoAnnotateResponse`

### Export
- `POST /export/yolo`
  - request: `ExportYoloRequest`
  - response: `ExportYoloResponse`
- `GET /export/yolo/download?path=...`
  - response: text file
- `POST /export/dataset/bbox`
  - request: `ExportDatasetBBoxRequest`
  - response: `ExportDatasetBBoxResponse`
- `POST /export/dataset/seg`
  - request: `ExportDatasetSegRequest`
  - response: `ExportDatasetSegResponse`
- `GET /dataset/export/download?project_name=...&export_id=...`
  - response: zip file

## 主要スキーマ（要点）

### DetectPointRequest
- 必須: `image_id, project, x, y, roi_size`
- 主設定: `scale_min/max/steps, topk, template_off`
- 除外: `confirmed_annotations`, `exclude_mode`, `exclude_iou_threshold` など

### DetectPointResponse
- `results[]`: `class_name, score, bbox, template_name, scale`
- `debug`: ROI/クリック座標、プレビュー画像base64、match情報

### AutoAnnotateRequest
- 必須: `image_id, project, threshold`
- `method`: `combined | scaled_templates`
- `mode` は後方互換用途（`auto/manual`）
- advanced: `scale_min/max/steps, stride, roi_size`
- 保存対象指定: `project_name, image_key`

### AutoAnnotateResponse
- `added_count, rejected_count, threshold`
- `created_annotations[]` (class_name, bbox, score)

## OpenAPI 定義とコード整合メモ

### 一致している点
- ルートとメソッドは `main.py` と `frontend/src/api.ts` で概ね一致。
- `schemas.py` の主要リクエスト/レスポンス型が `response_model` と対応。

### 差分/注意点
- `frontend/src/api.ts` の `DetectPointResponse.debug` は `roi_match_preview_base64` を持つが、`schemas.py` の `DetectPointDebug` には定義なし。
  - `main.py` は `debug["roi_match_preview_base64"]` を設定しているため、型定義と実装にズレがある。
- `/export/dataset/seg` は実装上、`table_rows`/`rel_out` 未定義参照があり500になる可能性。
  - スキーマ上は正常レスポンス型が定義されているが、実行時不整合がある。

## 実装依存の仕様
- `output_dir` は export系で「絶対パス必須」。相対パスは `ok=false` またはエラー。
- `annotate/auto` は条件不正時に 400、内部例外は 500 (`detail` にメッセージ)。
