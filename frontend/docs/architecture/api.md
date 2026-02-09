# frontend/src/api.ts

## 要約
- Backend API のクライアント実装。
- 型定義と HTTP 呼び出しを集約。
- 断定できない点は【要確認】で明記。

## 目次
- [目的/責務](#目的責務)
- [公開API](#公開api)
- [入出力データ](#入出力データ)
- [依存](#依存)
- [重要アルゴリズム/落とし穴](#重要アルゴリズム落とし穴)
- [テスト観点](#テスト観点)
- [変更時の注意](#変更時の注意)

## 目的/責務
- API 呼び出しの一元化
- 型定義の提供

## 公開API
- `fetchProjects`, `fetchTemplates`
- `detectPoint`, `segmentCandidate`, `exportDatasetBBox`, `exportDatasetSeg`, `exportYolo`
- `importDataset`, `fetchDataset`, `selectDatasetImage`, `listDatasetProjects`, `createDatasetProject`, `deleteDatasetProject`
- 型: `DetectPointResponse`, `Candidate`, `Annotation`, `DatasetInfo` など

## 入出力データ
- 入力: JSON / FormData
- 出力: JSON

## 依存
- `fetch` API

## 重要アルゴリズム/落とし穴
- `API_BASE` が固定値 `http://127.0.0.1:8000`
- 例外は `throw new Error` で上位に伝播
- `toCandidates` は ID をランダム生成

## テスト観点
- 200/400/500 の挙動
- CORS エラーの確認
- API_BASE の変更で全体が動くか
- JSON パース失敗
- ネットワーク未接続時

## 変更時の注意
- Backend スキーマ変更時は必ず更新
- `API_BASE` を環境変数化する場合は全参照修正
