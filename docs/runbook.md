# Runbook / Troubleshooting

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
- Frontend: `Ctrl+C`
- Backend: `Ctrl+C`
- UI から停止: `POST /app/shutdown`（`/shutdown` 互換）

## 3. 運用時の確認ポイント
- Backend 到達性: `http://127.0.0.1:8000/docs`
- Frontend API先: `frontend/src/api.ts` の `API_BASE`
- テンプレート反映: Backend 再起動後に確認

## 4. 典型トラブル

### CORSエラー表示
- 症状: ブラウザが CORS エラーを表示
- 実態: Backend 500 のことが多い
- 対応:
  1. Backend traceback を確認
  2. 同APIを curl で直接叩く

### SAM関連エラー
- `segment-anything is not installed`
- `SAM_CHECKPOINT is not set`
- 対応: 依存導入と環境変数の確認

### Export失敗
- `output_dir must be absolute`
- 書き込み権限なし
- `export_id` 不一致でダウンロード不可

### Dataset不整合
- import後に画像が消える
  - 現仕様: 新規取込集合に含まれない既存画像は削除される
- annotations が空になる
  - 対象画像の `annotations/<image>.json` の有無を確認

## 5. ログ
- Backend: `uvicorn` 標準出力（一次情報）
- Frontend: DevTools の Network / Console

## 6. セキュリティ運用メモ
- 認証なしAPIのため、公開ネットワーク運用は推奨しません。
- CORS 全許可のため、ローカル/閉域で運用してください。

## 7. 既知不具合（現行コード）
- `POST /export/dataset/seg` は未定義変数参照のため失敗する可能性があります。
  - 該当: `backend/app/main.py` の `export_dataset_seg`
