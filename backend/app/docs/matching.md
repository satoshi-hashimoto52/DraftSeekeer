# matching

## 要約（10行以内）
- ROI とテンプレのマッチングを行う。
- edge 前処理で失敗した場合は bin へフォールバック。
- tight bbox を基準に最終BBoxを生成。

## 目的/責務
- 検出の中心ロジックを提供。

## 公開API（関数/クラス）
- `match_templates(image_bgr, x, y, roi_size, templates, scale_min, scale_max, scale_steps) -> List[MatchResult]`
- `clip_roi(x, y, roi_size, width, height) -> (x0,y0,x1,y1)`
- `preprocess_edge(gray) -> ndarray`
- `preprocess_binary_inv(gray) -> ndarray`
- `MatchResult` データクラス
  - `class_name`, `template_name`, `score`, `scale`, `bbox`, `outer_bbox`, `tight_bbox`, `mode`

## 入出力/データ
- 入力: BGR 画像、クリック座標、ROI サイズ、テンプレ群
- 出力: MatchResult リスト

## 依存関係
- `opencv-python`, `numpy`
- `templates.TemplateImage`

## 主要ロジック（図や箇条書き）
1. ROI を clip
2. ROI を edge 処理
3. 各テンプレを scale して `matchTemplate`
4. tight bbox を用いて bbox を算出
5. edge 結果が空なら bin で再実行

## パラメータ/閾値の意味
- `scale_steps`: スケール分割数
- `score_threshold` はここでは使用されない（filter 側）

## テスト観点（最低5つ）
- ROI が画像外にある場合
- テンプレが ROI より大きい場合
- edge で候補ゼロ→bin fallback
- tight bbox の座標計算
- scale_steps=1 の挙動

## 変更時の注意（互換性/性能/安全）
- 前処理変更は精度に直結
- scale_steps 増加は性能低下

関連: [templates](templates.md), [filters](filters.md), [nms](nms.md)
