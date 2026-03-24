# Runbook / Troubleshooting

運用時に必要な起動・停止・確認・障害切り分け手順をまとめます。

## 1. 起動

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## 2. 停止
- Terminal 実行中:
  - Frontend: `Ctrl+C`
  - Backend: `Ctrl+C`
- UI から停止:
  - `POST /app/shutdown`（`/shutdown` 互換）

## 3. ヘルスチェック
- Backend 到達性:
  - `http://127.0.0.1:8000/docs`
- Frontend 到達性:
  - `http://127.0.0.1:5173`
- API接続先確認:
  - `frontend/src/api.ts` の `API_BASE`

## 4. 日常運用チェックリスト
1. テンプレート更新後に backend を再起動したか
2. 取込フォルダが正しいか（同期取込で削除が発生する）
3. Export 先が絶対パスか
4. 自動アノテ結果が benchmarks に保存されているか

## 5. 典型トラブルと対処

### 5.1 CORS エラーに見える
- 症状: ブラウザで CORS エラー表示
- 実態: Backend 500 の場合が多い
- 対処:
  1. Backend コンソールの traceback を確認
  2. 同APIを `curl` で直接叩いて再現確認

### 5.2 SAM 関連エラー
- 代表例:
  - `segment-anything is not installed`
  - `SAM_CHECKPOINT is not set`
- 対処:
  - `backend/requirements.txt` の依存導入
  - `SAM_CHECKPOINT` / `SAM_MODEL_TYPE` 環境変数確認

### 5.3 Export 失敗
- 代表例:
  - `output_dir must be absolute`
  - 書き込み権限エラー
  - `export_id` 不一致
- 対処:
  1. 絶対パス指定
  2. 出力先の権限確認
  3. 対象 project の `exports_index.json` を確認

### 5.4 Dataset の不整合
- 症状: import 後に既存画像が消える
- 原因: 同期取込仕様（新規集合外は削除）
- 対処: 取り込み対象フォルダを再確認

- 症状: annotation が空になる
- 対処:
  1. `data/datasets/<project>/annotations/<image>.json` の有無確認
  2. `annotations/load` レスポンス確認

## 6. ログ
- Backend: `uvicorn` 標準出力（一次情報）
- Frontend: DevTools の Network / Console

## 7. 既知不具合（現行コード）
- `POST /export/dataset/seg` は未定義変数参照のため失敗する可能性があります。
  - 該当: `backend/app/main.py` の `export_dataset_seg`

## 8. 関連
- 利用手順: `docs/usage.md`
- API仕様: `docs/api.md`
