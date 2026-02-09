# storage

## 要約（10行以内）
- 画像アップロードの保存とパス解決を提供。
- 画像サイズを抽出して返す。

## 目的/責務
- 画像ファイル保存とパス検証。

## 公開API（関数/クラス）
- `save_upload(image_file: UploadFile, images_dir: Path) -> (image_id, width, height)`
  - 例外: ValueError（不正拡張子/空ファイル/壊れた画像）
- `resolve_image_path(images_dir: Path, image_id: str) -> Path`
  - 例外: FileNotFoundError
- `IMAGE_EXTS: Set[str]`

## 入出力/データ
- 入力: UploadFile, 保存先ディレクトリ
- 出力: (image_id, width, height)

## 依存関係
- `Pillow`

## 主要ロジック（図や箇条書き）
1. 拡張子を検証
2. 画像を読み込みサイズ取得
3. UUID を付与して保存

## パラメータ/閾値の意味
- `IMAGE_EXTS`: 許可拡張子

## テスト観点（最低5つ）
- png/jpeg の正常系
- 不正拡張子
- 空ファイル
- 破損画像
- resolve_image_path の存在チェック

## 変更時の注意（互換性/性能/安全）
- image_id 形式変更は API 互換性に影響

関連: [main](main.md)
