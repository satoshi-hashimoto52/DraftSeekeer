# backend/app/sam_device.py

## 役割
SAM 推論で使うデバイス名を返します。

## API
- `get_sam_device() -> str`

## 仕様
- `torch.backends.mps.is_available()` が真なら `"mps"`
- それ以外は `"cpu"`
- 例外時も `"cpu"` にフォールバック

## 注意
- 現行実装で `cuda` 分岐はありません。
