# Data Specification

本書は現行コードから仕様を抽出して記載しています。動作確認・実運用での検証は別途必要です。

## ルート構成
- `data/templates/`: テンプレート画像
- `data/images/`: メモリ以外の単発画像向け保管先（`storage.py`）
- `data/datasets/`: プロジェクト単位データ
- `data/runs/`: YOLO出力・ダウンロード対象

## datasets 構造
`data/datasets/<project_name>/`
- `meta.json`
- `images/` (元画像)
- `annotations/` (`<filename>.json`)
- `matching_table.json` (エクスポート対応表)
- `exports_index.json` (export_id と実パスの対応)

## meta.json 仕様
- 作成時 (`POST /dataset/projects`):
```json
{ "project_name": "...", "images": [] }
```
- 画像取り込み後 (`POST /dataset/import`):
  - `images` は API互換エントリ配列（`original_filename`, `internal_id`, `import_order`, `width`, `height`）
- 旧形式（`images: string[]`）読み込み互換あり (`_load_meta_entries`)

## templates 構造
- 標準: `data/templates/<project>/<class>/<image>`
- 互換: `data/templates/<class>/<image>` は project=`default` として扱う
- 読み込み時に `TemplateImage` を生成:
  - `image_gray`
  - `tight_bbox` / `outer_bbox`
  - `image_proc_edge` / `image_proc_bin`

## annotation 保存形式
`data/datasets/<project>/annotations/<image_filename>.json`
- 配列形式
- 要素は `AnnotationPayload` 相当:
  - `class_name`
  - `bbox: {x,y,w,h}`
  - 任意: `score`, `segPolygon`, `source`, `created_at`, `segMethod`

## project 単位で管理される情報
- 画像一覧・順序・内部ID (`meta.json`)
- 画像ファイル本体 (`images/`)
- 画像ごとのアノテーション (`annotations/`)
- export履歴 (`exports_index.json`)
- エクスポート対応表 (`matching_table.json`)

## 再読み込み時・再取込時の挙動
- `POST /dataset/import` は「新しい投入集合」を正とする。
  - 入力に含まれない既存画像は `images/` から削除。
  - 対応する `annotations/*.json` も削除。
- 含まれる既存画像は維持。新規画像は末尾追加。
- `annotations/load` はファイルがなければ空配列を返す。

## フロントエンド側のローカル保存（永続）
`localStorage` / `sessionStorage` を使用。
- 例: `draftseeker:viewState:v1`, `draftseeker.templateByDataset`, `draftseeker.importPathByDataset`, `draftSeeker.exportDirHistory` など。
- 初回起動制御: `sessionStorage` の `draftseeker:firstBootDone:v1`

## 未定義/未検証
- `matching_table.json` の完全な参照仕様は backend 実装依存で固定契約化されていない。
- `exports_index.json` は絶対パスを保持するため、環境移動時の再利用は未保証。
