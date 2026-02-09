# Overview

## 要約
- DraftSeeker は図面画像に対してテンプレートマッチで候補BBoxを提示し、手動/セグ編集で確定するアノテーションUIです。
- Backend は FastAPI、Frontend は React + Canvas 描画で構成されます。
- 主要フローは Dataset取込 → 画像選択 → クリック検出(/detect/point) → 候補確定 → 保存(/annotations/save) です。
- テンプレは `data/templates/<project>/<class>/*.png|jpg` を走査し、tight bbox を計算してマッチに使用します。
- Dataset は `data/datasets/<project>/images|annotations|meta.json` を中心に管理されます。
- Seg は SAM をオンデマンドで使い、失敗時は輪郭フォールバックします。
- Export は YOLO 単体、または bbox/seg の dataset 形式を出力できます。
- CORS は現在 `*` 許可です（必要に応じて制限）。
- 仕様はコード抽出ベースであり、未確認箇所は【要確認】で示しています。
- 詳細は [API仕様](api.md) と [データ仕様](data_spec.md) を参照してください。

## 目次
- [プロダクト概要](#プロダクト概要)
- [ユースケース](#ユースケース)
- [主要フロー](#主要フロー)
- [コンポーネント構成](#コンポーネント構成)
- [依存関係](#依存関係)
- [データフロー](#データフロー)
- [設計方針と制約](#設計方針と制約)
- [関連ドキュメント](#関連ドキュメント)

## プロダクト概要
DraftSeeker は図面画像を対象に、クリック点周辺の ROI に対してテンプレートマッチングを行い、候補BBoxを提示するアノテーション支援ツールです。候補の確定・編集、SAM によるセグ補助、YOLO形式のエクスポートに対応します。

## ユースケース
- 建築・設備図面の記号や部材のBBoxアノテーション
- 既存テンプレを使った半自動アノテーション
- bbox/seg の学習用データセット生成

## 主要フロー
1. Dataset プロジェクト作成
2. 画像フォルダをインポート
3. 画像選択
4. クリック検出 `/detect/point`
5. 候補の確定・編集
6. 保存 `/annotations/save`
7. 必要に応じて `/segment/candidate` でセグ生成
8. Export `/export/dataset/bbox|seg` または `/export/yolo`

### 検出フロー（/detect/point）
- クリック点中心の ROI を切り出し
- ROI とテンプレで前処理を統一
- multi-scale で `cv2.matchTemplate` を実行
- tight bbox を基準に最終BBoxを生成
- 確定済みアノテとの重複除外

### 全体検出フロー（/detect/full）
- 画像全体を 1024px タイルで走査
- 各タイルの中心 ROI でテンプレマッチ
- NMS で統合し TopK を返却

### セグフロー（/segment/candidate）
- SAM によるマスク推定
- 失敗時は輪郭ベースのフォールバック

## コンポーネント構成
```
[Frontend (React)]  <--HTTP-->  [Backend (FastAPI)]
        |                                |
        |                                +-- data/templates
        |                                +-- data/datasets
        |                                +-- data/images
        |                                +-- data/runs
        |                                +-- models (SAM)
```

### Frontend 主要責務
- UI 状態管理（候補/確定/Seg/Export）
- Canvas 描画（候補/確定/デバッグ）
- クリック座標の画像座標への変換

### Backend 主要責務
- テンプレ読み込みとキャッシュ
- クリック検出・全体検出
- アノテーション保存/読み込み
- Dataset Export
- SAM 連携

## 依存関係
Backend:
- FastAPI / Uvicorn / Pydantic
- OpenCV / NumPy / Pillow
- Torch / Segment Anything

Frontend:
- React / Vite / TypeScript

## データフロー
- テンプレ: `data/templates/<project>/<class>/*` → 読み込み時に tight bbox を算出
- Dataset: `data/datasets/<project>/images` と `meta.json` で管理
- アノテ: `data/datasets/<project>/annotations/<image>.json`
- 一時画像: `/dataset/select` で `image_id` に変換して API に渡す

## 設計方針と制約
- 回転テンプレは未対応
- スケール範囲はデフォルト `0.5〜1.5`
- テンプレ余白を含めず、線画領域に tight fit
- SAM はオンデマンド使用
- CORS は現在 `*` 許可（運用で制限推奨）

## 関連ドキュメント
- [API仕様](api.md)
- [運用(runbook)](runbook.md)
- [データ/テンプレ仕様](data_spec.md)
- [セキュリティ/プライバシー](security_privacy.md)
- [Backend設計](../backend/app/docs/main.md)
- [Frontend設計](../frontend/docs/architecture/App.md)
