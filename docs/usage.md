# Usage Guide

本書は、現行コード（`frontend/src/App.tsx` / `backend/app/main.py`）に基づく実運用向けの手順書です。

## 1. 起動

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

アクセス先:
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

## 2. 初回セットアップ手順
1. Home でプロジェクトを作成します。
2. 画像フォルダを取り込みます（`jpg/jpeg/png`）。
3. テンプレートプロジェクトを選択します。
4. 左ペインで対象画像を選択します。

### 重要
- 画像取り込みは「同期型」です。
- 新しく指定したフォルダに含まれない既存画像と、その画像の annotation は削除されます。

## 3. 日常のアノテーション作業

### 3.1 検出モード
- Click mode:
  - クリック位置を中心に ROI でテンプレート照合します。
- Hover mode:
  - カーソル移動に合わせて一定間隔で再検出します。

### 3.2 候補を確定/却下
- 候補を確定すると、annotation 一覧へ追加されます。
- 却下すると候補から除外されます。

### 3.3 手動BBox
- `Shift + ドラッグ` で手動 BBox を作成できます。
- 作成後にクラスを選択して確定します。

### 3.4 polygon 補助（SAM）
- 候補選択状態で `S` キー、または UI 操作で segmentation を実行できます。
- SAM が使えない場合は fallback（輪郭ベース）で polygon を生成します。

### 3.5 自動保存
- annotation は編集中に `POST /annotations/save` で保存されます。
- 画像を再選択すると `GET /annotations/load` で復元されます。

## 4. 全自動アノテーション

`Auto Annotate` 実行時に method を選択します。
- `combined`
  - 二値相関統合モード
- `scaled_templates`
  - ROIタイル等倍拡張モード
- `scaled_templates_beta`
  - 全域精密探索モード

実行時の挙動:
- 実行前に既存 annotation を空にする確認ダイアログが表示されます。
- 実行中は progress API（`/annotate/auto/progress/{id}`）をポーリングします。
- 実行結果は benchmarks に履歴保存されます。

## 5. Export

### 5.1 Dataset Export
- 種別:
  - BBox: `POST /export/dataset/bbox`
  - Seg: `POST /export/dataset/seg`
- `output_dir` は絶対パス必須です。
- 分割比（train/val/test）と seed を指定できます。
- ZIP モードでは export 後にダウンロード API に遷移します。

### 5.2 既知の注意
- `POST /export/dataset/seg` は現行実装に未定義変数参照があり、失敗する場合があります。

## 6. ショートカット
- `Enter`: 選択中候補を確定
- `S`: 選択中候補の segmentation
- `← / →`: 候補の前後移動
- `Esc` / `Delete` / `Backspace`: 検出状態クリア
- `Shift + Drag`: 手動BBox作成
- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + Shift + Z` または `Cmd/Ctrl + Y`: Redo
- `Space + Drag` または中クリックドラッグ: パン
- `Ctrl + Wheel`: ズーム
- `Space + Double Click`: パン/ズーム初期化

## 7. 設定の保存
- 一部UI設定は `localStorage` に保存されます。
  - テンプレート選択、色設定、自動アノテ設定、詳細パラメータなど
- 保存先キー例:
  - `draftseeker.templateByDataset`
  - `draftseeker.colorMap.<project>`
  - `draftseeker.advanced.<project>`
  - `draftseeker.auto.<project>`

## 8. 関連
- API詳細: `docs/api.md`
- 運用トラブル対応: `docs/runbook.md`
- データ構造: `docs/data_spec.md`
