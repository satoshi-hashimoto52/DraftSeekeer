# Components

## 要約
- `ImageCanvas` が描画・操作の中心。
- `CandidateList` は候補一覧、`Toggles` は簡易UI。

## コンポーネント一覧
- `ImageCanvas.tsx`
  - Canvas 描画、座標変換、操作イベント
- `CandidateList.tsx`
  - 候補一覧の表示
- `Toggles.tsx`
  - チェックボックス UI

## 設計方針
- 描画ロジックは Canvas に集約
- 状態管理は `App.tsx` が保持
- UI コンポーネントはプレゼンテーション中心

## 代表コンポーネント
### ImageCanvas
- 主要責務: 描画/座標変換/操作
- 重要 props: `imageUrl`, `candidates`, `annotations`, `onClickPoint`

### CandidateList
- 主要責務: 候補表示と選択

### Toggles
- 主要責務: label付きチェック
