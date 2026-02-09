# Runbook

## 要約
- Backend は FastAPI、Frontend は Vite/React で起動します。
- Backend のカレントは `DraftSeeker/backend` が前提です。
- Dataset/テンプレは `data/` 配下に保存されます。
- 画像選択は `/dataset/select` を通じて `image_id` を生成します。
- CORS は現在 `*` 許可です。
- SAM は checkpoint と device 設定が必要です。
- エラー時はまず backend ログを確認します。
- 本書は Mac 想定です。
- 未確認は【要確認】として明記します。
- 詳細は [overview](overview.md) と [api](api.md) 参照。

## 目次
- [起動](#起動)
- [設定](#設定)
- [ログ/デバッグ](#ログデバッグ)
- [検証手順](#検証手順)
- [トラブルシュート](#トラブルシュート)
- [よくある障害と切り分け](#よくある障害と切り分け)

## 起動
### Backend
```bash
cd /Users/hashimoto/vscode/_project/DraftSeeker/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

【要確認】venv を使用する場合:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend
```bash
cd /Users/hashimoto/vscode/_project/DraftSeeker/frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## 設定
- `backend/app/config.py`
  - `DATA_DIR` / `TEMPLATES_ROOT` / `DATASETS_DIR`
  - `SAM_CHECKPOINT`, `SAM_MODEL_TYPE`
- 環境変数:
  - `SAM_CHECKPOINT` があればそちらを優先
  - `SAM_MODEL_TYPE` でモデル指定

## ログ/デバッグ
- Backend の標準出力に例外が出ます。
- `/detect/point` の debug 情報は UI に表示可能。
- ROI preview がずれる場合は座標変換を疑う。

## 検証手順
1. `/templates` でテンプレ一覧が返る
2. `/dataset/projects` で dataset 一覧が返る
3. `/dataset/select` で `image_id` が得られる
4. `/detect/point` で候補が返る
5. `/annotations/save` で保存できる
6. `/annotations/load` で読み込める

## トラブルシュート
### CORS
- 症状: ブラウザで CORS エラー
- 原因: `allow_origins` の制限
- 対処: `backend/app/main.py` の CORS 設定を確認

### テンプレが読まれない
- 症状: `/templates` が空
- 原因: `data/templates` パス不一致
- 対処: `data/templates/<project>/<class>/*.png` を確認

### SAM が動かない
- 症状: `/segment/candidate` がエラー
- 原因: checkpoint 不在 or torch / segment-anything 未導入
- 対処: `SAM_CHECKPOINT` を設定して再起動

### /detect/point が 500
- 症状: Pydantic の `int_from_float` エラー
- 原因: `x/y` や `bbox` が float のまま int 型に入る
- 対処: `schemas.py` の型を確認（現行は float）

## よくある障害と切り分け
- UI の描画が重い
  - ROI を小さく、`scale_steps` を下げる
- Export が失敗
  - `output_dir` が絶対パスか確認
- 画像が切り替わらない
  - `/dataset/select` の `project_name` と `filename` を確認
