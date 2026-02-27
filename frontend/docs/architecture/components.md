# Components

## 主要コンポーネント
- `ImageCanvas.tsx`
  - 画像描画、候補/確定BBox描画、編集操作、ズーム/パン
- `CandidateList.tsx`
  - 検出候補一覧の表示と選択
- `Toggles.tsx`
  - シンプルなトグルUI
- `NumericInputWithButtons.tsx`
  - `[- 値 +]` 入力（長押しリピート対応）

## データ受け渡し
- 状態は `App.tsx` が保持
- components は props 経由で描画し、イベントをコールバックで返す

## 参照
- `frontend/docs/architecture/components_ImageCanvas.md`
- `frontend/docs/architecture/components_CandidateList.md`
- `frontend/docs/architecture/components_Toggles.md`
