# DraftSeeker

DraftSeeker は、図面画像に対してテンプレートマッチングと SAM（Segment Anything）補助を使い、アノテーション作業をローカルで半自動化するツールです。

## クイック起動
依存インストール済みなら、ターミナルを2つ開いて以下で起動できます。

### Terminal 1（Backend）
```bash
cd backend
source .venv/bin/activate
./run.sh
```

### Terminal 2（Frontend）
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

アクセス先:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000/docs`

## 現在の実装機能（コード準拠）
- プロジェクト管理
  - Dataset プロジェクトの作成・削除
  - 画像フォルダ取込（同期型）
- 画像アノテーション
  - クリック検出（`/detect/point`）
  - ホバー検出（一定間隔で再検出）
  - 手動 BBox 追加（Shift+ドラッグ）
  - 候補確定/却下、BBox リサイズ/移動
  - SAM or fallback による polygon 生成（`/segment/candidate`）
- 全自動アノテーション
  - `combined`
  - `scaled_templates`
  - `scaled_templates_beta`
  - 進捗ポーリングと履歴保存（benchmarks）
- 出力
  - Dataset Export（BBox / Seg）
  - ZIP ダウンロード（任意）
  - YOLO 単体出力 API（`/export/yolo`）

## システム構成
- Backend: FastAPI（`backend/app/main.py`）
- Frontend: React + Vite（`frontend/src/App.tsx`）
- Data:
  - Dataset: `data/datasets/<project>/`
  - Template: `data/templates/`
  - 一時/補助: `data/images/`, `data/runs/`

## セットアップ

### 前提
- Python 3.9 以上（`Pipfile` は 3.9 指定）
- Node.js / npm
- SAM を使う場合:
  - `segment-anything`, `torch`, `torchvision`
  - SAM checkpoint ファイル

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

- 起動先: `http://127.0.0.1:8000`
- Swagger UI: `http://127.0.0.1:8000/docs`

SAM の設定（任意）:
- `SAM_CHECKPOINT`
- `SAM_MODEL_TYPE`

未設定時は `backend/app/config.py` の既定値を使用します。

### Frontend
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

- 起動先: `http://127.0.0.1:5173`
- API 接続先は `frontend/src/api.ts` で固定: `http://127.0.0.1:8000`

## テンプレート配置
推奨:
```text
data/templates/<template_project>/<class_name>/*.{png,jpg,jpeg}
```

互換:
```text
data/templates/<class_name>/*
```

この場合は `project="default"` として読み込まれます。

## Dataset 構造
```text
data/datasets/<project_name>/
  meta.json
  images/
  annotations/
  matching_table.json
  exports_index.json
  benchmarks.json
```

注釈は `annotations/<image_filename>.json` に保存されます。

## 基本的な使い方
1. Home でプロジェクトを作成
2. 画像フォルダを取込（`jpg/jpeg/png`）
3. テンプレートプロジェクトを選択
4. 左ペインから画像を選択
5. キャンバスで検出
   - クリック検出 or ホバー検出
   - 候補を確定/却下
   - 必要なら `S` で segmentation
6. 必要に応じて全自動アノテーション実行
7. Export（BBox/Seg、フォルダまたはZIP）

## 入力操作（実装済み）
- `Shift + Drag`: 手動 BBox 作成
- `Enter`: 選択中候補を確定
- `S`: 選択中候補に segmentation 実行
- `← / →`: 候補移動
- `Esc / Delete / Backspace`: 検出状態クリア（候補選択時）
- `Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z`, `Cmd/Ctrl + Y`: Undo/Redo
- `Space + Drag` または中クリックドラッグ: パン
- `Ctrl + Wheel`: ズーム
- `Space + Double Click`: パン/ズーム初期化

## 検出・自動アノテーション既定値
手動検出（UI初期値）:
- `roi_size=350`
- `topk=3`
- `scale_min=0.6`
- `scale_max=1.4`
- `scale_steps=8`
- `shape_ratio_threshold=0.6`
- 除外: `enabled=true`, `mode=same_class`, `center=true`, `iou=0.6`

全自動（UI初期値）:
- method: `combined`
- threshold:
  - `combined=0.65`
  - `scaled_templates=0.70`
  - `scaled_templates_beta=0.80`

## Export の仕様
- `output_dir` は **絶対パス必須**
- BBox export: `dataset_<project>_<YYYYMMDD>`
- Seg export: `dataset_<project>_<YYYYMMDD>_seg`
- 分割は `train/val/test` ディレクトリ配下に画像とラベルを出力
- ZIP 指定時は export 完了後に download API へ遷移

## 注意点・既知事項
- `POST /export/dataset/seg` は現行コードで未定義変数参照があり失敗する可能性があります（`backend/app/main.py`）。
- テンプレートは backend 起動時キャッシュのため、テンプレート追加/変更後は backend 再起動が必要です。
- Dataset 取込は「同期型」です。新しく選んだフォルダに存在しない既存画像と対応アノテーションは削除されます。
- アノテーションは編集中に自動保存されます（`/annotations/save`）。
- 認証/認可なし、CORS 全許可のため、ローカル/閉域での運用前提です。

## 関連ドキュメント
- Docs 入口: `docs/README.md`
- 使い方詳細: `docs/usage.md`
- 全体像: `docs/overview.md`
- API: `docs/api.md`
- 運用: `docs/runbook.md`
- データ仕様: `docs/data_spec.md`
- セキュリティ: `docs/security_privacy.md`
- Backend 詳細: `backend/docs/README.md`
- Frontend 詳細: `frontend/docs/README.md`
