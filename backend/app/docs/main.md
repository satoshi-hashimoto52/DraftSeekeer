# backend/app/main.py

## 役割
`main.py` は FastAPI アプリのエントリで、以下を統合します。
- テンプレート/データセット管理 API
- 検出 API（ポイント検出、全体検出、自動アノテーション）
- セグメンテーション API（SAM + fallback）
- Export API（YOLO単体、Dataset bbox/seg、ダウンロード）
- ベンチマーク履歴 API

## 主要エンドポイント
- Templates: `/templates`, `/projects`, `/templates/...`
- Dataset: `/dataset/projects`, `/dataset/import`, `/dataset/{project_name}`, `/dataset/select`
- Annotation: `/annotations/save`, `/annotations/load`, `/annotations/clear`
- Detect: `/detect/point`, `/detect/full`
- Segment: `/segment/candidate`
- Auto annotate: `/annotate/auto`, `/annotate/auto/progress/{progress_id}`
- Benchmarks: `/benchmarks/{project_name}`, `/benchmarks/{project_name}/{run_id}`
- Export: `/export/yolo`, `/export/yolo/download`, `/export/dataset/bbox`, `/export/dataset/seg`, `/dataset/export/download`
- App control: `/app/shutdown` (`/shutdown` 互換)

## 自動アノテーション方式
`POST /annotate/auto` の `method`:
- `combined` -> `detection_core.annotate_all`
- `scaled_templates` -> `detection_core.annotate_all_manual`
- `scaled_templates_beta` -> `detection_core.annotate_all_global_precision`

## 重要なデータ保存
- Project root: `data/datasets/<project_name>/`
- 画像: `images/`
- 注釈: `annotations/<image>.json`
- ベンチマーク: `benchmarks.json`
- エクスポート索引: `exports_index.json`, `matching_table.json`

## 例外・境界条件
- `output_dir` は export 系で絶対パス必須（相対パスは `ok=false`）
- 画像ID/プロジェクト不正は `HTTPException(400/404)`
- SAM 利用不可時は `/segment/candidate` で fallback に切替

## 性能・運用注意
- テンプレートは起動時 `scan_templates()` でキャッシュされるため、反映に再起動が必要
- CORS は全許可
- ベンチマークは project 単位 JSON へ追記保存

## 既知の不具合（コード準拠）
- `export_dataset_seg()` 内で `table_rows` / `rel_out` が未定義参照される経路があり、500 になる可能性があります。

## 参照
- `backend/app/docs/schemas.md`
- `backend/app/docs/storage.md`
- `backend/app/docs/templates.md`
- `docs/api.md`
