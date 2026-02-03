import React, { useEffect, useRef } from "react";

type BBox = { x: number; y: number; w: number; h: number } | null;

type Props = {
  imageUrl: string | null;
  bbox: BBox;
  bboxColor: string;
  onClickPoint: (x: number, y: number) => void;
};

export default function ImageCanvas({ imageUrl, bbox, bboxColor, onClickPoint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (bbox) {
        ctx.strokeStyle = bboxColor;
        ctx.lineWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * 0.003));
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
      }
    };
    img.src = imageUrl;
  }, [imageUrl, bbox]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);
    onClickPoint(x, y);
  };

  return (
    <div style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        onClick={imageUrl ? handleClick : undefined}
        style={{
          width: "100%",
          border: "1px solid #ddd",
          background: "#fafafa",
          cursor: imageUrl ? "crosshair" : "default",
        }}
      />
      {!imageUrl && (
        <div style={{ padding: "12px 0", color: "#666" }}>画像をアップロードしてください。</div>
      )}
    </div>
  );
}
