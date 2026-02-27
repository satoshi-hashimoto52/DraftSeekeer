# backend/app/storage.py

## 役割
画像保存・画像パス解決・データルート参照を提供する軽量 I/O モジュールです。

## 公開API
- `IMAGE_EXTS = {".jpg", ".jpeg", ".png"}`
- `get_runs_dir() -> Path`
- `get_datasets_dir() -> Path`
- `save_upload(image_file, images_dir) -> (image_id, width, height)`
- `resolve_image_path(images_dir, image_id) -> Path`

## 入出力
### `save_upload`
- 入力: FastAPI `UploadFile`, 保存先ディレクトリ
- 出力: 生成された `image_id` と画像サイズ
- 例外: `ValueError`（拡張子不正、空ファイル、壊れた画像）

### `resolve_image_path`
- 入力: images ディレクトリ, image_id
- 出力: 実ファイルパス
- 例外: `FileNotFoundError`

## 重要な仕様
- 保存時ファイル名は `uuid4().hex + 拡張子`
- Pillow で画像として開けない場合は拒否

## 注意点
- 拡張子チェックのみなので、MIME厳密検証はしていません
- 画像ファイル実体の書き込み権限は運用環境依存
