# Frontend Architecture Overview

## 構成
- `main.tsx`: React エントリ
- `App.tsx`: 画面状態・API呼び出し・操作ハンドリング
- `components/ImageCanvas.tsx`: 描画・座標変換・編集操作
- `api.ts`: Backend API 呼び出しと型定義

## 主要画面
- Project Home
- Workbench（画像一覧 + キャンバス + 右ペイン）
- 比較モーダル・Export ドロワー等

## データフロー
1. Dataset一覧/画像をAPIで取得
2. 画像選択後 `image_id` を保持
3. 検出API呼び出しで候補生成
4. 候補確定して annotations を保存
5. 必要時に自動アノテーション・export を実行

## 主要状態（App.tsx）
- Dataset: `datasetId`, `datasetInfo`, `datasetSelectedName`
- Image: `imageId`, `imageUrl`, `imageSize`
- Detect: `candidates`, `selectedCandidateId`, ROI/scale/threshold 系
- Annotation: `annotations`, `selectedAnnotationId`, undo/redo
- Auto/Benchmark: `auto*`, `benchmark*`

## 永続化
`localStorage` / `sessionStorage` に UI 設定や作業状態の一部を保存します。

## 参照
- API: `frontend/docs/architecture/api_client.md`
- Components: `frontend/docs/architecture/components.md`
- ルート仕様: `docs/api.md`
