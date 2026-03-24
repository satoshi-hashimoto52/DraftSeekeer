# Data Specification

本書は、`backend/app/main.py` の保存処理・読み込み処理に基づくデータ仕様です。

## 1. ディレクトリ構造
- `data/templates/` テンプレート
- `data/images/` 単発アップロード画像
- `data/datasets/` プロジェクトデータ
- `data/runs/` 一部出力データ

## 2. Dataset 構造
`data/datasets/<project_name>/`
- `meta.json`
- `images/`
- `annotations/`
- `matching_table.json`
- `exports_index.json`
- `benchmarks.json`

## 3. `meta.json`
- 画像一覧は `images` 配列で管理
- 現行エントリ項目:
  - `original_filename`
  - `filename`（任意）
  - `internal_id`
  - `import_order`
  - `width`, `height`（任意）

## 4. 画像IDフォーマット
- Dataset画像: `dataset::<project_name>::<filename>`
- メモリ一時画像: `mem::<uuid>.<ext>`

## 5. annotations ファイル
`data/datasets/<project>/annotations/<image_filename>.json`
- 配列形式
- 各要素（`AnnotationPayload` 相当）:
  - `class_name`
  - `bbox: {x, y, w, h}`
  - 任意:
    - `template_name`, `scale`, `score`
    - `segPolygon`
    - `source`, `created_at`, `segMethod`

## 6. templates 構造
- 推奨:
  - `data/templates/<project>/<class>/*.png|jpg|jpeg`
- 互換:
  - `data/templates/<class>/*` は `project="default"` として読み込み

## 7. ベンチマーク履歴
`data/datasets/<project>/benchmarks.json`
- `runs[]` に自動アノテ実行履歴を保存
- 主な項目:
  - `run_id`, `status`, `method`, `mode_label`
  - `duration_ms`, `params`, `summary`
  - `class_progress`, `confirmed_annotations`

## 8. Export 管理ファイル

### `exports_index.json`
- 形式: `export_id -> absolute_path`
- Dataset export ダウンロード時に参照

### `matching_table.json`
- 画像名と export 後の連番ファイル名の対応
- 主な項目:
  - `image_name`, `index`, `split`, `dataset_type`, `output_path`

## 9. YOLO 出力仕様
実装: `backend/app/export_yolo.py`

### 9.1 BBox 行
`<class_id> <cx> <cy> <w> <h>`
- すべて 0..1 正規化

### 9.2 Seg 行
`<class_id> <x1> <y1> <x2> <y2> ...`
- `segPolygon` が3点以上ある場合は polygon 形式を優先

## 10. APIとの対応
- 保存: `POST /annotations/save`
- 読込: `GET /annotations/load`
- Dataset export: `POST /export/dataset/bbox`, `POST /export/dataset/seg`
- 単体YOLO: `POST /export/yolo`

## 11. 既知の注意
- `POST /export/dataset/seg` は現行実装に未定義変数参照があり、失敗する可能性があります。
