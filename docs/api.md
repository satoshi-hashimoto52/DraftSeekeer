# API

本書はコードから仕様を抽出して記載しています。
動作確認・実運用テストは別途実施してください。

FastAPI 実装から抽出した仕様です。例は実在フィールドに基づきます。

## 共通

- BBox 形式: `{ "x": int, "y": int, "w": int, "h": int }`
- Point 形式: `{ "x": int, "y": int }`
- CORS: `http://127.0.0.1:5173`, `http://localhost:5173`

## GET /projects

テンプレートプロジェクトの一覧を返す。

Response:
```json
["estimate", "project_a"]
```

## GET /templates

テンプレート構成の一覧。

Response:
```json
[
  {
    "name": "estimate",
    "classes": [
      {"class_name": "roof_fan", "count": 12},
      {"class_name": "door_w", "count": 6}
    ]
  }
]
```

## POST /image/upload

単体画像をアップロードし `image_id` を発行。

Request (multipart/form-data):
- `file`: image

Response:
```json
{ "image_id": "<uuid>.png", "width": 1920, "height": 1080 }
```

## POST /detect/point

クリック ROI でテンプレ照合。

Request:
```json
{
  "image_id": "<uuid>.png",
  "project": "estimate",
  "x": 1200,
  "y": 800,
  "roi_size": 200,
  "scale_min": 0.5,
  "scale_max": 1.5,
  "scale_steps": 12,
  "score_threshold": -1.0,
  "iou_threshold": 0.4,
  "topk": 3,
  "template_off": false,
  "refine_contour": false,
  "confirmed_boxes": [],
  "confirmed_annotations": [
    {"class_name": "roof_fan", "bbox": {"x": 100, "y": 100, "w": 80, "h": 40}}
  ],
  "exclude_enabled": true,
  "exclude_mode": "same_class",
  "exclude_center": true,
  "exclude_iou_threshold": 0.6
}
```

Response:
```json
{
  "results": [
    {
      "class_name": "roof_fan",
      "score": 0.92,
      "bbox": {"x": 1180, "y": 760, "w": 84, "h": 46},
      "template_name": "0.png",
      "scale": 1.0
    }
  ]
}
```

Template OFF の場合は `class_name: "contour"` で contour が返る。

## POST /detect/full

画像全体をタイル検出。

Request:
```json
{
  "image_id": "<uuid>.png",
  "project": "estimate",
  "scale_min": 0.5,
  "scale_max": 1.5,
  "scale_steps": 12,
  "score_threshold": -1.0,
  "iou_threshold": 0.4,
  "topk": 20,
  "confirmed_boxes": [],
  "confirmed_annotations": [],
  "exclude_enabled": true,
  "exclude_mode": "same_class",
  "exclude_center": true,
  "exclude_iou_threshold": 0.6
}
```

Response:
```json
{
  "results": [
    {"class_name": "roof_fan", "score": 0.81, "bbox": {"x": 300, "y": 200, "w": 80, "h": 40}}
  ]
}
```

## POST /segment/candidate

選択候補に SAM を適用。失敗時はフォールバック。

Request:
```json
{
  "image_id": "<uuid>.png",
  "bbox": {"x": 100, "y": 100, "w": 80, "h": 40},
  "click": {"x": 120, "y": 120},
  "expand": 0.2,
  "simplify_eps": 2.0
}
```

Response (SAM):
```json
{
  "ok": true,
  "polygon": [{"x": 110, "y": 110}, {"x": 160, "y": 110}, {"x": 160, "y": 140}],
  "bbox": {"x": 84, "y": 92, "w": 108, "h": 68},
  "meta": {"device": "mps", "method": "sam", "area": 3600}
}
```

Response (fallback):
```json
{
  "ok": true,
  "polygon": [{"x": 110, "y": 110}, {"x": 160, "y": 110}, {"x": 160, "y": 140}],
  "bbox": {"x": 84, "y": 92, "w": 108, "h": 68},
  "meta": {"device": "cpu", "method": "fallback", "area": 3600}
}
```

