# sam_service

## 要約（10行以内）
- SAM predictor のロードとキャッシュを管理。
- 環境変数で checkpoint/model を上書き可能。

## 目的/責務
- SAM 推論の初期化と再利用。

## 公開API（関数/クラス）
- `get_sam_predictor() -> SamPredictor`
  - 例外: segment-anything 未導入 / checkpoint 未設定

## 入出力/データ
- 入力: なし
- 出力: `SamPredictor`

## 依存関係
- `segment_anything`, `torch`
- `config.SAM_CHECKPOINT`, `config.SAM_MODEL_TYPE`
- `sam_device.get_sam_device`

## 主要ロジック（図や箇条書き）
1. キャッシュがあれば返却
2. segment-anything を import
3. checkpoint/model を取得
4. device を決定
5. predictor を生成しキャッシュ

## パラメータ/閾値の意味
- `SAM_CHECKPOINT`: 学習済み重み
- `SAM_MODEL_TYPE`: モデル種別

## テスト観点（最低5つ）
- checkpoint 未設定時の例外
- segment-anything 未導入時の例外
- 環境変数で上書き
- 2回目以降のキャッシュ
- mps/cpu 切替

## 変更時の注意（互換性/性能/安全）
- モデル変更は推論結果に影響
- 巨大モデルはメモリ負荷に注意

関連: [sam_device](sam_device.md), [main](main.md)
