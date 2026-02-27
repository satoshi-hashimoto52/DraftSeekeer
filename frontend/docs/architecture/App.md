# frontend/src/App.tsx

## 役割
アプリ全体のオーケストレーションを担います。
- 画面状態管理
- API呼び出し
- キーボード操作
- Undo/Redo
- 自動保存
- ベンチマーク比較UI

## 主な責務
- Dataset 管理（作成・削除・取込・選択）
- 検出（クリック/ホバー/全自動）
- 候補確定と annotation 保存
- Export 実行とダウンロード導線
- デバッグ表示の制御

## 変更時の注意
- 依存する state が多いため、`useEffect` 依存配列の変更は副作用確認が必須
- ショートカット変更時は `ImageCanvas` 側操作と競合しないか確認
- API payload キーは backend schema に合わせる

## 参照
- `frontend/src/api.ts`
- `frontend/src/components/ImageCanvas.tsx`
