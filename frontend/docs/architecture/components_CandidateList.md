# frontend/src/components/CandidateList.tsx

## 要約
- 候補BBoxの一覧表示。
- 選択状態のハイライトを行う。

## 目次
- [目的/責務](#目的責務)
- [公開API](#公開api)
- [入出力データ](#入出力データ)
- [依存](#依存)
- [重要アルゴリズム/落とし穴](#重要アルゴリズム落とし穴)
- [テスト観点](#テスト観点)
- [変更時の注意](#変更時の注意)

## 目的/責務
- 候補一覧の UI 表示

## 公開API
Props:
- `candidates`, `selectedCandidateId`, `onSelect`, `colorMap`

## 入出力データ
- 入力: Candidate[]
- 出力: onSelect コールバック

## 依存
- `api.ts` 型

## 重要アルゴリズム/落とし穴
- `key` は `id` と `idx` で構成

## テスト観点
- 候補が 0 件の表示
- 選択状態の背景色
- seg や manual のバッジ表示
- クリックで選択が変わる
- score/scale の表示

## 変更時の注意
- 表示項目の追加は UI レイアウトに影響
