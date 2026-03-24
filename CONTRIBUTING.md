# CONTRIBUTING

このプロジェクトへの開発参加ルールです。個人開発リポジトリ前提で、
「最小差分・安全・予測可能」を重視します。

## 1. 基本方針
- 不要な大規模リファクタは避ける
- 仕様変更時は意図を明示する
- 既存挙動を変える場合は、影響範囲を必ず説明する

## 2. セットアップ

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## 3. ブランチ/コミット運用
- 1つの目的に対して1つの変更セットを基本とする
- 無関係な整形を混ぜない
- コミットメッセージは「何を変えたか」が分かる短文にする

例:
- `docs: add usage guide for annotation workflow`
- `backend: fix seg export undefined variable`

## 4. コード変更時の確認項目
- Backend
  - API 入出力が `schemas.py` と整合しているか
  - 既存ファイル保存形式（`data/datasets/*`）を壊していないか
- Frontend
  - `api.ts` の型と backend レスポンスが一致しているか
  - 主要操作（検出、確定、保存、export）が回帰していないか

## 5. PR前チェック（推奨）
- Frontend build:
```bash
cd frontend
npm run build
```

- Backend 起動確認:
```bash
cd backend
source .venv/bin/activate
./run.sh
```

- 目視確認（最低限）
  1. プロジェクト作成
  2. 画像取込
  3. クリック検出と候補確定
  4. 自動アノテーション実行
  5. Dataset export

## 6. ドキュメント更新ルール
以下を変更したら、同じ変更セットで docs を更新してください。
- API 仕様変更: `docs/api.md`, `docs/data_spec.md`
- 操作フロー変更: `docs/usage.md`, `README.md`
- 運用手順変更: `docs/runbook.md`
- セキュリティ前提変更: `docs/security_privacy.md`

ドキュメント入口は `docs/README.md` です。

## 7. セキュリティ・データ取り扱い
- 秘密情報（APIキー、トークン、鍵、個人情報）をコミットしない
- `.env`, `*.pem`, `*.p12`, `id_rsa` 等は扱わない
- サンプル値を使う場合はダミー値を利用する

## 8. 既知事項
- `POST /export/dataset/seg` は既知不具合があります。
- 修正時は必ず `docs/runbook.md` と `docs/api.md` の注意書きも更新してください。
