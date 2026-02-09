# templates

## 要約（10行以内）
- テンプレ画像を走査してキャッシュを生成。
- tight bbox を算出し、前処理画像を保持。
- RGBA の場合は alpha をラインマスクとして扱う。

## 目的/責務
- テンプレ読み込みと構造化。

## 公開API（関数/クラス）
- `scan_templates(templates_root: Path) -> Dict[str, Dict[str, List[TemplateImage]]]`
- `TemplateImage` データクラス

## 入出力/データ
- 入力: テンプレ root
- 出力: project→class→TemplateImage

## 依存関係
- `opencv-python`, `numpy`

## 主要ロジック（図や箇条書き）
1. ディレクトリを走査
2. テンプレ画像をグレースケール化
3. tight bbox を算出
4. edge/bin 画像を生成
5. TemplateImage に格納

## パラメータ/閾値の意味
- `gray < 128` を線画として扱う

## テスト観点（最低5つ）
- templates が存在しない場合
- project/class の階層検出
- RGBA テンプレの alpha 処理
- 真っ白テンプレ
- tight bbox がゼロになる場合

## 変更時の注意（互換性/性能/安全）
- tight bbox 計算変更で bbox がずれる
- テンプレ更新時は backend 再起動が必要

関連: [matching](matching.md), [main](main.md)
