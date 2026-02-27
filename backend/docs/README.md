# Backend Developer Guide

Backend の入口ドキュメントです。詳細は `backend/app/docs/` 配下を参照してください。

## 読み順（推奨）
1. `backend/app/docs/main.md`（ルーティングと全体フロー）
2. `backend/app/docs/schemas.md`（API型）
3. `backend/app/docs/templates.md` / `matching.md` / `filters.md` / `nms.md`（検出系）
4. `backend/app/docs/storage.md`（保存I/O）
5. `backend/app/docs/sam_service.md` / `sam_device.md`（SAM系）

## 実装ファイル対応
- API統合: `backend/app/main.py`
- スキーマ: `backend/app/schemas.py`
- 検出コア: `backend/app/detection_core.py`, `matching.py`, `filters.py`, `nms.py`
- テンプレート: `backend/app/templates.py`
- 保存: `backend/app/storage.py`
- 出力: `backend/app/export_yolo.py`

## 注意
- 現行コードでは `POST /export/dataset/seg` に既知不具合（未定義変数参照）があります。
- テンプレート更新反映には backend 再起動が必要です。
