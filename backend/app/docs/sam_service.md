# backend/app/sam_service.py

## 役割
SAM predictor を遅延ロードし、プロセス内キャッシュして再利用します。

## API
- `get_sam_predictor() -> SamPredictor`

## 推論初期化フロー
1. 既存 `_predictor` があれば再利用
2. `segment_anything` を import
3. checkpoint/model_type を取得
   - 優先: 環境変数 `SAM_CHECKPOINT`, `SAM_MODEL_TYPE`
   - fallback: `config.py` の定数
4. `sam_device.get_sam_device()` で `mps/cpu` を選択
5. `SamPredictor` を生成しキャッシュ

## 例外
- `segment-anything is not installed`
- `SAM_CHECKPOINT is not set`

## 注意
- checkpoint パス誤りは初回呼び出し時に失敗
- プロセス再起動まで predictor は保持されます
