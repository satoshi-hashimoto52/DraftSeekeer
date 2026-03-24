# Development Plan

本書は「現行仕様」ではなく、現実装を踏まえた改善候補メモです。

## 1. 優先度高
1. `POST /export/dataset/seg` の未定義変数参照を修正
2. Frontend / Backend 間の型差分解消（debug fields 含む）
3. `App.tsx` の責務分割（状態管理・描画・業務ロジック）

## 2. 優先度中
1. 自動アノテーション評価指標の整備（再現率・処理時間）
2. テンプレート変更時の再読み込み体験の改善
3. 大量 annotation 表示時の描画最適化

## 3. 優先度低
1. template matching の計算高速化（coarse-to-fine 等）
2. タイル処理の並列化
3. UI モジュール化とテスト容易性向上

## 4. 技術的制約（現状）
- Frontend
  - `App.tsx` に状態・UI・操作ロジックが集中
- Backend
  - `main.py` 集約が強く、責務分離の余地あり
- テンプレート
  - 起動時キャッシュのため、動的反映なし

## 5. 調査トピック
- MPS 利用拡張（現状は SAM 推論時のみ `mps/cpu` 選択）
- template 数増加時のスケーリング戦略
- 自動スケール推定の実装可能性

## 6. 進め方ガイド
- 仕様変更を伴う場合は `README.md` と `docs/` を同PRで更新
- API変更時は `docs/api.md` と `docs/data_spec.md` を優先更新
- 既知不具合修正は最小差分で先行適用
