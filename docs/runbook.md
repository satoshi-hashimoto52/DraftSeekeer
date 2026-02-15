# Runbook / Troubleshooting

本書は現行コードから仕様を抽出して記載しています。動作確認・実運用での検証は別途必要です。

## 1. 起動できない

### Backend
- 症状: `uvicorn` 起動失敗 / import error
- 確認:
  1. `cd backend`
  2. `.venv` を有効化
  3. `pip install -r requirements.txt`
  4. `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- 典型:
  - `ModuleNotFoundError: cv2` → `opencv-python` 未導入
  - `segment-anything is not installed` → `segment-anything` 未導入

### Frontend
- 症状: `localhost:5173` が開かない
- 確認:
  1. `cd frontend`
  2. `npm install`
  3. `npm run dev`

## 2. CORS エラーが出る
- 表示例: `No 'Access-Control-Allow-Origin' header ...`
- 現行コードは CORS 全許可 (`main.py`) のため、実際は backend 500 をブラウザが CORS 風に見せるケースが多い。
- 対応:
  1. backendログで直前の例外を確認
  2. `http://127.0.0.1:8000/docs` が開くか確認
  3. API URL が `http://127.0.0.1:8000` か確認 (`frontend/src/api.ts`)

## 3. Export先ディレクトリ問題
- `output_dir must be absolute` が返る場合:
  - 絶対パスを指定する
- 書き込み不可の場合:
  - 権限のある場所を指定
- zip ダウンロード不可:
  - `export_id` が `exports_index.json` に存在するか確認

## 4. Mac M1/M2 + SAM が重い
- 現行実装は `torch.backends.mps.is_available()` なら `mps` 使用。
- 対応:
  1. SAM を使わない操作では `segment/candidate` を呼ばない
  2. SAM checkpoint/モデルサイズを見直す
  3. ROIを大きくしすぎない

## 5. UIが重い
- 主因:
  - 高解像度画像 + 多量描画
  - Auto Annotate の低閾値で候補急増
- 対応:
  1. `scale_steps` を下げる
  2. `roi_size` と `stride` を適正化
  3. Debug表示をOFFにする

## 6. template 再読み込み時の注意
- テンプレ変更は backend 起動時 `scan_templates` でキャッシュされる。
- 変更反映手順:
  1. テンプレ画像差し替え
  2. backend再起動
  3. frontend再読み込み

## 7. 既知の実装問題
- `/export/dataset/seg` で未定義変数参照 (`table_rows`, `rel_out`) があり 500 の可能性。
- 対処は `backend/app/main.py` の修正が必要。

## 8. ログ確認ポイント
- Backend: uvicorn コンソールの traceback が一次情報
- Frontend: 開発者ツール Network で API ステータスと response body を確認
