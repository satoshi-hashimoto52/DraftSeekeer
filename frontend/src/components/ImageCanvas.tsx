import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Annotation, Candidate } from "../api";

type Props = {
  imageUrl: string | null;
  candidates: Candidate[];
  selectedCandidateId: string | null;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  colorMap: Record<string, string>;
  showCandidates: boolean;
  showAnnotations: boolean;
  editablePolygon: { x: number; y: number }[] | null;
  editMode: boolean;
  showVertices: boolean;
  selectedVertexIndex: number | null;
  highlightAnnotationId: string | null;
  onSelectVertex: (index: number | null) => void;
  onUpdateEditablePolygon: (next: { x: number; y: number }[]) => void;
  onVertexDragStart: () => void;
  onClickPoint: (x: number, y: number) => void;
  onCreateManualBBox: (bbox: { x: number; y: number; w: number; h: number }) => void;
  onManualCreateStateChange: (active: boolean) => void;
  onResizeSelectedBBox: (bbox: { x: number; y: number; w: number; h: number }) => void;
  onResizeSelectedAnnotation: (bbox: { x: number; y: number; w: number; h: number }) => void;
  onSelectAnnotation: (annotation: Annotation) => void;
  shouldIgnoreCanvasClick?: () => boolean;
  onAnnotationEditStart?: () => void;
  onAnnotationEditEnd?: () => void;
  pendingManualBBox?: { x: number; y: number; w: number; h: number } | null;
  onDebugCoords?: (info: {
    screen: { x: number; y: number };
    image: { x: number; y: number };
    zoom: number;
    pan: { x: number; y: number };
    dpr: number;
    cssScale?: { sx: number; sy: number };
  }) => void;
  debugOverlay?: {
    clicked_image_xy?: { x: number; y: number };
    roi_bbox?: { x1: number; y1: number; x2: number; y2: number };
    outer_bbox?: { x: number; y: number; w: number; h: number };
    tight_bbox?: { x: number; y: number; w: number; h: number };
  } | null;
};

export type ImageCanvasHandle = {
  panTo: (x: number, y: number) => void;
};

