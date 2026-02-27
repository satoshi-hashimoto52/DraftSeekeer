# frontend/src/components/CandidateList.tsx

## 役割
検出候補（TopK）のリスト表示と選択切替を行います。

## Props
- `candidates: Candidate[]`
- `selectedCandidateId: string | null`
- `onSelect(id: string)`
- `colorMap: Record<string, string>`

## 表示内容
- クラス名、score、template名、scale、bbox
- `source===manual` の MANUAL バッジ
- `segPolygon` がある場合の SEG バッジ

## 注意点
- key は `id + index`
- 候補0件時は「候補はまだありません」を表示
