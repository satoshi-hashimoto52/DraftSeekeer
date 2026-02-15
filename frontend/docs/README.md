# Frontend Implementation Guide

本書は現行コードから仕様を抽出して記載しています。動作確認・実運用での検証は別途必要です。

対象:
- `frontend/src/App.tsx`
- `frontend/src/components/ImageCanvas.tsx`
- `frontend/src/api.ts`

## UI 全体構造
- エントリ: `frontend/src/main.tsx`
- 主コンテナ: `App.tsx`
  - Project Home
  - Project Workbench（画像一覧 + キャンバス + 右パネル）
- 描画/操作: `components/ImageCanvas.tsx`
- API 呼び出し: `api.ts`

## App.tsx の責務
- 画面状態管理（project/dataset/image/template/settings）
- API I/O と結果反映
- ショートカット管理（確定/次候補/Seg/Undo/Redo/F follow-up）
- localStorage/sessionStorage 永続化
- Export/AutoAnnotate の実行トリガ

## ImageCanvas の責務
- キャンバス描画（画像、候補BBox、確定BBox、polygon、debug overlay）
- ズーム・パン・ドラッグ・リサイズ
- クリック座標を画像座標へ変換して `onClickPoint` へ通知
- 選択中注釈の移動/編集開始・終了通知
- imperative handle: `panTo(x,y)`

## 編集状態の扱い（editing / confirmed）
- confirmed:
  - `annotations` 配列に存在する項目
  - `source` は `template | manual | sam`
- editing:
  - 選択注釈に対し `ImageCanvas` 内部 `editSessionRef` で管理
  - Enter/Escape で編集終了
  - `segEditMode` では頂点編集が優先

## Undo / Redo
- 注釈Undo/Redo:
  - `annotationUndoStack`, `annotationRedoStack`
  - 変更前スナップショットを `cloneAnnotations()` で保存
  - `Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, `Cmd/Ctrl+Y`
- Seg頂点Undo:
  - `segUndoStack` で別管理

## UIのみ変更時のルール（ロジック非破壊）
1. API payload のキー名を変更しない
2. `image_id`, `project_name`, `image_key` の引き回しを壊さない
3. `annotations` 自動保存 `useEffect` の依存関係を変える場合は回帰確認
4. キーボードショートカットは既存動作優先
5. `ImageCanvas` の座標変換 (`screenToImage`) を変更する場合は debug overlay で検証

## 永続化キー（抜粋）
- `draftseeker:viewState:v1`
- `draftseeker:firstBootDone:v1` (session)
- `draftseeker.templateByDataset`
- `draftseeker.importPathByDataset`
- `draftSeeker.exportDirHistory`
- `draftseeker.advanced.<project>`
- `draftseeker.auto.<project>`
- `draftseeker.colorMap.<project>`

## 未実装/未検証
- グローバル状態管理ライブラリは未導入（App.tsx 集中管理）。
- UIのE2Eテストは未整備。
