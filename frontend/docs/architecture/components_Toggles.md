# frontend/src/components/Toggles.tsx

## 要約
- チェックボックスの簡易コンポーネント。

## 目次
- [目的/責務](#目的責務)
- [公開API](#公開api)
- [入出力データ](#入出力データ)
- [依存](#依存)
- [重要アルゴリズム/落とし穴](#重要アルゴリズム落とし穴)
- [テスト観点](#テスト観点)
- [変更時の注意](#変更時の注意)

## 目的/責務
- label 付きチェックボックスを提供

## 公開API
Props:
- `label`, `checked`, `onChange`

## 入出力データ
- 入力: boolean
- 出力: onChange

## 依存
- React

## 重要アルゴリズム/落とし穴
- なし

## テスト観点
- checked 切替
- label 表示
- onChange が発火
- disabled 状態【要確認】
- フォーカス移動

## 変更時の注意
- input 属性追加は UI に影響
