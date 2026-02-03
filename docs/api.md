# API

## GET /projects

プロジェクト一覧を返します。

レスポンス例:
```json
["project_a", "project_b"]
```

## GET /templates

プロジェクト配下のクラス一覧を返します。

レスポンス例:
```json
[
  {
    "name": "project_a",
    "classes": [
      {"class_name": "図形1", "count": 3},
      {"class_name": "図形2", "count": 1}
    ]
  }
]
```

## POST /image/upload

画像をアップロードして `image_id` と画像サイズを返します。

リクエスト:
- `multipart/form-data`
- `file` に jpg/png

レスポンス例:
```json
{"image_id": "xxxx.jpeg", "width": 2048, "height": 1024}
```

## POST /detect/point

クリック点周辺ROIでテンプレ照合します。

リクエスト例:
```json
{
  "image_id": "xxxx.jpeg",
  "project": "project_a",
  "x": 100,
  "y": 200,
  "roi_size": 200,
  "scale_min": 0.5,
  "scale_max": 1.5,
  "scale_steps": 12,
  "topk": 3
}
```

レスポンス例:
```json
{
  "results": [
    {
      "class_name": "図形1",
      "score": 0.93,
      "bbox": {"x": 80, "y": 150, "w": 64, "h": 64},
      "template_name": "0.jpeg",
      "scale": 1.1
    }
  ]
}
```
