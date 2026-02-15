# Development Plan

本書は現行コードから仕様を抽出して記載しています。動作確認・実運用での検証は別途必要です。

## 現在の設計制約
- `App.tsx` が巨大で、状態・UI・操作ロジックが単一ファイルに集中。
- backend も `main.py` 集約が強く、機能別分割が不十分。
- テンプレは起動時キャッシュで、ホットリロードなし。
- 出力系APIの一部に実装不整合（seg export 500リスク）。

## スケール自動推定の拡張余地
- 現状は `scale_min/max/steps` を固定入力。
- 候補:
  1. テンプレサイズ分布と画像解像度から初期スケール範囲を推定
  2. クリック周辺の線密度から local scale を補正
  3. クラス別に推奨スケール設定を保持

## MPS (Metal Performance Shaders) 利用余地
- 現状利用:
  - SAM 推論時のみ `mps/cpu` 切替 (`sam_device.py`)
- 余地:
  - template matching のGPU化（現状 OpenCV CPU依存）
  - バッチ化したROI推論

## template 数増加時の課題
- スケール×テンプレ×タイルの積で計算量が増大。
- 現状は `prepare_scaled_templates` など前処理はあるが、画像全体探索では依然コストが高い。
- 候補:
  1. クラス/テンプレ事前フィルタ
  2. coarse-to-fine探索
  3. ROI候補生成の前段導入

## 高速化ポイント
- Backend
  - `annotate_all_manual` の stride/roi 設計最適化
  - テンプレ前処理キャッシュのプロジェクト単位保持
  - 並列処理（タイル並列）
- Frontend
  - `App.tsx` 分割（store/hooks/components）
  - 大量アノテ表示時の仮想化

## 近傍の優先タスク
1. `/export/dataset/seg` の未定義変数修正
2. API スキーマと frontend 型の差分解消（debug fields）
3. `App.tsx` を機能単位に分離
4. 自動アノテ結果の評価指標（速度・再現率）を定量化

## 未実装/未検証
- 自動スケール推定は未実装。
- MPS を template matching に使う実装は未着手。
