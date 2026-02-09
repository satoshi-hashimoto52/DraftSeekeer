# frontend/src/components/ImageCanvas.tsx

## 要約
- Canvas で画像・候補・確定アノテを描画。
- ズーム/パン/ドラッグ/リサイズ/Seg編集を実装。
- クリック座標を画像座標へ変換し `App` に返す。
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
- Canvas 描画
- 入力操作（クリック/ドラッグ/ズーム/パン）
- 画像座標系の統一

## 公開API
Props:
- `imageUrl`, `candidates`, `annotations`, `selectedCandidateId`, `selectedAnnotationId`
- `onClickPoint`, `onCreateManualBBox`, `onResizeSelectedBBox`, `onResizeSelectedAnnotation`
- `onSelectAnnotation`, `onSelectVertex`, `onUpdateEditablePolygon`
- `debugOverlay`, `onDebugCoords`

Imperative Handle:
- `panTo(x, y)`

## 入出力データ
- 入力: 画像URLと候補/確定データ
- 出力: 操作イベントをコールバックで返却

## 依存
- React
- `api.ts` の型

## 重要アルゴリズム/落とし穴
- `screenToImage` で CSS 座標から画像座標へ変換
- `ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom, dpr*panX, dpr*panY)` の前提で描画
- デバッグ用クロスヘアは2系統
- Shift+Drag で手動BBox作成
- Space+Drag または中クリックでパン

## テスト観点
- ズーム/パン後のクリック座標が一致する
- 候補BBoxの描画が選択状態で変わる
- 手動BBox作成が期待通りに動く
- Seg 頂点ドラッグが正しく反映される
- Space+ダブルクリックでリセットされる

## 変更時の注意
- 座標変換を変更すると検出がズレる
- 描画パフォーマンスに注意
- props 変更は App 側に影響
