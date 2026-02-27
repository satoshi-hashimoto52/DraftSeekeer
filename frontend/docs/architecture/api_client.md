# frontend/src/api.ts

## 役割
- Backend API 呼び出しの単一窓口
- TypeScript のリクエスト/レスポンス型を提供
- `toCandidates()` で detect response を UI候補へ変換

## ベースURL
- `API_BASE = "http://127.0.0.1:8000"`

## 主な関数群

### Project / Dataset
- `fetchProjects`, `fetchTemplates`
- `listDatasetProjects`, `createDatasetProject`, `deleteDatasetProject`
- `importDataset`, `fetchDataset`, `selectDatasetImage`
- `fetchProjectAnnotationStats`

### Detection / Annotation
- `detectPoint`
- `autoAnnotate`, `fetchAutoAnnotateProgress`
- `saveAnnotations`, `loadAnnotations`, `clearProjectAnnotations`

### Benchmark
- `fetchBenchmarkRuns`, `deleteBenchmarkRun`

### Segment / Export
- `segmentCandidate`
- `exportYolo`, `exportYoloWithDir`
- `exportDatasetBBox`, `exportDatasetSeg`
- ダウンロードURLビルダー系（テンプレ画像/overlay）

### App control
- `shutdownApp`

## エラー処理
- `fetch` の `!res.ok` 時に本文テキストを `Error` として throw
- 呼び出し側 (`App.tsx`) で通知・UI反映

## 実装整合メモ
- API詳細の一次ソースは `docs/api.md` と `backend/app/main.py`
- debug field など一部は backend schema よりフロント側型が広い場合があります
