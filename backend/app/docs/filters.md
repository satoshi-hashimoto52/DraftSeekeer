# filters

## 要約（10行以内）
- 検出候補のサイズ/スコアでフィルタリング。
- 確定BBoxとの重複除外を実施。
- 中心判定・IoU 判定・部分重なり判定をサポート。

## 目的/責務
- 検出候補からノイズを削除。
- 確定済みアノテーションを重複排除。

## 公開API（関数/クラス）
- `filter_bboxes(bboxes: Iterable[object], roi_size: int, score_threshold: float) -> List[object]`
  - 引数: bbox+score 形式の配列
  - 戻り: フィルタ済み配列
  - 例外: 不正 bbox 形式で ValueError
- `exclude_confirmed_candidates(candidates: List[object], confirmed: List[dict], exclude_mode: str = "same_class", center_check: bool = True, iou_threshold: float = 0.6, any_overlap: bool = False) -> List[object]`
  - 引数: 候補, 確定アノテ
  - 戻り: 除外後の候補

## 入出力/データ
- 入力: bbox (x,y,w,h) と score
- 出力: フィルタ済み候補

## 依存関係
- `nms.compute_iou`

## 主要ロジック（図や箇条書き）
- `min_size = roi_size * 0.05`
- `max_area = roi_size^2 * 0.8`
- score 閾値未満を除外
- confirmed は中心/IoU/重なりで除外
- 全除外時は IoU を無効化して再評価

## パラメータ/閾値の意味
- `min_size`: ROI に対する最小サイズ
- `max_area`: ROI に対する最大面積
- `iou_threshold`: IoU 除外閾値
- `any_overlap`: 部分重なりで除外

## テスト観点（最低5つ）
- 小さすぎる bbox の除外
- 大きすぎる bbox の除外
- score 閾値の動作
- any_overlap の除外
- same_class/any_class の挙動

## 変更時の注意（互換性/性能/安全）
- 閾値変更で候補数と精度が変化
- exclude の判定変更は UI 体験に直結

関連: [nms](nms.md), [main](main.md)
