# App.tsx

## 要約
- UI 全体の状態管理とフロー制御。
- Dataset 管理/検出/確定/Seg/Export を統合。
- `ImageCanvas` に描画を委譲。

## 役割
- 状態保持（dataset, candidates, annotations, seg）
- API 呼び出し
- UI 操作の分岐

## 依存
- `src/api.ts`
- `components/ImageCanvas.tsx`
- `utils/color.ts`, `utils/polygon.ts`

## 画面とAPIの対応
| 操作 | Endpoint |
|---|---|
| Dataset 作成 | `POST /dataset/projects` |
| Dataset 取込 | `POST /dataset/import` |
| 画像選択 | `POST /dataset/select` |
| クリック検出 | `POST /detect/point` |
| アノテ保存 | `POST /annotations/save` |
| Seg生成 | `POST /segment/candidate` |
| Export bbox | `POST /export/dataset/bbox` |
| Export seg | `POST /export/dataset/seg` |
| YOLO単体 | `POST /export/yolo` |

API 詳細は [docs/api.md](../../api.md) を参照。
