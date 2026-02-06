# Frontend Developer Guide

本書はコードから仕様を抽出して記載しています。
動作確認・実運用テストは別途実施してください。

## 構成

- `src/App.tsx`
  - 画面全体の状態管理
  - Project Home / Annotation 画面の切替
  - 検出 / 確定 / エクスポート操作
- `src/components/ImageCanvas.tsx`
  - 画像描画 / ズーム / パン / クリック
  - 候補 / 確定 / seg の描画
- `src/api.ts`
  - Backend API クライアント
- `src/utils/color.ts`
  - hsl → hex / 正規化
- `src/utils/polygon.ts`
  - seg polygon の簡略化 / clamp

## 画面構成

- ヘッダー: プロジェクト選択 + 画像取り込み（フォルダ選択）
- パラメータバー: ROI / scale / topk / scale steps
- 左ペイン: サムネ一覧
- 中央: Canvas
- 右ペイン: クラス別カラー、操作ボタン、確定アノテ、Seg編集、Export
- Export は右サイドドロワー

## 状態管理（主なもの）

- `candidates` / `selectedCandidateId`
- `annotations` / `selectedAnnotationId`
- `datasetId` / `datasetInfo` / `datasetSelectedName`
- `project`（templates_root のプロジェクト）
- `colorMap`（projectごとに localStorage 永続化）
- `segEditMode` / `segUndoStack` / `segSimplifyEps`
- `showExportDrawer` / `exportResult` / `splitTrain` など

`datasetInfo.images` は `original_filename` / `internal_id` / `import_order` を持つ。

## Canvas 操作

- クリック: `onClickPoint` → /detect/point
- Shift + Drag: 手動 BBox 作成
- Space + Drag / 中クリック: パン
- Ctrl + Wheel: ズーム
- 候補/確定の bbox リサイズ: 角ハンドル
- 確定 bbox の内部ドラッグ: 移動
- 手動候補の辺ドラッグ: 移動（クラス未選択時のみ）

描画ルール:
- 候補: 非選択=破線 / 選択=実線
- 確定: 実線 + 塗り
- 編集中確定: 破線 + 塗り
- ラベル: 左上に表示

## 操作ボタン

- 確定 / 破棄 / 次 / SAM
- ショートカット: Enter / Delete / N / S / Esc

## Export UI

- `Export dataset` ボタン → 右ドロワー表示
- Summary / Export summary は雲がけ（操作不可）
- Split settings は折りたたみ
- エラー/警告を色分け

## API 対応

- `api.ts` に全 API が集約
- detect / segment / export / dataset の順で整理

## 変更時の注意点

- `ImageCanvas.tsx` は描画密度に影響
- pan/zoom は requestAnimationFrame で更新
- ドラッグ中は描画を簡略化（labels/seg非表示）
- state 変更が重い場合は ref + rAF を検討
