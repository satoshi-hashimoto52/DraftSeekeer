# Data & Template Spec

## 要約
- Dataset は `data/datasets/<project_name>/` 配下に保存されます。
- `meta.json` が画像順序と internal_id を管理します。
- Templates は `data/templates/<project>/<class>/*` です。
- テンプレは tight bbox を計算して余白を除去します。
- 画像形式は jpg/png のみ対応です。
- 断定できない点は【要確認】で明記します。
- 例は `data/datasets/1` と `data/templates/estimate` を参照しています。
- 仕様は `backend/app/templates.py` と `backend/app/main.py` を参照。
- 破壊的変更は UI と API に影響します。
- 相互参照は [overview](overview.md) と [api](api.md) を参照してください。

## 目次
- [Dataset 構造](#dataset-構造)
- [meta.json スキーマ](#metajson-スキーマ)
- [Annotations](#annotations)
- [Templates 構造](#templates-構造)
- [テンプレ命名ルール](#テンプレ命名ルール)
- [前処理と座標系](#前処理と座標系)
- [データ削除/更新ルール](#データ削除更新ルール)

## Dataset 構造
```
data/datasets/<project>/
  images/
  annotations/
  meta.json
```

- `images/`: 画像ファイル
- `annotations/`: 画像ごとの JSON (`<filename>.json`)
- `meta.json`: 画像エントリと並び順

## meta.json スキーマ
例:
```json
{
  "project_name": "1",
  "images": [
    {"original_filename": "32_1.jpeg", "filename": "32_1.jpeg", "internal_id": "001", "import_order": 1}
  ]
}
```

ルール:
- `images` は配列
- 並び順は `import_order` で決定
- `internal_id` は 3桁文字列が推奨
- `filename` は UI 表示用で `original_filename` と同値運用
- `width/height` は API 返却時に付与される場合がある

## Annotations
`data/datasets/<project>/annotations/<image>.json`

例:
```json
[
  {
    "class_name": "door_w",
    "bbox": {"x": 10, "y": 20, "w": 50, "h": 80},
    "segPolygon": [{"x": 12, "y": 22}, {"x": 40, "y": 22}, {"x": 40, "y": 60}]
  }
]
```

## Templates 構造
```
data/templates/<project>/<class>/*.png|*.jpg
```

例:
```
data/templates/estimate/door_w/0.png
```

`templates.py` は以下を行う:
- `project`/`class` の階層を検出
- 画像を灰度化
- tight bbox を算出
- edge/bin の前処理画像を保持

## テンプレ命名ルール
- フォルダ名 = `class_name`
- ファイル名は任意だが数値連番が推奨
- RGBA の場合は alpha をラインマスクとして扱う

## 前処理と座標系
- `tight_bbox` は「線画領域」の外接矩形
- マッチングはテンプレ全体で行い、BBox は tight bbox で返す
- ROI とテンプレの前処理を揃える

## データ削除/更新ルール
- `/dataset/import` は **存在しない画像を削除** する
- `meta.json` の順序が UI の順序
- `images/` から削除すると `annotations/` の参照が壊れる
- 破壊的更新の前にバックアップ推奨
