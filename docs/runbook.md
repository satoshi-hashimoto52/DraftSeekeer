# Runbook

## 依存インストール

バックエンド:
```bash
cd /Users/hashimoto/vscode/_project/draft_seeker
/Users/hashimoto/vscode/_project/draft_seeker/.venv/bin/pip install -r backend/requirements.txt
```

フロントエンド:
```bash
cd /Users/hashimoto/vscode/_project/draft_seeker/frontend
npm install
```

## 起動

バックエンド:
```bash
cd /Users/hashimoto/vscode/_project/draft_seeker/backend
/Users/hashimoto/vscode/_project/draft_seeker/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

フロントエンド:
```bash
cd /Users/hashimoto/vscode/_project/draft_seeker/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## トラブルシュート

- `Form data requires "python-multipart"` が出たら `python-multipart` をインストール
- `operation not permitted` が出る場合は `127.0.0.1` で起動
