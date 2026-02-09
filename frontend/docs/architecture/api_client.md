# API Client (src/api.ts)

## 要約
- すべての API 呼び出しを `api.ts` に集約。
- 型定義と変換（`toCandidates`）を提供。
- API 詳細は [docs/api.md](../../api.md) と一致させる。

## API 呼び出し一覧
| 関数 | Endpoint | 目的 |
|---|---|---|
| `fetchProjects` | `GET /projects` | テンプレプロジェクト取得 |
| `fetchTemplates` | `GET /templates` | テンプレ一覧 |
| `listDatasetProjects` | `GET /dataset/projects` | Dataset 一覧 |
| `createDatasetProject` | `POST /dataset/projects` | Dataset 作成 |
| `deleteDatasetProject` | `DELETE /dataset/projects/{project}` | Dataset 削除 |
| `importDataset` | `POST /dataset/import` | Dataset 取り込み |
| `fetchDataset` | `GET /dataset/{project}` | Dataset 詳細 |
| `selectDatasetImage` | `POST /dataset/select` | Dataset 画像選択 |
| `detectPoint` | `POST /detect/point` | クリック検出 |
| `segmentCandidate` | `POST /segment/candidate` | Seg 生成 |
| `saveAnnotations` | `POST /annotations/save` | アノテ保存 |
| `loadAnnotations` | `GET /annotations/load` | アノテ取得 |
| `exportDatasetBBox` | `POST /export/dataset/bbox` | bbox 出力 |
| `exportDatasetSeg` | `POST /export/dataset/seg` | seg 出力 |
| `exportYolo` | `POST /export/yolo` | YOLO 単体 |

## 型定義
- `DetectPointResponse`, `DetectResult`, `Candidate`, `Annotation`
- `DatasetInfo`, `DatasetImageEntry`
- `SegmentCandidateRequest/Response`

## 注意点
- `API_BASE` は固定値 `http://127.0.0.1:8000`。
- エラーは `throw new Error` で上位に伝播。
- `toCandidates` はランダムID生成。

## 参照
- API 詳細: [docs/api.md](../../api.md)
