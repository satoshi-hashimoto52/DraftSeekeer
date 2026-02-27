# DraftSeeker Overview

## 1. 何をするシステムか
DraftSeeker は、図面画像に対してテンプレート照合を行い、候補BBoxを人手で確定しながらアノテーションを蓄積するためのローカルアプリケーションです。必要に応じて SAM による polygon 補助も実行できます。

## 2. コンポーネント
- Frontend: `frontend/src/App.tsx`, `frontend/src/components/ImageCanvas.tsx`
- Backend API: `backend/app/main.py`
- 検出コア:
  - クリック/ROIベース: `backend/app/matching.py`
  - 全自動: `backend/app/detection_core.py`
- セグメンテーション: `backend/app/sam_service.py`, `backend/app/polygon.py`
- 永続化: `backend/app/storage.py`, `data/datasets/*`

## 3. データフロー（主要）
1. Dataset 作成・取込（`/dataset/projects`, `/dataset/import`）
2. 画像選択（`/dataset/select`）
3. 検出（`/detect/point` または `/annotate/auto`）
4. 確定結果を保存（`/annotations/save`）
5. 必要時に Seg 補助（`/segment/candidate`）
6. 出力（`/export/yolo`, `/export/dataset/bbox`, `/export/dataset/seg`）

## 4. 自動アノテーション方式（現行コード）
`POST /annotate/auto` の `method` は以下を受け付けます。
- `combined`: 二値相関統合モード（`annotate_all`）
- `scaled_templates`: ROIタイル等倍拡張モード（`annotate_all_manual`）
- `scaled_templates_beta`: 全域精密探索モード（`annotate_all_global_precision`）

## 5. 保存先
- Dataset: `data/datasets/<project_name>/`
- テンプレート: `data/templates/<project>/<class>/*`
- 単発画像アップロード: `data/images/`
- YOLOダウンロード対象: `data/runs/`

## 6. 境界と前提
- 認証・認可は実装されていません（ローカル利用前提）。
- CORS は全許可です。
- テンプレートは起動時スキャンのため、反映には Backend 再起動が必要です。

## 7. 参照
- API: `docs/api.md`
- Runbook: `docs/runbook.md`
- Backend 詳細: `backend/app/docs/main.md`
- Frontend 詳細: `frontend/docs/README.md`