## POST /export/yolo

1画像分の YOLO / YOLO-seg を出力。

Request:
```json
{
  "project": "estimate",
  "image_id": "<uuid>.png",
  "annotations": [
    {"class_name": "roof_fan", "bbox": {"x": 100, "y": 100, "w": 80, "h": 40}}
  ],
  "output_dir": "/Users/hashimoto/Downloads",
  "project_name": "estimate",
  "image_key": "001.png"
}
```

Response:
```json
{
  "ok": true,
  "saved_path": "/Users/hashimoto/Downloads/dataset_estimate_20260206/<uuid>.png.txt",
  "text_preview": "0 0.5 0.5 0.1 0.1"
}
```

制約:
- `output_dir` は **絶対パスのみ**許可

## GET /export/yolo/download

`data/runs` 配下のパスのみ取得可能。

Query:
```
/export/yolo/download?path=/abs/path/to/file.txt
```

## Dataset API

### GET /dataset/projects

プロジェクト一覧（data/datasets）を返す。

### POST /dataset/projects

プロジェクト作成。

Request:
```json
{"project_name": "estimate"}
```

### DELETE /dataset/projects/{project_name}

プロジェクト削除。

### POST /dataset/import

画像フォルダを取り込み。
- 同名ファイルは上書き
- 存在しなくなった画像は削除
- 既存順序を維持し、新規は末尾追加

Request (multipart/form-data):
- `project_name`
- `files[]`

Response:
```json
{"project_name": "estimate", "count": 128}
```

### GET /dataset/{project_name}

プロジェクト情報を返す。

Response:
```json
{
  "project_name": "estimate",
  "images": ["a.jpg", "c.jpg", "b.jpg"],
  "total_images": 3,
  "annotated_images": 2,
  "bbox_count": 14,
  "seg_count": 3,
  "updated_at": "2026-02-06 12:00:00"
}
```

### GET /dataset/{project_name}/image/{filename}

画像ファイル取得。

### POST /dataset/select

画像をアノテ対象として選択。

Request:
```json
{"project_name": "estimate", "filename": "a.jpg"}
```

Response:
```json
{ "image_id": "<uuid>.jpg", "width": 1920, "height": 1080 }
```

### POST /annotations/save

画像ごとのアノテ保存。

Request:
```json
{
  "project_name": "estimate",
  "image_key": "a.jpg",
  "annotations": [
    {
      "class_name": "roof_fan",
      "bbox": {"x": 100, "y": 100, "w": 80, "h": 40},
      "segPolygon": [{"x": 110, "y": 110}, {"x": 160, "y": 110}]
    }
  ]
}
```

### GET /annotations/load

Query:
```
/annotations/load?project_name=estimate&image_key=a.jpg
```

Response:
```json
{
  "ok": true,
  "annotations": [
    {"class_name": "roof_fan", "bbox": {"x": 100, "y": 100, "w": 80, "h": 40}}
  ]
}
```

### POST /export/dataset/bbox

bbox dataset 出力。

Request:
```json
{
  "project_name": "estimate",
  "project": "estimate",
  "split_train": 7,
  "split_val": 2,
  "split_test": 1,
  "seed": 42,
  "include_negatives": true,
  "output_dir": "/Users/hashimoto/Downloads"
}
```

Response:
```json
{
  "ok": true,
  "output_dir": "/Users/hashimoto/Downloads/dataset_estimate_20260206",
  "export_id": "dataset_estimate_20260206",
  "counts": {"train": 70, "val": 20, "test": 10}
}
```

### POST /export/dataset/seg

seg dataset 出力（segPolygon がある画像のみ）。

### GET /dataset/export/download

Query:
```
/dataset/export/download?project_name=estimate&export_id=dataset_estimate_20260206
```
