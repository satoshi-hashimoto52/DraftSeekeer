# Data Specification

## 1. ディレクトリ構造
- `data/templates/` テンプレート
- `data/images/` 単発アップロード画像
- `data/datasets/` プロジェクトデータ
- `data/runs/` YOLO出力・ダウンロード対象

## 2. Dataset 構造
`data/datasets/<project_name>/`
- `meta.json`
- `images/`
- `annotations/`
- `matching_table.json`
- `exports_index.json`
- `benchmarks.json`

## 3. `meta.json`
- 画像一覧は `images` 配列
- 各エントリ（現行）:
  - `original_filename`
  - `filename`（任意）
  - `internal_id`
  - `import_order`
  - `width`, `height`（任意）

## 4. annotations ファイル
`data/datasets/<project>/annotations/<image_filename>.json`
- 配列形式
- 要素（`AnnotationPayload` 相当）:
  - `class_name`
  - `bbox: {x,y,w,h}`
  - 任意: `template_name`, `scale`, `score`, `segPolygon`, `source`, `created_at`, `segMethod`

## 5. templates 構造
- 推奨: `data/templates/<project>/<class>/*.png|jpg|jpeg`
- 互換: `data/templates/<class>/*` は project=`default` 扱い

## 6. ベンチマーク履歴
`data/datasets/<project>/benchmarks.json`
- `runs[]` に実行履歴を保存
- 主な項目: `run_id`, `status`, `method`, `mode_label`, `duration_ms`, `params`, `summary`, `class_progress`, `confirmed_annotations`

## 7. YOLO 出力仕様
実装: `backend/app/export_yolo.py`

### BBox 行
`<class_id> <cx> <cy> <w> <h>`
- すべて 0..1 正規化

### Seg 行
`<class_id> <x1> <y1> <x2> <y2> ...`
- `segPolygon` が3点以上あるとき優先

## 8. export index
- `exports_index.json`: `export_id -> absolute_path`
- `matching_table.json`: 画像名と出力画像番号の対応

## 9. 入出力APIとの対応
- 保存: `POST /annotations/save`
- 読込: `GET /annotations/load`
- Dataset export: `POST /export/dataset/bbox`, `POST /export/dataset/seg`
- YOLO単体: `POST /export/yolo`

## 10. 既知の注意
- `POST /export/dataset/seg` は現行実装に未定義変数参照があり、失敗する可能性があります。
