# sam_device

## 要約（10行以内）
- SAM 推論用デバイスを決定。
- MPS が使える場合は mps、それ以外は cpu。

## 目的/責務
- 実行デバイスの選択。

## 公開API（関数/クラス）
- `get_sam_device() -> str`
  - 戻り: "mps" or "cpu"

## 入出力/データ
- 入力: なし
- 出力: デバイス文字列

## 依存関係
- `torch`

## 主要ロジック（図や箇条書き）
1. torch を import
2. `torch.backends.mps.is_available()` を判定
3. 利用可能なら "mps"、それ以外は "cpu"

## パラメータ/閾値の意味
- なし

## テスト観点（最低5つ）
- MPS 環境で mps を返す
- 非MPS環境で cpu を返す
- torch 未導入時に cpu を返す
- 例外発生時の fallback
- 返却文字列の一致

## 変更時の注意（互換性/性能/安全）
- CUDA 対応追加時はこの関数を拡張

関連: [sam_service](sam_service.md)
