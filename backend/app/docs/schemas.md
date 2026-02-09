# schemas

## 要約（10行以内）
- FastAPI の request/response スキーマ定義。
- 検出・Dataset・Seg・Export の型を集約。
- BBox は float 定義。

## 目的/責務
- API の入出力構造を厳密化。

## 公開API（関数/クラス）
- 主要クラス:
  - `DetectPointRequest`, `DetectPointResponse`, `DetectResult`, `DetectPointDebug`
  - `DetectFullRequest`, `DetectFullResponse`, `DetectFullResult`
  - `SegmentCandidateRequest`, `SegmentCandidateResponse`, `SegmentMeta`
  - `ExportDatasetBBoxRequest/Response`, `ExportDatasetSegRequest/Response`, `ExportYoloRequest/Response`
  - `DatasetInfo`, `DatasetImageEntry`, `DatasetImportResponse`
  - `SaveAnnotationsRequest`, `LoadAnnotationsResponse`, `AnnotationPayload`

## 入出力/データ
- 入力/出力: JSON
- バリデーション: `Field` による範囲制約

## 依存関係
- `pydantic`

## 主要ロジック（図や箇条書き）
- 型とバリデーション規則の定義のみ

## パラメータ/閾値の意味
- `roi_size`: ROI サイズ
- `scale_min/max/steps`: テンプレスケール探索
- `score_threshold`: スコア閾値
- `iou_threshold`: IoU 閾値

## テスト観点（最低5つ）
- 必須フィールド欠落時の 422
- `roi_size <= 0` でエラー
- `exclude_mode` の不正値
- bbox の負数
- debug フィールドの型不整合

## 変更時の注意（互換性/性能/安全）
- スキーマ変更は frontend と docs に影響
- 必須項目の追加は破壊的変更

関連: [main](main.md)
