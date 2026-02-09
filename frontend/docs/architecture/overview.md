# Frontend Architecture Overview

## 要約
- UI は `App.tsx` が全状態を保持し、`ImageCanvas` に描画/操作を委譲する。
- API 呼び出しは `src/api.ts` に集約。
- Canvas 操作は「画面座標→画像座標」変換を経由する。
- Dataset 管理、検出、確定、Seg 編集、Export が主要フロー。

## 画面構成
- 左ペイン: Dataset 一覧/サムネ
- 中央: 画像キャンバス（候補/確定/Seg）
- 右ペイン: パラメータ・候補・確定・Seg・Export
- ヘッダ: Project/テンプレ/取り込み

## 主要状態
- dataset: `datasetId`, `datasetInfo`, `datasetSelectedName`
- image: `imageUrl`, `imageId`, `imageSize`
- detect: `candidates`, `selectedCandidateId`, `roiSize`, `scaleMin/Max/Steps`
- annotations: `annotations`, `selectedAnnotationId`, `segEditMode`
- ui: `showCandidates`, `showAnnotations`, `showDebug`, `showExportDrawer`

## 主要フロー
- 取り込み: dataset 作成 → import → 選択
- 検出: click → `/detect/point` → 候補表示
- 確定: 候補確定 → `/annotations/save`
- Seg: `/segment/candidate` → polygon 編集
- Export: `/export/dataset/*` or `/export/yolo`

## 責務分離
- `App.tsx`: 状態管理/フロー制御/データ結合
- `ImageCanvas.tsx`: 描画/操作/座標変換
- `api.ts`: API 呼び出し/型
- `utils/*`: 色・ポリゴン処理

## 画面操作とAPI対応
| 操作 | Endpoint | 備考 |
|---|---|---|
| Dataset一覧取得 | `GET /dataset/projects` | 初期ロード/更新 |
| Dataset作成 | `POST /dataset/projects` | 新規作成 |
| Dataset削除 | `DELETE /dataset/projects/{project}` | 破壊的 |
| Dataset画像取込 | `POST /dataset/import` | フォルダ取り込み |
| Dataset画像選択 | `POST /dataset/select` | `image_id` 取得 |
| クリック検出 | `POST /detect/point` | ROI検出 |
| 全体検出 | `POST /detect/full` | タイル検出 |
| アノテ保存 | `POST /annotations/save` | 確定保存 |
| アノテ読込 | `GET /annotations/load` | 画像切替時 |
| Seg生成 | `POST /segment/candidate` | SAM/フォールバック |
| Export bbox | `POST /export/dataset/bbox` | dataset 出力 |
| Export seg | `POST /export/dataset/seg` | dataset 出力 |
| YOLO単体 | `POST /export/yolo` | 1画像出力 |

API 詳細は [docs/api.md](../../api.md) を参照。
