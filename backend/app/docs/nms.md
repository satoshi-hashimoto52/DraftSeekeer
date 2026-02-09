# nms

## 要約（10行以内）
- IoU 計算と NMS 実装。
- スコア降順で重複抑制。

## 目的/責務
- 重複候補の除外。

## 公開API（関数/クラス）
- `compute_iou(box1, box2) -> float`
- `nms(bboxes: List[BoxLike], scores: List[float], iou_threshold: float) -> List[int]`

## 入出力/データ
- 入力: bbox リスト, score リスト
- 出力: keep インデックス

## 依存関係
- なし

## 主要ロジック（図や箇条書き）
1. score 降順で並べ替え
2. 先頭を採用
3. IoU > threshold の候補を除外

## パラメータ/閾値の意味
- `iou_threshold`: NMS 除外閾値

## テスト観点（最低5つ）
- IoU=1 の完全一致
- IoU=0 の非重複
- w/h が 0 の bbox
- score 同値時の順序
- iou_threshold 境界値

## 変更時の注意（互換性/性能/安全）
- IoU 計算変更は検出結果に直結

関連: [filters](filters.md), [matching](matching.md)
