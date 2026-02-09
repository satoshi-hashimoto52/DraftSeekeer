# export_yolo

## 要約（10行以内）
- YOLO/YOLO-seg 向けの正規化と出力行生成。
- bbox と polygon の両方に対応。
- 値は 0-1 にクランプ。

## 目的/責務
- アノテーションを YOLO 形式に変換。

## 公開API（関数/クラス）
- `_clamp01(value: float) -> float`
- `normalize_bbox(bbox: dict, image_w: int, image_h: int) -> (float, float, float, float)`
- `normalize_polygon(poly: Sequence[Sequence[float]], image_w: int, image_h: int) -> List[float]`
- `make_yolo_lines(annotations: Iterable[dict], class_to_id: Dict[str, int], image_w: int, image_h: int) -> List[str]`
  - 例外: 明示的な例外なし

## 入出力/データ
- 入力: annotations, class_to_id, image サイズ
- 出力: YOLO ラベル行

## 依存関係
- 標準ライブラリのみ

## 主要ロジック（図や箇条書き）
1. segPolygon があれば seg 形式を優先
2. bbox 形式は cx, cy, w, h を正規化
3. `repr()` で文字列化

## パラメータ/閾値の意味
- clamp により [0,1] へ収束

## テスト観点（最低5つ）
- bbox 正常系
- segPolygon 正常系
- class_name が未登録
- 画像サイズが 0
- polygon 点数不足

## 変更時の注意（互換性/性能/安全）
- 出力フォーマット変更は学習パイプラインに影響

関連: [main](main.md)
