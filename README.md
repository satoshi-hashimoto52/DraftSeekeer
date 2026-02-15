# DraftSeeker

本書は現行コードから仕様を抽出して記載しています。動作確認・実運用での検証は別途必要です。

DraftSeeker は、図面画像に対してテンプレート照合と SAM 補助を使ってアノテーション作成を支援するローカル実行ツールです。主用途は、テンプレートベースの半自動/全自動アノテーションと、YOLO 形式データセット出力です。

## 5分で起動

### 1. 必要環境
- macOS (Apple Silicon を想定した実装あり)
- Python 3.10+ (`python3`)
- Node.js 18+
- SAM 利用時: `torch`, `segment-anything`, SAM checkpoint

### 2. Backend 起動
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend 起動
```bash
cd frontend
npm install
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

### 4. Quick Start

>Backend 起動
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

>Frontend 起動
```bash
cd frontend
npm install
pm run dev -- --host 127.0.0.1 --port 5173
```
---

## 全体構成
- `backend/app/`: FastAPI と検出・保存・エクスポート処理
- `frontend/src/`: React/Vite UI (`App.tsx` + `components/ImageCanvas.tsx`)
- `data/datasets/`: プロジェクト単位の画像・アノテーション
- `data/templates/`: テンプレート画像
- `data/runs/`: YOLOテキスト出力など
- `models/`: SAM checkpoint 配置先候補

## 想定ユースケース
- プロジェクト作成 → 画像取り込み
- テンプレートプロジェクト選択
- クリック検出で候補を確認し確定
- 必要に応じて SAM 補助セグメンテーション
- `Export dataset` で BBox/Seg データセットを出力

## 制限事項・未検証事項
- SAM checkpoint の既定パスが `backend/app/config.py` に固定値で埋め込まれています。環境差分は `SAM_CHECKPOINT` 環境変数で上書きしてください。
- `backend/app/main.py` の `/export/dataset/seg` 実装には未定義変数参照があり、500になる可能性があります。
- OpenAPI の実行時検証は依存ライブラリ導入済み環境でのみ可能です。
- CORS は `allow_origins=["*"]` で許可されていますが、500系エラー時にはブラウザが CORS エラーとして見せることがあります。
