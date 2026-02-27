# backend/app/templates.py

## 役割
テンプレート画像をスキャンして `TemplateImage` 構造に変換し、検出で使う前処理画像を準備します。

## テンプレ探索構造
- 推奨: `data/templates/<project>/<class>/<template_image>`
- 互換: `data/templates/<class>/<template_image>`（project=`default`）

## 公開API
- `scan_templates(templates_root) -> Dict[project][class] = List[TemplateImage]`
- `TemplateImage`:
  - `project`, `class_name`, `template_name`, `path`
  - `image_gray`
  - `tight_bbox`, `outer_bbox`
  - `image_proc_edge`, `image_proc_bin`

## 前処理
- `gray < 128` を線画として `tight_bbox` を算出
- `edge`: GaussianBlur + Canny + Dilate
- `bin`: GaussianBlur + Otsu + Binary INV

## RGBA テンプレ
- alpha チャンネルがある場合、透明領域をトリミング
- RGB が全黒で alpha が有効な場合、`255 - alpha` をグレースケールとして採用

## 注意点
- 真っ白テンプレ等で tight bbox が取れない場合は outer bbox にフォールバック
- テンプレート更新反映には backend 再起動が必要（起動時スキャン）
