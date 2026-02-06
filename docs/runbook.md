# Runbook

本書はコードから仕様を抽出して記載しています。
動作確認・実運用テストは別途実施してください。

## 起動

Backend:
```bash
cd /Users/hashimoto/vscode/_project/draft_seeker/backend
/Users/hashimoto/vscode/_project/draft_seeker/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:
```bash
cd /Users/hashimoto/vscode/_project/draft_seeker/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## 依存関係

Backend (`backend/requirements.txt`):
- fastapi / uvicorn / pydantic
- opencv-python / numpy / pillow
- torch / torchvision / segment-anything

SAM チェックポイント:
- `backend/app/config.py` の `SAM_CHECKPOINT`
- または環境変数 `SAM_CHECKPOINT`

## データ保存

- `data/datasets/<project_name>/images/`: 取り込み画像
- `data/datasets/<project_name>/annotations/`: アノテ JSON
- `data/datasets/<project_name>/meta.json`: 画像順序
- `data/images/`: アノテ選択時にコピーされた `image_id`
- `data/runs/`: 旧出力用

掃除:
- プロジェクト削除は `data/datasets/<project_name>/` を削除
- `data/images/` は作業用なので適宜削除可

## Dataset 取り込みルール

- 同名ファイルは上書き
- 取り込み対象に存在しない画像は削除
- 既存順序を保ち、新規ファイルは末尾追加

## Export

- 出力先は **絶対パスのみ** 許可
- 同名フォルダが存在する場合は上書き（削除して再作成）
- bbox dataset の label は小数点6桁固定
- YOLO 1画像出力は `repr()` で出力（桁数は制限なし）

## よくあるエラーと対処

### CORS エラー
- 原因: 127.0.0.1 / localhost の不一致
- 対処: `backend/app/main.py` の `allow_origins` に両方を入れる

### export 保存先が想定外
- 原因: `output_dir` が相対パスだと弾かれる
- 対処: 絶対パスのみ許可されるため、UIで絶対パスを指定

### M1/M2 で SAM が重い / 遅い
- 原因: MPS が無効、または CPU fallback
- 対処: `torch.backends.mps.is_available()` を確認
- 代替: SAM をオンデマンドのみにする

### UI が重くなる
- 原因: 大画像 + 多候補描画
- 対処:
  - ROI を小さくする
  - scale_steps を下げる
  - TopK を小さくする
  - Canvas の描画負荷を下げる（ドラッグ中簡略化）

## パフォーマンス観点

- ROI が大きいほどテンプレ照合コストが増える
- scale_steps を上げるほど検出が重くなる
- detect/full はタイル数に比例して重い

## 変更点が起きやすい場所

- `backend/app/main.py`: ルーティング / 検出フロー / export
- `backend/app/matching.py`: テンプレ精度に影響
- `frontend/src/App.tsx`: UI 状態 / 画面レイアウト
- `frontend/src/components/ImageCanvas.tsx`: 描画・操作

## TODO (改善候補)

- 写真系の前処理パイプライン追加
- OCR / 注記除外の自動化
- /export/yolo/download のパス整合
- Dataset import の差分表示
