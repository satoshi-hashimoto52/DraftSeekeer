# main

## 要約（10行以内）
- FastAPI アプリと全ルーティングを集約。
- Dataset 管理、検出、セグ、Export を提供。
- テンプレキャッシュを起動時にロード。
- ROI 切り出しや debug 画像生成を実装。
- CORS 設定を管理。

## 目的/責務
- API エンドポイント定義と統合フロー実装。

## 公開API（関数/クラス）
- 主要エンドポイント: `/templates`, `/projects`, `/dataset/*`, `/detect/*`, `/segment/candidate`, `/export/*`
- 関数例:
  - `detect_point(payload: DetectPointRequest) -> DetectPointResponse`
  - `detect_full(payload: DetectFullRequest) -> DetectFullResponse`
  - `segment_candidate(payload: SegmentCandidateRequest) -> SegmentCandidateResponse`
- 例外: `HTTPException` を使用

## 入出力/データ
- 入力: JSON, multipart/form-data, query
- 出力: JSON, FileResponse

## 依存関係
- 内部: `config`, `schemas`, `templates`, `matching`, `filters`, `nms`, `contours`, `polygon`, `export_yolo`, `storage`, `sam_service`
- 外部: FastAPI, OpenCV, NumPy, Pillow, torch

## 主要ロジック（図や箇条書き）
- `/detect/point`:
  - ROI 切り出し → match_templates → confirmed 除外 → TopK
  - debug 画像を base64 で返却
- `/detect/full`:
  - タイル分割 → match → NMS → TopK
- `/dataset/import`:
  - 取り込まれなかった画像は削除
- `/segment/candidate`:
  - SAM 実行 → fallback

## パラメータ/閾値の意味
- `roi_size`: ROI の幅/高さ
- `scale_min/max/steps`: スケール探索範囲
- `score_threshold`: matchTemplate スコア閾値
- `iou_threshold`: NMS 用 IoU 閾値
- `exclude_*`: 確定除外条件

## テスト観点（最低5つ）
- invalid image_id で 400 が返る
- invalid project で 400 が返る
- export の output_dir が相対だとエラー
- dataset import の削除ルール
- SAM 失敗時の fallback

## 変更時の注意（互換性/性能/安全）
- ルーティング変更は frontend と docs に影響
- 画像処理変更は精度/速度に直結
- debug 追加はレスポンスサイズ増大

関連: [schemas](schemas.md), [matching](matching.md), [templates](templates.md), [filters](filters.md)
