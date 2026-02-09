# polygon

## 要約（10行以内）
- マスクからポリゴンを生成。
- ポリゴンから bbox を算出。

## 目的/責務
- Seg の補助計算。

## 公開API（関数/クラス）
- `mask_to_polygon(mask: np.ndarray, eps: float) -> List[List[int]]`
- `polygon_to_bbox(poly: List[List[int]]) -> dict`

## 入出力/データ
- 入力: mask (uint8)
- 出力: polygon / bbox

## 依存関係
- `opencv-python`, `numpy`

## 主要ロジック（図や箇条書き）
1. mask を uint8 化
2. `findContours` で最大輪郭
3. `approxPolyDP` で簡略化
4. bbox は min/max で算出

## パラメータ/閾値の意味
- `eps`: 簡略化係数

## テスト観点（最低5つ）
- mask が空
- mask が 0/1
- eps が 0
- 2点以下の polygon
- bbox min/max

## 変更時の注意（互換性/性能/安全）
- eps 変更は seg 形状に影響

関連: [main](main.md), [sam_service](sam_service.md)
