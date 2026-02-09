# Development Plan (AI Coding)

## 実装する前に合意すべき点
- どの機能を「次のスプリントの範囲」にするか（P0/P1/P2の基準）
- API互換性（既存クライアントを壊すかどうか）
- テンプレ/データの運用ルール（`data/` をGit管理しない方針）
- CORS を `*` のままにするか制限するか
- SAM 推論を常時利用するかオンデマンドか

## 目的
- 仕様書とAPI仕様書を基に、安定的に機能追加/改善できる開発計画を整理する。
- UI/Backend の変更範囲とテスト方針を明確化する。

## 変更候補一覧
### 機能
- 候補検出の TopK/重複除外の改善
- Dataset 一覧の情報拡充（画像サイズ・ステータス）
- Export の進捗/エラー表示強化
- Seg 編集の UX 改善（Undo/Redo の見える化）

### 品質
- API レスポンスの型整合性の強化
- デバッグ情報の整理（必要時のみ返す）
- 画像/テンプレ前処理の差分確認用ログ

### 運用
- CORS 制限と環境変数化
- SAM checkpoint の設定方法の統一
- data/ 配下のバックアップ/削除ルール明文化

## 優先度
### P0
- API/Frontend の型不整合を解消
- 重要な例外パスを明示（400/404/422）

### P1
- デバッグ/可視化の整理
- Dataset/テンプレ運用ルールの改善

### P2
- Seg 編集 UX 改善
- Export の詳細ログ追加

## 各タスクの受け入れ条件（Given/When/Then）
### P0-1: API/Frontend 型整合性
- Given: `docs/api.md` のスキーマ定義
- When: `/detect/point` の debug 付きレスポンスを取得
- Then: frontend の型でエラーなく描画できる

### P0-2: エラーハンドリング強化
- Given: 400/404/422 の仕様
- When: 不正入力を送信
- Then: UI がエラー内容を表示する

### P1-1: デバッグ情報の整理
- Given: debug toggle がオン
- When: `/detect/point` を実行
- Then: ROI/テンプレ/マッチ結果が UI に表示される

### P1-2: Dataset/テンプレ運用
- Given: data/templates, data/datasets
- When: import/delete を実行
- Then: meta.json と実ファイルが一致する

### P2-1: Seg UX
- Given: segEditMode
- When: Undo/Redo を操作
- Then: polygon が期待通りに復元される

### P2-2: Export ログ
- Given: export 実行
- When: 出力先が無効
- Then: UI に理由が表示される

## 影響範囲
- Backend: `backend/app/main.py`, `backend/app/schemas.py`, `backend/app/matching.py`
- Frontend: `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/components/ImageCanvas.tsx`
- Docs: `docs/api.md`, `docs/overview.md`, `docs/runbook.md`

## テスト方針
- Unit:
  - `matching.py` の bbox 計算
  - `filters.py` の除外ロジック
  - `export_yolo.py` の正規化
- Integration:
  - `/detect/point` → `/annotations/save` → `/annotations/load`
  - `/dataset/import` → `/dataset/select`
- E2E:
  - UI でクリック検出 → 候補確定 → export までの一連

## ロールバック方針
- Git tag で安定版を保持
- 破壊的変更はブランチ分離
- UI/Backend のバージョンを揃えられない場合は直前版へ戻す

## 【要確認】
- `roi_match_preview_base64` が debug に含まれるが schema 未定義
  - 確認箇所: `backend/app/main.py: detect_point` の debug 生成
  - 対応: schemas.py に追加するかレスポンスから削除
- `exclude_same_class_only` が schemas にあるが main で未使用
  - 確認箇所: `detect_point` / `detect_full`
