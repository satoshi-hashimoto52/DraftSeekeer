# DraftSeeker Overview

本書は、システム全体像を短く把握するための概要資料です。

## 1. 目的
DraftSeeker は、図面画像に対する BBox / polygon アノテーションを、
テンプレート照合と SAM 補助で効率化するローカルツールです。

## 2. コンポーネント
- Frontend
  - 実装: `frontend/src/App.tsx`
  - 描画: `frontend/src/components/ImageCanvas.tsx`
- Backend
  - API統合: `backend/app/main.py`
  - スキーマ: `backend/app/schemas.py`
- 検出コア
  - テンプレート照合: `backend/app/matching.py`
  - 全自動: `backend/app/detection_core.py`
  - 除外/NMS: `backend/app/filters.py`, `backend/app/nms.py`
- Segmentation
  - SAMロード: `backend/app/sam_service.py`
  - デバイス選択: `backend/app/sam_device.py`
  - polygon変換: `backend/app/polygon.py`

## 3. 主要データフロー
1. プロジェクト作成（`/dataset/projects`）
2. 画像取込（`/dataset/import`）
3. 画像選択（`/dataset/select`）
4. 検出（`/detect/point`）
5. 必要時 segmentation（`/segment/candidate`）
6. annotation 保存（`/annotations/save`）
7. export（`/export/dataset/bbox` / `/export/dataset/seg`）

## 4. 自動アノテーションモード
`POST /annotate/auto` の `method`:
- `combined`（二値相関統合）
- `scaled_templates`（ROIタイル等倍拡張）
- `scaled_templates_beta`（全域精密探索）

## 5. 保存先
- Dataset: `data/datasets/<project_name>/`
- Template: `data/templates/<project>/<class>/`
- 単発アップロード画像: `data/images/`
- 実行結果（一部）: `data/runs/`

## 6. 運用前提
- 認証/認可なし
- CORS 全許可
- ローカルまたは閉域ネットワーク運用前提
- テンプレート反映は backend 再起動が必要（起動時キャッシュ）

## 7. 関連
- 使い方: `docs/usage.md`
- API仕様: `docs/api.md`
- 運用: `docs/runbook.md`
- データ仕様: `docs/data_spec.md`
