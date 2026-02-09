# Utils

## 要約
- `utils/color.ts`: 色表現の正規化
- `utils/polygon.ts`: ポリゴン簡略化・clamp

## utils/color.ts
- `isHexColor`, `hslToHex`, `normalizeToHex`
- 色表現の統一

## utils/polygon.ts
- `simplifyPolygon`（RDP 簡略化）
- `clampToImage`（範囲内に丸め）

## 注意点
- 簡略化 epsilon は seg 編集結果に影響
- clamp は round して範囲内へ収める