export default forwardRef<ImageCanvasHandle, Props>(function ImageCanvas(
  {
    imageUrl,
    candidates,
    selectedCandidateId,
    annotations,
    selectedAnnotationId,
    colorMap,
  showCandidates,
  showAnnotations,
  editablePolygon,
  editMode,
  showVertices,
  selectedVertexIndex,
  highlightAnnotationId,
  onSelectVertex,
  onUpdateEditablePolygon,
  onVertexDragStart,
  onClickPoint,
  onCreateManualBBox,
  onManualCreateStateChange,
  onResizeSelectedBBox,
  onResizeSelectedAnnotation,
  onSelectAnnotation,
  shouldIgnoreCanvasClick,
  onAnnotationEditStart,
  onAnnotationEditEnd,
  pendingManualBBox,
  onDebugCoords,
  debugOverlay,
}: Props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const scaleRef = useRef<number>(1);
  const [scale, setScale] = useState<number>(1);
  const pendingScaleRef = useRef<number | null>(null);
  const panZoomRafRef = useRef<number | null>(null);
  const dragRef = useRef<{ active: boolean; vertexIndex: number | null }>({
    active: false,
    vertexIndex: null,
  });
  const clickTrackRef = useRef<{ active: boolean; start: { x: number; y: number } | null; moved: boolean }>({
    active: false,
    start: null,
    moved: false,
  });
  const spaceDoubleClickRef = useRef<number | null>(null);
  const manualDragRef = useRef<{
    active: boolean;
    start: { x: number; y: number } | null;
    current: { x: number; y: number } | null;
  }>({ active: false, start: null, current: null });
  const suppressNextClickRef = useRef<boolean>(false);
  const [cursorStyle, setCursorStyle] = useState<string>("default");
  const resizeDragRef = useRef<{
    active: boolean;
    handle: "tl" | "tr" | "bl" | "br" | null;
    origin: { x: number; y: number; w: number; h: number } | null;
    target: "candidate" | "annotation" | null;
  }>({ active: false, handle: null, origin: null, target: null });
  const panDragRef = useRef<{
    active: boolean;
    start: { x: number; y: number } | null;
    origin: { x: number; y: number } | null;
  }>({ active: false, start: null, origin: null });
  const spacePressedRef = useRef<boolean>(false);
  const draggingRef = useRef<boolean>(false);
  const moveDragRef = useRef<{
    active: boolean;
    origin: { x: number; y: number; w: number; h: number } | null;
    start: { x: number; y: number } | null;
    target: "candidate" | "annotation" | null;
  }>({ active: false, origin: null, start: null, target: null });
  const [blinkActive, setBlinkActive] = useState(false);
  const [blinkTick, setBlinkTick] = useState(0);
  const [manualPreview, setManualPreview] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const [debugPoints, setDebugPoints] = useState<{
    screen: { x: number; y: number };
    image: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressedRef.current = true;
        if (event.target instanceof HTMLElement) {
          const tag = event.target.tagName.toLowerCase();
          if (tag !== "input" && tag !== "textarea" && tag !== "select") {
            event.preventDefault();
          }
        }
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressedRef.current = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    panRef.current = { x: 0, y: 0 };
    setPanOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    setScale(1);
  }, [imageUrl]);

  useEffect(() => {
    if (!blinkActive) return;
    let raf = 0;
    const loop = () => {
      setBlinkTick((t) => (t + 1) % 1000000);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [blinkActive]);

  const getDpr = () => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const getCssScale = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return { sx: 1, sy: 1 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { sx: 1, sy: 1 };
    return { sx: rect.width / img.width, sy: rect.height / img.height };
  };

  useImperativeHandle(ref, () => ({
    panTo: (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = imgRef.current;
      if (!img) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const { sx, sy } = getCssScale();
      const panX = rect.width / (2 * sx * scaleRef.current) - x;
      const panY = rect.height / (2 * sy * scaleRef.current) - y;
      panRef.current = { x: panX, y: panY };
      setPanOffset({ x: panX, y: panY });
    },
  }));

  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = getDpr();
      canvas.width = Math.max(1, Math.round(img.width * dpr));
      canvas.height = Math.max(1, Math.round(img.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#d0d0d0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(
        dpr * scale,
        0,
        0,
        dpr * scale,
        dpr * scale * panOffset.x,
        dpr * scale * panOffset.y
      );
      ctx.drawImage(img, 0, 0);

      const isDragging = draggingRef.current;
      const baseLine = Math.max(0.35, Math.min(canvas.width, canvas.height) * 0.0007);
      const drawLabel = (x: number, y: number, text: string, color: string, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "12px \"IBM Plex Sans\", system-ui, sans-serif";
        const paddingX = 4;
        const paddingY = 2;
        const metrics = ctx.measureText(text);
        const labelW = Math.ceil(metrics.width + paddingX * 2);
        const labelH = 16;
        const bx = Math.max(0, x);
        const by = Math.max(0, y - labelH - 2);
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillRect(bx, by, labelW, labelH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, labelW, labelH);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillText(text, bx + paddingX, by + 12);
        ctx.restore();
      };

      const drawLabelSized = (
        x: number,
        y: number,
        text: string,
        color: string,
        alpha: number,
        scaleFactor: number
      ) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${Math.round(12 * scaleFactor)}px \"IBM Plex Sans\", system-ui, sans-serif`;
        const paddingX = 4;
        const paddingY = 2;
        const metrics = ctx.measureText(text);
        const labelW = Math.ceil(metrics.width + paddingX * 2);
        const labelH = Math.round(16 * scaleFactor);
        const bx = Math.max(0, x);
        const by = Math.max(0, y - labelH - 2);
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillRect(bx, by, labelW, labelH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, labelW, labelH);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillText(text, bx + paddingX, by + Math.round(12 * scaleFactor));
        ctx.restore();
      };

      const lineScale = Math.max(1, scale);
      const drawBox = (
        x: number,
        y: number,
        w: number,
        h: number,
        color: string,
        lineWidth: number,
        dashed: boolean,
        alpha: number,
        fillAlpha = 0
      ) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth / lineScale;
        ctx.setLineDash(dashed ? [6, 4] : []);
        if (fillAlpha > 0) {
          ctx.globalAlpha = fillAlpha;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = alpha;
        }
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
      };

      const drawCornerMarkers = (
        bbox: { x: number; y: number; w: number; h: number },
        color: string,
        size: number
      ) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(bbox.x - size, bbox.y - size, size, size);
        ctx.fillRect(bbox.x + bbox.w, bbox.y - size, size, size);
        ctx.fillRect(bbox.x - size, bbox.y + bbox.h, size, size);
        ctx.fillRect(bbox.x + bbox.w, bbox.y + bbox.h, size, size);
        ctx.restore();
      };

      const drawPolygon = (
        points: { x: number; y: number }[],
        color: string,
        lineWidth: number,
        alpha: number
      ) => {
        if (!points || points.length === 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      };

      const drawVertices = (
        points: { x: number; y: number }[],
        color: string,
        selectedIndex: number | null
      ) => {
        const radius = 5;
        points.forEach((pt, idx) => {
          ctx.save();
          ctx.fillStyle = idx === selectedIndex ? "#ffffff" : color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      };

      if (showCandidates) {
        candidates.forEach((c) => {
          const isSelected = c.id === selectedCandidateId;
          const color = colorMap[c.class_name] || "#ff2b2b";
          const lineWidth = isSelected ? baseLine * 2.0 : baseLine * 0.8;
          drawBox(
            c.bbox.x,
            c.bbox.y,
            c.bbox.w,
            c.bbox.h,
            color,
            lineWidth,
            !isSelected,
            isSelected ? 0.95 : 0.6,
            0
          );
        if (!isDragging && c.segPolygon) {
          drawPolygon(
            c.segPolygon,
            color,
            isSelected ? baseLine * 1.6 : baseLine * 1.1,
            isSelected ? 0.95 : 0.6
          );
        }
        const isManual = c.source === "manual";
        const labelText = c.class_name || (isManual ? "manual" : "");
        if (!isDragging && labelText) {
          drawLabel(c.bbox.x, c.bbox.y, labelText, color, isSelected ? 0.95 : 0.6);
        }
        if (isSelected) {
          const size = Math.max(4, Math.round(baseLine * 2.2));
          drawCornerMarkers(c.bbox, color, size);
        }
      });
      }

      const selectedAnn = selectedAnnotationId
        ? annotations.find((a) => a.id === selectedAnnotationId) || null
        : null;
      const blinkAlpha =
        blinkActive && selectedAnn
          ? 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(blinkTick * 0.45))
          : 1;

      if (showAnnotations) {
        annotations.forEach((a) => {
          const isSelected = a.id === selectedAnnotationId;
          const isHighlighted = a.id === highlightAnnotationId;
          const color = colorMap[a.class_name] || "#ff2b2b";
          const lineWidth = isSelected ? baseLine * 2.0 : baseLine * 1.2;
          const dashed = isSelected && editMode;
          drawBox(
            a.bbox.x,
            a.bbox.y,
            a.bbox.w,
            a.bbox.h,
            color,
            lineWidth,
            dashed,
            isSelected ? blinkAlpha : 1,
            0.1
          );
        if (!isDragging && a.segPolygon) {
          drawPolygon(
            a.segPolygon,
            color,
            isSelected ? baseLine * 2.6 : baseLine * 2.0,
            isSelected ? blinkAlpha : 1
          );
        }
        if (!isDragging && isHighlighted) {
          drawLabelSized(a.bbox.x, a.bbox.y, a.class_name, color, 1, 1.6);
        } else if (!isDragging) {
          drawLabel(a.bbox.x, a.bbox.y, a.class_name, color, 1);
        }
      });
      }

      if (!isDragging && editMode && editablePolygon && editablePolygon.length > 0) {
        const color = "#1a73e8";
        drawPolygon(editablePolygon, color, baseLine * 2.4, 1);
        if (showVertices) {
          drawVertices(editablePolygon, color, selectedVertexIndex);
        }
      }

      if (manualPreview) {
        const x0 = manualPreview.start.x;
        const y0 = manualPreview.start.y;
        const x1 = manualPreview.current.x;
        const y1 = manualPreview.current.y;
        const left = Math.min(x0, x1);
        const top = Math.min(y0, y1);
        const w = Math.abs(x1 - x0);
        const h = Math.abs(y1 - y0);
        ctx.save();
        ctx.strokeStyle = "#ff9800";
        ctx.fillStyle = "rgba(255, 152, 0, 0.15)";
        ctx.lineWidth = (baseLine * 1.6) / lineScale;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(left, top, w, h);
        ctx.fillRect(left, top, w, h);
        ctx.restore();
      }

      if (pendingManualBBox) {
        const { x, y, w, h } = pendingManualBBox;
        ctx.save();
        ctx.strokeStyle = "#ff6f00";
        ctx.fillStyle = "rgba(255, 183, 77, 0.15)";
        ctx.lineWidth = (baseLine * 1.6) / lineScale;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.fillRect(x, y, w, h);
        ctx.restore();
      }

      if (debugOverlay) {
        const drawDebugPoint = (pt: { x: number; y: number }, color: string) => {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1, baseLine * 1.4);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(3, baseLine * 2.2), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        };
        if (debugOverlay.roi_bbox) {
          const { x1, y1, x2, y2 } = debugOverlay.roi_bbox;
          drawBox(x1, y1, x2 - x1, y2 - y1, "#00bfa5", baseLine * 1.6, true, 0.9, 0);
        }
        if (debugOverlay.outer_bbox) {
          const b = debugOverlay.outer_bbox;
          drawBox(b.x, b.y, b.w, b.h, "#ffb300", baseLine * 1.4, true, 0.9, 0);
        }
        if (debugOverlay.tight_bbox) {
          const b = debugOverlay.tight_bbox;
          drawBox(b.x, b.y, b.w, b.h, "#2962ff", baseLine * 1.8, false, 0.95, 0);
        }
        if (debugOverlay.clicked_image_xy) {
          drawDebugPoint(debugOverlay.clicked_image_xy, "#d81b60");
        }
      }
      if ((debugOverlay || onDebugCoords) && debugPoints) {
        const dpr = getDpr();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = "#ff1744";
        ctx.lineWidth = Math.max(1, baseLine * 1.4);
        const sx = debugPoints.screen.x * dpr;
        const sy = debugPoints.screen.y * dpr;
        ctx.beginPath();
        ctx.moveTo(sx - 8 * dpr, sy);
        ctx.lineTo(sx + 8 * dpr, sy);
        ctx.moveTo(sx, sy - 8 * dpr);
        ctx.lineTo(sx, sy + 8 * dpr);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.setTransform(
          dpr * scale,
          0,
          0,
          dpr * scale,
          dpr * scale * panOffset.x,
          dpr * scale * panOffset.y
        );
        ctx.strokeStyle = "#1e88e5";
        ctx.lineWidth = Math.max(1, baseLine * 1.6);
        const ix = debugPoints.image.x;
        const iy = debugPoints.image.y;
        ctx.beginPath();
        ctx.moveTo(ix - 6, iy);
        ctx.lineTo(ix + 6, iy);
        ctx.moveTo(ix, iy - 6);
        ctx.lineTo(ix, iy + 6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    img.src = imageUrl;
  }, [
    imageUrl,
    candidates,
    selectedCandidateId,
    annotations,
    selectedAnnotationId,
    colorMap,
    showCandidates,
    showAnnotations,
    panOffset,
    editablePolygon,
    editMode,
    showVertices,
    selectedVertexIndex,
    manualPreview,
    scale,
    debugOverlay,
    debugPoints,
  ]);

  const schedulePanZoomUpdate = () => {
    if (panZoomRafRef.current !== null) return;
    panZoomRafRef.current = window.requestAnimationFrame(() => {
      panZoomRafRef.current = null;
      if (pendingPanRef.current) {
        setPanOffset(pendingPanRef.current);
        pendingPanRef.current = null;
      }
      if (pendingScaleRef.current !== null) {
        setScale(pendingScaleRef.current);
        pendingScaleRef.current = null;
      }
    });
  };

  const getScreenCoords = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
  };

  const screenToImage = (screen: { x: number; y: number }) => {
    const { sx, sy } = getCssScale();
    const imageX = screen.x / (sx * scaleRef.current) - panRef.current.x;
    const imageY = screen.y / (sy * scaleRef.current) - panRef.current.y;
    return { x: imageX, y: imageY };
  };

  const getImageCoords = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const screen = getScreenCoords(event);
    if (!screen) return null;
    return screenToImage(screen);
  };

  const findVertexIndex = (x: number, y: number) => {
    if (!editablePolygon || editablePolygon.length === 0) return null;
    const radius = 8;
    for (let i = 0; i < editablePolygon.length; i += 1) {
      const pt = editablePolygon[i];
      const dx = pt.x - x;
      const dy = pt.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        return i;
      }
    }
    return null;
  };

  const getSelectedCandidate = () => {
    if (!selectedCandidateId) return null;
    return candidates.find((c) => c.id === selectedCandidateId) || null;
  };

  const getSelectedAnnotation = () => {
    if (!selectedAnnotationId) return null;
    return annotations.find((a) => a.id === selectedAnnotationId) || null;
  };

  const isManualClassMissing = () => {
    const selected = getSelectedCandidate();
    return !!selected && selected.source === "manual" && !selected.class_name;
  };

  const isPointInsideBBox = (
    bbox: { x: number; y: number; w: number; h: number },
    x: number,
    y: number
  ) => x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h;

  const findResizeHandleForBBox = (
    bbox: { x: number; y: number; w: number; h: number },
    x: number,
    y: number
  ) => {
    const canvas = canvasRef.current;
    const size = canvas ? Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.01)) : 12;
    const handles = [
      { key: "tl" as const, x: bbox.x, y: bbox.y },
      { key: "tr" as const, x: bbox.x + bbox.w, y: bbox.y },
      { key: "bl" as const, x: bbox.x, y: bbox.y + bbox.h },
      { key: "br" as const, x: bbox.x + bbox.w, y: bbox.y + bbox.h },
    ];
    for (const h of handles) {
      const dx = h.x - x;
      const dy = h.y - y;
      if (dx * dx + dy * dy <= size * size) return h.key;
    }
    return null;
  };

  const findResizeHandle = (x: number, y: number) => {
    const selected = getSelectedCandidate();
    const selectedAnn = getSelectedAnnotation();
    const bbox = selectedAnn?.bbox || selected?.bbox;
    if (!bbox) return null;
    return findResizeHandleForBBox(bbox, x, y);
  };

  const findEdgeForBBox = (
    bbox: { x: number; y: number; w: number; h: number },
    x: number,
    y: number
  ) => {
    const canvas = canvasRef.current;
    const tolerance = canvas
      ? Math.max(6, Math.round(Math.min(canvas.width, canvas.height) * 0.006))
      : 8;
    const left = bbox.x;
    const right = bbox.x + bbox.w;
    const top = bbox.y;
    const bottom = bbox.y + bbox.h;
    const nearLeft = Math.abs(x - left) <= tolerance && y >= top && y <= bottom;
    const nearRight = Math.abs(x - right) <= tolerance && y >= top && y <= bottom;
    const nearTop = Math.abs(y - top) <= tolerance && x >= left && x <= right;
    const nearBottom = Math.abs(y - bottom) <= tolerance && x >= left && x <= right;
    if (nearLeft) return "w";
    if (nearRight) return "e";
    if (nearTop) return "n";
    if (nearBottom) return "s";
    return null;
  };

  const hitTestSelectedAnnotation = (x: number, y: number) => {
    const ann = getSelectedAnnotation();
    if (!ann) return null;
    const bbox = ann.bbox;
    const corner = findResizeHandleForBBox(bbox, x, y);
    if (corner) return { type: "corner" as const, corner };
    const edge = findEdgeForBBox(bbox, x, y);
    if (edge) return { type: "edge" as const, edge };
    if (isPointInsideBBox(bbox, x, y)) return { type: "inside" as const };
    return null;
  };

  const findMoveEdge = (x: number, y: number) => {
    const selected = getSelectedCandidate();
    if (!selected || selected.source !== "manual") return false;
    if (!isManualClassMissing()) return false;
    const canvas = canvasRef.current;
    const tolerance = canvas
      ? Math.max(6, Math.round(Math.min(canvas.width, canvas.height) * 0.006))
      : 8;
    const left = selected.bbox.x;
    const right = selected.bbox.x + selected.bbox.w;
    const top = selected.bbox.y;
    const bottom = selected.bbox.y + selected.bbox.h;
    const nearLeft = Math.abs(x - left) <= tolerance && y >= top && y <= bottom;
    const nearRight = Math.abs(x - right) <= tolerance && y >= top && y <= bottom;
    const nearTop = Math.abs(y - top) <= tolerance && x >= left && x <= right;
    const nearBottom = Math.abs(y - bottom) <= tolerance && x >= left && x <= right;
    return nearLeft || nearRight || nearTop || nearBottom;
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button === 0 && !event.shiftKey && !spacePressedRef.current) {
      clickTrackRef.current = {
        active: true,
        start: { x: event.clientX, y: event.clientY },
        moved: false,
      };
    } else {
      clickTrackRef.current = { active: false, start: null, moved: false };
    }
    if (event.button === 1 || spacePressedRef.current) {
      const coords = getImageCoords(event);
      if (!coords) return;
      panDragRef.current = {
        active: true,
        start: { x: event.clientX, y: event.clientY },
        origin: { ...panRef.current },
      };
      draggingRef.current = true;
      event.preventDefault();
      return;
    }
    if (!editMode) {
      const coords = getImageCoords(event);
      if (coords) {
        const handle = findResizeHandle(coords.x, coords.y);
        if (handle) {
          const selected = getSelectedCandidate();
          const selectedAnn = getSelectedAnnotation();
          if (selected || selectedAnn) {
            resizeDragRef.current = {
              active: true,
              handle,
              origin: { ...(selectedAnn?.bbox || selected!.bbox) },
              target: selectedAnn ? "annotation" : "candidate",
            };
            if (selectedAnn) {
              setBlinkActive(true);
              onAnnotationEditStart?.();
            }
            draggingRef.current = true;
            return;
          }
        }
        if (annotations.length > 0) {
          const hitAnn = annotations
            .map((a) => ({
              ann: a,
              handle: findResizeHandleForBBox(a.bbox, coords.x, coords.y),
              area: a.bbox.w * a.bbox.h,
            }))
            .filter((h) => h.handle)
            .sort((a, b) => a.area - b.area)[0];
          if (hitAnn) {
            onSelectAnnotation(hitAnn.ann);
            resizeDragRef.current = {
              active: true,
              handle: hitAnn.handle!,
              origin: { ...hitAnn.ann.bbox },
              target: "annotation",
            };
            setBlinkActive(true);
            onAnnotationEditStart?.();
            draggingRef.current = true;
            return;
          }
        }
        if (findMoveEdge(coords.x, coords.y)) {
          const selected = getSelectedCandidate();
          if (selected) {
            moveDragRef.current = {
              active: true,
              origin: { ...selected.bbox },
              start: coords,
              target: "candidate",
            };
            suppressNextClickRef.current = true;
            draggingRef.current = true;
            return;
          }
        }
        const selectedAnn = getSelectedAnnotation();
        if (
          selectedAnn &&
          isPointInsideBBox(selectedAnn.bbox, coords.x, coords.y) &&
          !findResizeHandleForBBox(selectedAnn.bbox, coords.x, coords.y)
        ) {
          moveDragRef.current = {
            active: true,
            origin: { ...selectedAnn.bbox },
            start: coords,
            target: "annotation",
          };
          setBlinkActive(true);
          onAnnotationEditStart?.();
          suppressNextClickRef.current = true;
          draggingRef.current = true;
          return;
        }
      }
    }
    if (!editMode || !showVertices || !editablePolygon) return;
    const coords = getImageCoords(event);
    if (!coords) return;
    const index = findVertexIndex(coords.x, coords.y);
    if (index === null) return;
    dragRef.current = { active: true, vertexIndex: index };
    draggingRef.current = true;
    onSelectVertex(index);
    onVertexDragStart();
  };

  const updateCursorByHandle = (x: number, y: number) => {
    if (panDragRef.current.active) {
      setCursorStyle("grabbing");
      return;
    }
    if (spacePressedRef.current) {
      setCursorStyle("grab");
      return;
    }
    if (moveDragRef.current.active) {
      setCursorStyle("grabbing");
      return;
    }
    if (resizeDragRef.current.active) {
      const handle = resizeDragRef.current.handle;
      if (handle === "tl" || handle === "br") {
        setCursorStyle("nwse-resize");
        return;
      }
      if (handle === "tr" || handle === "bl") {
        setCursorStyle("nesw-resize");
        return;
      }
    }
    if (manualDragRef.current.active) {
      setCursorStyle("crosshair");
      return;
    }
    const annHit = hitTestSelectedAnnotation(x, y);
    if (annHit?.type === "corner") {
      const handle = annHit.corner;
      if (handle === "tl" || handle === "br") {
        setCursorStyle("nwse-resize");
        return;
      }
      if (handle === "tr" || handle === "bl") {
        setCursorStyle("nesw-resize");
        return;
      }
    }
    if (annHit?.type === "edge") {
      if (annHit.edge === "n" || annHit.edge === "s") {
        setCursorStyle("ns-resize");
        return;
      }
      if (annHit.edge === "e" || annHit.edge === "w") {
        setCursorStyle("ew-resize");
        return;
      }
    }
    if (annHit?.type === "inside") {
      setCursorStyle("move");
      return;
    }
    if (findMoveEdge(x, y)) {
      setCursorStyle("move");
      return;
    }
    const handle = findResizeHandle(x, y);
    if (handle === "tl" || handle === "br") {
      setCursorStyle("nwse-resize");
      return;
    }
    if (handle === "tr" || handle === "bl") {
      setCursorStyle("nesw-resize");
      return;
    }
    if (manualDragRef.current.active) {
      setCursorStyle("crosshair");
      return;
    }
    setCursorStyle(imageUrl ? "crosshair" : "default");
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (clickTrackRef.current.active && clickTrackRef.current.start) {
      const dx = event.clientX - clickTrackRef.current.start.x;
      const dy = event.clientY - clickTrackRef.current.start.y;
      if (dx * dx + dy * dy > 9) {
        clickTrackRef.current.moved = true;
      }
    }
    if (panDragRef.current.active && panDragRef.current.start && panDragRef.current.origin) {
      const { sx, sy } = getCssScale();
      const dx = (event.clientX - panDragRef.current.start.x) / (sx * scaleRef.current);
      const dy = (event.clientY - panDragRef.current.start.y) / (sy * scaleRef.current);
      const next = {
        x: panDragRef.current.origin.x + dx,
        y: panDragRef.current.origin.y + dy,
      };
      panRef.current = next;
      pendingPanRef.current = next;
      schedulePanZoomUpdate();
      return;
    }
    if (moveDragRef.current.active && moveDragRef.current.origin && moveDragRef.current.start) {
      const coords = getImageCoords(event);
      if (!coords) return;
      const dx = coords.x - moveDragRef.current.start.x;
      const dy = coords.y - moveDragRef.current.start.y;
      const next = {
        x: Math.round(moveDragRef.current.origin.x + dx),
        y: Math.round(moveDragRef.current.origin.y + dy),
        w: moveDragRef.current.origin.w,
        h: moveDragRef.current.origin.h,
      };
      if (moveDragRef.current.target === "annotation") {
        onResizeSelectedAnnotation(next);
      } else {
        onResizeSelectedBBox(next);
      }
      return;
    }
    if (resizeDragRef.current.active && resizeDragRef.current.origin) {
      const coords = getImageCoords(event);
      if (!coords) return;
      const { origin, handle } = resizeDragRef.current;
      let x0 = origin.x;
      let y0 = origin.y;
      let x1 = origin.x + origin.w;
      let y1 = origin.y + origin.h;
      if (handle === "tl" || handle === "bl") x0 = coords.x;
      if (handle === "tr" || handle === "br") x1 = coords.x;
      if (handle === "tl" || handle === "tr") y0 = coords.y;
      if (handle === "bl" || handle === "br") y1 = coords.y;
      const left = Math.min(x0, x1);
      const top = Math.min(y0, y1);
      const w = Math.max(2, Math.abs(x1 - x0));
      const h = Math.max(2, Math.abs(y1 - y0));
      const nextBox = { x: Math.round(left), y: Math.round(top), w, h };
      if (getSelectedAnnotation()) {
        onResizeSelectedAnnotation(nextBox);
      } else {
        onResizeSelectedBBox(nextBox);
      }
      return;
    }
    if (!editMode) {
      const coords = getImageCoords(event);
      if (coords) updateCursorByHandle(coords.x, coords.y);
    }
    if (manualDragRef.current.active) {
      const coords = getImageCoords(event);
      if (!coords || !manualDragRef.current.start) return;
      manualDragRef.current.current = coords;
      setManualPreview({
        start: manualDragRef.current.start,
        current: coords,
      });
      draggingRef.current = true;
      return;
    }
    if (!dragRef.current.active || dragRef.current.vertexIndex === null) return;
    const coords = getImageCoords(event);
    if (!coords || !editablePolygon) return;
    const next = editablePolygon.map((pt, idx) =>
      idx === dragRef.current.vertexIndex ? { x: coords.x, y: coords.y } : pt
    );
    onUpdateEditablePolygon(next);
  };

  const handleMouseUp = (event?: React.MouseEvent<HTMLCanvasElement>) => {
    if (panDragRef.current.active) {
      panDragRef.current = { active: false, start: null, origin: null };
      suppressNextClickRef.current = true;
      draggingRef.current = false;
      clickTrackRef.current = { active: false, start: null, moved: false };
      return;
    }
    if (moveDragRef.current.active) {
      if (moveDragRef.current.target === "annotation") {
        setBlinkActive(false);
        onAnnotationEditEnd?.();
      }
      moveDragRef.current = { active: false, origin: null, start: null, target: null };
      suppressNextClickRef.current = true;
      draggingRef.current = false;
      clickTrackRef.current = { active: false, start: null, moved: false };
      return;
    }
    if (resizeDragRef.current.active) {
      if (resizeDragRef.current.target === "annotation") {
        setBlinkActive(false);
        onAnnotationEditEnd?.();
      }
      resizeDragRef.current = { active: false, handle: null, origin: null, target: null };
      suppressNextClickRef.current = true;
      draggingRef.current = false;
      clickTrackRef.current = { active: false, start: null, moved: false };
      return;
    }
    if (manualDragRef.current.active && manualDragRef.current.start && manualDragRef.current.current) {
      const start = manualDragRef.current.start;
      const current = manualDragRef.current.current;
      const left = Math.min(start.x, current.x);
      const top = Math.min(start.y, current.y);
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      manualDragRef.current = { active: false, start: null, current: null };
      setManualPreview(null);
      if (w >= 2 && h >= 2) {
        onCreateManualBBox({
          x: Math.round(left),
          y: Math.round(top),
          w: Math.round(w),
          h: Math.round(h),
        });
        suppressNextClickRef.current = true;
      }
      onManualCreateStateChange(false);
      draggingRef.current = false;
      clickTrackRef.current = { active: false, start: null, moved: false };
      return;
    }
    if (dragRef.current.active) {
      dragRef.current = { active: false, vertexIndex: null };
      draggingRef.current = false;
    }
    if (!clickTrackRef.current.active) return;
    if (!event) {
      clickTrackRef.current = { active: false, start: null, moved: false };
      return;
    }
    const moved = clickTrackRef.current.moved;
    clickTrackRef.current = { active: false, start: null, moved: false };
    if (moved) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (shouldIgnoreCanvasClick && shouldIgnoreCanvasClick()) return;
    if (panDragRef.current.active || spacePressedRef.current) {
      return;
    }
    if (manualDragRef.current.active) return;
    if (editMode) return;
    const screen = getScreenCoords(event);
    if (!screen) return;
    const coords = screenToImage(screen);
    if (debugOverlay || onDebugCoords) {
      setDebugPoints({ screen, image: coords });
      onDebugCoords?.({
        screen,
        image: coords,
        zoom: scaleRef.current,
        pan: { ...panRef.current },
        dpr: getDpr(),
        cssScale: { ...getCssScale() },
      });
    }
    if (annotations.length > 0) {
      const hit = annotations
        .filter(
          (a) =>
            coords.x >= a.bbox.x &&
            coords.x <= a.bbox.x + a.bbox.w &&
            coords.y >= a.bbox.y &&
            coords.y <= a.bbox.y + a.bbox.h
        )
        .sort((a, b) => a.bbox.w * a.bbox.h - b.bbox.w * b.bbox.h)[0];
      if (hit) {
        onSelectAnnotation(hit);
        return;
      }
    }
    onClickPoint(coords.x, coords.y);
  };

  const handleDoubleClick = () => {
    if (!spacePressedRef.current) return;
    panRef.current = { x: 0, y: 0 };
    setPanOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    setScale(1);
    spaceDoubleClickRef.current = null;
  };

  const handleMouseDownCapture = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode) return;
    if (!event.shiftKey) return;
    const coords = getImageCoords(event);
    if (!coords) return;
    manualDragRef.current = { active: true, start: coords, current: coords };
    setManualPreview({ start: coords, current: coords });
    onManualCreateStateChange(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        if (spacePressedRef.current) event.preventDefault();
        return;
      }
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const { sx, sy } = getCssScale();
      const imgX = cursorX / (sx * scaleRef.current) - panRef.current.x;
      const imgY = cursorY / (sy * scaleRef.current) - panRef.current.y;
      const delta = event.deltaY > 0 ? -0.2 : 0.2;
      const nextScale = Math.min(5, Math.max(0.2, scaleRef.current + delta));
      scaleRef.current = nextScale;
      pendingScaleRef.current = nextScale;
      const nextPan = {
        x: cursorX / (sx * nextScale) - imgX,
        y: cursorY / (sy * nextScale) - imgY,
      };
      panRef.current = nextPan;
      pendingPanRef.current = nextPan;
      schedulePanZoomUpdate();
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [imageUrl, setPanOffset, setScale]);

  return (
    <div style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        onMouseDown={imageUrl ? handleMouseDown : undefined}
        onMouseDownCapture={imageUrl ? handleMouseDownCapture : undefined}
        onMouseMove={imageUrl ? handleMouseMove : undefined}
        onMouseUp={imageUrl ? handleMouseUp : undefined}
        onDoubleClick={imageUrl ? handleDoubleClick : undefined}
        onMouseLeave={(event) => {
          if (imageUrl) handleMouseUp();
          setCursorStyle(imageUrl ? "crosshair" : "default");
        }}
        style={{
          width: "100%",
          border: "1px solid #ddd",
          background: "#fafafa",
          cursor: cursorStyle,
          touchAction: "none",
        }}
      />
      {!imageUrl && (
        <div style={{ padding: "12px 0", color: "#666" }}>画像をアップロードしてください。</div>
      )}
    </div>
  );
});
