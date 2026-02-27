# Frontend API Mapping

この文書はフロントエンドから見た API 呼び出し対応表です。詳細仕様は `docs/api.md` を参照してください。

## 代表対応
- 画像選択: `selectDatasetImage` -> `POST /dataset/select`
- クリック検出: `detectPoint` -> `POST /detect/point`
- 自動注釈: `autoAnnotate` -> `POST /annotate/auto`
- 進捗取得: `fetchAutoAnnotateProgress` -> `GET /annotate/auto/progress/{progress_id}`
- ベンチ取得: `fetchBenchmarkRuns` -> `GET /benchmarks/{project_name}`
- 注釈保存: `saveAnnotations` -> `POST /annotations/save`
- Seg: `segmentCandidate` -> `POST /segment/candidate`
- 出力: `exportDatasetBBox`, `exportDatasetSeg`, `exportYolo`

## 注意
- Backend 実装変更時は `frontend/src/api.ts` とこの表を同時更新してください。
