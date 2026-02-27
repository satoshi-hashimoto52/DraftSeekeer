# DraftSeeker

DraftSeeker は、図面画像に対してテンプレートマッチングと補助セグメンテーション（SAM）を使い、アノテーション作業を半自動化するローカルツールです。クリック検出・ホバー検出・全自動アノテーション・YOLO出力までを一連のUIで扱えます。

## アーキテクチャ概要
- Backend: `backend/app/main.py` を起点に FastAPI で API を提供。検出ロジックは `detection_core.py` / `matching.py` / `filters.py` / `nms.py` に分離。
- Frontend: `frontend/src/App.tsx` が状態管理と画面遷移を担当。描画・座標変換は `frontend/src/components/ImageCanvas.tsx`。
- Data: プロジェクトデータは `data/datasets/<project>/`、テンプレートは `data/templates/`。
- Model: SAM は `backend/app/sam_service.py` で遅延ロードし、`sam_device.py` で `mps/cpu` を選択。

## ローカル起動

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

`./run.sh` は `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` を実行します。

### Frontend
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

## よくあるトラブル
- CORSエラーに見える: 実際は Backend 500 のことが多いです。まず backend コンソールの traceback を確認してください。
- SAM が動かない: `segment-anything` と checkpoint 設定を確認（`SAM_CHECKPOINT` / `SAM_MODEL_TYPE`）。
- Export が失敗する: `output_dir` は絶対パス必須です。
- テンプレ変更が反映されない: 起動時キャッシュなので Backend 再起動が必要です。
- 画像/注釈不整合: `data/datasets/<project>/meta.json` と `annotations/` の対応を確認してください。

## ドキュメント導線
- 全体像: `docs/overview.md`
- API 仕様: `docs/api.md`
- 運用手順・トラブル対応: `docs/runbook.md`
- データ仕様: `docs/data_spec.md`
- セキュリティ/プライバシー: `docs/security_privacy.md`
- Backend 実装密着ドキュメント: `backend/app/docs/main.md`
- Frontend 実装ガイド: `frontend/docs/README.md`

## 既知の実装注意
- `POST /export/dataset/seg` は現行コードに未定義変数参照（`table_rows`, `rel_out`）があり、500 となる可能性があります（`backend/app/main.py`）。
