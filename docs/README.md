# Docs Index

このディレクトリは、README の補足となる詳細ドキュメントをまとめています。

## 使い分け
- 入口（概要・最短手順）: `README.md`
- 詳細手順・運用: `docs/`

## ドキュメント一覧
- `docs/usage.md`
  - アプリの具体的な使い方（画面操作、ショートカット、実運用フロー）
- `docs/overview.md`
  - システム全体像（構成、データフロー、前提）
- `docs/api.md`
  - FastAPI エンドポイント仕様（主要リクエスト/レスポンス、注意点）
- `docs/runbook.md`
  - 起動/停止/トラブルシュート
- `docs/data_spec.md`
  - データ構造（Dataset、annotations、export成果物）
- `docs/security_privacy.md`
  - セキュリティ・プライバシーの現状と運用上の注意
- `docs/dev_plan.md`
  - 改善候補・中長期の開発課題（現行仕様そのものではない）

## 実装近接ドキュメント
- Backend 実装詳細: `backend/docs/README.md`
- Frontend 実装詳細: `frontend/docs/README.md`

## 更新ポリシー
- API や保存形式を変更したら、同じPRで `docs/api.md` / `docs/data_spec.md` を更新してください。
- 操作フローやUI挙動を変更したら、`docs/usage.md` と `README.md` の該当箇所も更新してください。
