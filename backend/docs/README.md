# Backend Developer Guide

本書はコードから仕様を抽出して記載しています。
動作確認・実運用テストは別途実施してください。

## 構成

- `app/main.py`
  - FastAPI ルーティング / アプリ設定 / CORS
  - 検出 / セグ / export / dataset 管理の実処理
- `app/schemas.py`
  - Pydantic request/response
- `app/config.py`
  - パス・デフォルト値・SAM 設定
- `app/templates.py`
  - テンプレスキャン / content bbox 抽出 / crop
- `app/matching.py`
  - template match / NMS前の補助処理
  - `refine_match_bboxes`, `apply_vertical_padding`
- `app/filters.py`
  - bbox フィルタ / confirmed 除外
- `app/nms.py`
  - IoU / NMS
- `app/contours.py`
  - Template OFF 用の輪郭候補生成
- `app/sam_service.py`, `app/sam_device.py`
  - SAM ロード / デバイス判定
- `app/polygon.py`
  - mask → polygon / polygon → bbox
- `app/export_yolo.py`
  - YOLO / YOLO-seg 正規化と出力行
- `app/storage.py`
  - 画像アップロード保存 / path 解決

## Dataset メタ構造

- `data/datasets/<project>/meta.json` に images 配列を保持
- 各 entry は `original_filename` / `internal_id` / `import_order`

## ルーティング追加手順

1. `app/schemas.py` に request/response を追加
2. `app/main.py` に `@app.get/post` で登録
3. 返却値は response_model に合わせる

## 検出ロジックの差し込みポイント

- クリック検出: `detect_point` 内
- 全体検出: `detect_full` 内
- 追加のフィルタ/後処理は
  - `filter_bboxes` 前後
  - NMS 後
  - クラス代表抽出後

## Export の構造

- YOLO 単体: `/export/yolo`
  - `output_dir` 直下に dataset フォルダを作成
  - `classes.txt` / `notes.json` を生成
- Dataset: `/export/dataset/bbox` / `/export/dataset/seg`
  - split / seed で分割
  - output_dir 直下に `dataset_<project>_yyyymmdd`
  - 同名フォルダは上書き

## Logging / デバッグ

- 例外は基本的に `HTTPException` で返す
- SAM 周りは例外時に fallback へ
- path 関連は `Path` で扱う

## 変更が起きやすい箇所

- `app/main.py`: routing / 既存フローの変更
- `app/matching.py`: テンプレ精度に影響
- `app/export_yolo.py`: 出力形式への影響
