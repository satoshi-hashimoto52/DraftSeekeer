# Overview

本書はコードから仕様を抽出して記載しています。
動作確認・実運用テストは別途実施してください。

## システム構成

```
[Frontend (React)]  <--HTTP-->  [Backend (FastAPI)]
        |                                |
        |                                +-- data/templates
        |                                +-- data/datasets
        |                                +-- data/images
        |                                +-- models (SAM)
```

## テンプレート構造

- ルート: `data/templates`
- 形式: `templates/<project>/<class>/*.png|jpg`
- class_id は **クラス名昇順**で固定

## 検出モード

### /detect/point
- クリック点の ROI でテンプレ照合
- 流れ:
  1. ROI 切り出し
  2. template matching (multi-scale)
  3. bbox フィルタ（サイズ/面積/score）
  4. クラス別 NMS
  5. クラス代表候補（score最大）
  6. TopK 抽出
  7. 確定済み bbox を除外（center / IoU）
- Template OFF の場合: クリック点を含む輪郭候補を返す

### /detect/full
- 画像全体を 1024x1024 タイルで走査
- 各タイル中央 ROI でテンプレ照合
- 以降は /detect/point と同様に NMS / TopK / 除外

## テンプレマッチの bbox

- テンプレは読み込み時に content bbox を計算
- 余白を除いた template crop で matchTemplate を実行
- bbox は crop サイズ基準で返す

## BBox リファイン

- /detect/point に `refine_contour` がある場合のみ実行
- ROI 周辺を二値化し輪郭から bbox を再計算
- 失敗時は元 bbox を返す

## 確定 bbox の重複除外

- `exclude_confirmed_candidates` を最終候補の直前に適用
- center-in (bbox中心が確定 bbox 内) を優先
- 補助的に IoU 閾値を使用
- `exclude_mode`: same_class / any_class

## SAM セグ生成

- /segment/candidate
  - ROI を expand して SAM 推論
  - click があれば point prompt を追加
  - mask → polygon（approxPolyDP）
- 失敗時はフォールバック輪郭
- device: MPS 優先 → CPU

## アノテーションモデル

- bbox が主体
- seg は必要時のみ付与
- Annotation 保存は `annotations/<image>.json`

## Dataset 内部メタ

- meta.json に `images` を保持\n- 画像エントリは `original_filename` / `internal_id` / `import_order` を保持\n- 並び順は `import_order` のみで決定

## 制約 / 設計意図

- 回転テンプレは未対応
- スケール: 0.5〜1.5（デフォルト）
- 文字/寸法線はテンプレから除外前提
- SAM はオンデマンドのみ

## UI 状態遷移（テキスト）

### アノテーション画面
- 画像未選択
  - サムネ未選択 / image_id なし
- 画像選択中
  - image_id / image_url が設定
- 候補選択中
  - candidates > 0
  - selectedCandidateId が設定
- 確定済み
  - annotations > 0

状態遷移例:
- 画像未選択 -> 画像選択中: サムネクリック
- 画像選択中 -> 候補選択中: 画像クリックで検出
- 候補選択中 -> 確定済み: 確定操作

### Export ドロワー
- 未オープン
- 設定中（drawer open）
- 警告表示
  - 未アノテ含む / split不正 / class 0
- Export 実行完了
  - 成功/失敗メッセージ表示
