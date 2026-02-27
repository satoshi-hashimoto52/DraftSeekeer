# frontend/src/components/ImageCanvas.tsx

## 役割
Canvas上で画像・候補・確定アノテーションを描画し、編集操作を画像座標へ変換して上位へ通知します。

## 主な責務
- 画像描画、BBox描画、polygon描画
- ズーム/パン/ドラッグ/リサイズ
- クリック座標を画像座標へ変換 (`screenToImage`)
- デバッグオーバーレイ描画
- `panTo()` の imperative API 提供

## 主要 Props（抜粋）
- 描画入力: `imageUrl`, `candidates`, `annotations`, `colorMap`
- 選択状態: `selectedCandidateId`, `selectedAnnotationId`
- 通知: `onClickPoint`, `onSelectAnnotation`, `onCreateManualBBox`, `onResizeSelectedAnnotation`
- デバッグ: `debugOverlay`, `debugOverlayMode`, `showRoiArea` など

## 実装上の注意
- 座標変換ロジック変更は検出位置ズレに直結
- 描画追加時は再描画コストに注意
- interaction mode により cursor 表示が変わる
