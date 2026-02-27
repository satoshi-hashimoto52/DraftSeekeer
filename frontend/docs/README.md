# Frontend Docs

Frontend 実装の入口ドキュメントです。現行コードは `frontend/src/App.tsx` を中心に状態管理が集約されています。

## まず読む
- 全体像: `frontend/docs/architecture/overview.md`
- APIクライアント: `frontend/docs/architecture/api_client.md`
- コンポーネント: `frontend/docs/architecture/components.md`
- エントリポイント: `frontend/docs/architecture/main.md`

## コード対応
- アプリ本体: `frontend/src/App.tsx`
- API層: `frontend/src/api.ts`
- 描画: `frontend/src/components/ImageCanvas.tsx`
- 補助UI: `frontend/src/components/CandidateList.tsx`, `Toggles.tsx`, `NumericInputWithButtons.tsx`
- ユーティリティ: `frontend/src/utils/color.ts`, `frontend/src/utils/polygon.ts`

## 運用上の注意
- `API_BASE` は `frontend/src/api.ts` で固定 (`http://127.0.0.1:8000`)。
- `App.tsx` は巨大なため、状態変更の副作用（自動保存・ショートカット）に注意して編集してください。
