# config

## 要約（10行以内）
- パスとデフォルト値を集中管理する設定モジュール。
- データ/テンプレ/画像/出力の基準ディレクトリを定義。
- 検出のデフォルトスケール設定を保持。
- SAM の checkpoint と model type を保持。
- 実行環境に依存する絶対パスが含まれる。

## 目的/責務
- 各モジュールが参照するパスと既定値の単一ソース。

## 公開API（関数/クラス）
- `BASE_DIR: Path`
- `DATA_DIR: Path`
- `TEMPLATES_ROOT: Path`
- `IMAGES_DIR: Path`
- `RUNS_DIR: Path`
- `DATASETS_DIR: Path`
- `DEFAULT_SCALE_MIN: float`
- `DEFAULT_SCALE_MAX: float`
- `DEFAULT_SCALE_STEPS: int`
- `DEFAULT_TOPK: int`
- `SAM_CHECKPOINT: str`
- `SAM_MODEL_TYPE: str`

## 入出力/データ
- 入力: なし
- 出力: 定数群

## 依存関係
- 標準ライブラリ: `pathlib.Path`
- 関連: `sam_service` が `SAM_CHECKPOINT` を参照

## 主要ロジック（図や箇条書き）
- `BASE_DIR` を `app/` から2階層上で解決
- `DATA_DIR` 配下に各種ディレクトリを固定

## パラメータ/閾値の意味
- `DEFAULT_SCALE_*`: テンプレマッチのスケール探索デフォルト
- `SAM_CHECKPOINT`: SAM 重みファイルのパス

## テスト観点（最低5つ）
- `DATA_DIR` が `data/` を指す
- `TEMPLATES_ROOT` が `data/templates` を指す
- `DATASETS_DIR` が `data/datasets` を指す
- デフォルト値が UI と整合する
- `SAM_CHECKPOINT` が存在しない場合の挙動

## 変更時の注意（互換性/性能/安全）
- パス変更はデータ互換性に影響
- SAM のパス変更は推論に影響
- 絶対パスは環境依存なので運用で上書き推奨

関連: [sam_service](sam_service.md), [main](main.md)
