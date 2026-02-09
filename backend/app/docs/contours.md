# contours

## 要約（10行以内）
- Template OFF 時の輪郭候補生成を担う。
- クリック点を含む輪郭のみ候補化。
- ROI 内で二値化して輪郭抽出。
- スコアは ROI 面積に対する輪郭面積比。

## 目的/責務
- テンプレなし検出の代替候補を返す。

## 公開API（関数/クラス）
- `find_roi_contours(image_bgr: np.ndarray, x: int, y: int, roi_size: int) -> List[ContourCandidate]`
  - 引数: 画像、クリック座標、ROI サイズ
  - 戻り: `ContourCandidate` のリスト
  - 例外: 明示的な例外なし
- `ContourCandidate`
  - `bbox: (x,y,w,h)`
  - `contour: List[(x,y)]`
  - `score: float`

## 入出力/データ
- 入力: BGR 画像、クリック座標、ROI サイズ
- 出力: ROI 内の輪郭候補

## 依存関係
- `opencv-python`, `numpy`

## 主要ロジック（図や箇条書き）
1. ROI をクリップ
2. ROI を blur + Otsu 2値化
3. 輪郭抽出（外側のみ）
4. クリック点を含む輪郭のみ採用
5. bbox とスコアを算出し降順で返す

## パラメータ/閾値の意味
- Otsu により閾値自動選定
- スコア = contour_area / roi_area

## テスト観点（最低5つ）
- クリック点が輪郭外のとき候補が空
- ROI が画像端でクリップされる
- クリック点が輪郭内のとき bbox が返る
- ROI が極小の場合でも動作
- スコア順にソートされる

## 変更時の注意（互換性/性能/安全）
- 2値化手法変更は候補数に影響
- 輪郭条件変更は UI の挙動に影響

関連: [main](main.md), [filters](filters.md)
