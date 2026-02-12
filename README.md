# DraftSeeker

本書はコードから仕様を抽出して記載しています。
動作確認・実運用テストは別途実施してください。

CAD 図面画像のアノテーション支援ツールです。テンプレート照合で候補を出し、必要時のみ SAM で seg を生成し、YOLO / dataset 形式で出力します。

## 5分で起動（macOS / ローカル）

Backend:
```bash
cd /Users/hashimoto/vscode/_project/DraftSeeker/backend
/Users/hashimoto/vscode/_project/draft_seeker/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:
```bash
cd /Users/hashimoto/vscode/_project/DraftSeeker/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

アクセス:
- http://127.0.0.1:5173/

## 主要ドキュメント

- `docs/overview.md` : 全体構成 / 検出設計
- `docs/api.md` : API 仕様（実装準拠）
- `docs/runbook.md` : 運用・トラブル
- `backend/docs/README.md` : バックエンド開発者向け
- `frontend/docs/README.md` : フロント開発者向け
