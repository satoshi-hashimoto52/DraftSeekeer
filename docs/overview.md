# DraftSeeker Overview

本書は現行コードから仕様を抽出して記載しています。動作確認・実運用での検証は別途必要です。

## 設計思想
- 実装中心: テンプレート照合を中核にし、手動補正しやすいUIを優先。
- ローカル完結: FastAPI + React をローカルで起動し、データは `data/` 配下で管理。
- モード分離: 全自動は2方式 (`combined`, `scaled_templates`) を持ち、利用者が閾値/探索設定を調整。

## 自動アノテーション2モード

### 1. Template Mode (`scaled_templates`)
- 実装: `backend/app/detection_core.py:272` `annotate_all_manual`
- タイル走査し、`matching.match_templates` のスコアをそのまま `final_score` として採用。
- `final_score >= threshold` を採択。
- `annotate/auto` 側で重複クラスタ統合・既存アノテーション重なり除外を実施。

### 2. SAM assisted / Fusion相当 (`combined`)
- 実装: `backend/app/detection_core.py:113` `annotate_all`
- 画像を2値化し、テンプレとの `cv2.matchTemplate` + match ratio を組み合わせ。
- 現行実装で SAM 推論を直接使うのは `/segment/candidate` であり、`/annotate/auto` の `combined` 自体は template matching ベース。

## 処理フロー（文章図）
1. 画像読込
- `App.tsx` で画像選択し、`/dataset/select` 経由で `image_id` を取得。
2. ROI 決定
- クリック検出: `detect/point` で `clip_roi` によりROI切り出し。
- 全自動: タイル走査 (`_iter_tiles`) でROI相当を反復。
3. Match
- `matching.match_templates` が edge → bin fallback で照合。
4. Scoring
- `scaled_templates`: raw score中心。
- `combined`: match/ratio の合成。
5. NMS / 重複除外
- `detect/full` はクラス別NMS。
- `annotate/auto` は方式に応じてクラスタ重複統合。
6. Annotation 保存
- `annotations/save` または `annotate/auto` で `data/datasets/<project>/annotations/*.json` に保存。

## UI と Backend の責務分離
- UI (`frontend/src/App.tsx`, `frontend/src/components/ImageCanvas.tsx`)
  - 状態管理、ショートカット、描画、ローカル保存、API呼び出し。
- Backend (`backend/app/main.py` + 各ロジックモジュール)
  - テンプレ走査、検出、SAM推論、永続化、エクスポート。

## 現時点で未定義/未検証
- `combined` と「Fusion Mode」名称の1対1対応はUI文言依存で、コード上は `method="combined"` のみが正。
- 全自動の性能・閾値推奨は画像/テンプレ依存が大きく、固定保証は未定義。
