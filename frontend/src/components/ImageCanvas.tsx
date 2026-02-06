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
  shouldIgnoreCanvasClick?: () => boolean;
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
  shouldIgnoreCanvasClick,
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
  }>({ active: false, handle: null, origin: null });
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
  }>({ active: false, origin: null, start: null });
  const [manualPreview, setManualPreview] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
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

  useImperativeHandle(ref, () => ({
    panTo: (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const offsetX = Math.round(canvas.width / 2 - x * scaleRef.current);
      const offsetY = Math.round(canvas.height / 2 - y * scaleRef.current);
      panRef.current = { x: offsetX, y: offsetY };
      setPanOffset({ x: offsetX, y: offsetY });
    },
  }));

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
      ctx.setTransform(scale, 0, 0, scale, panOffset.x, panOffset.y);
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
    ctx.lineWidth = lineWidth;
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

      if (showAnnotations) {
        annotations.forEach((a) => {
          const isSelected = a.id === selectedAnnotationId;
          const isHighlighted = a.id === highlightAnnotationId;
          const color = colorMap[a.class_name] || "#ff2b2b";
          const lineWidth = isSelected ? baseLine * 2.0 : baseLine * 1.2;
          drawBox(a.bbox.x, a.bbox.y, a.bbox.w, a.bbox.h, color, lineWidth, false, 1, 0.1);
        if (!isDragging && a.segPolygon) {
          drawPolygon(
            a.segPolygon,
            color,
            isSelected ? baseLine * 2.6 : baseLine * 2.0,
            1
          );
        }
        if (isSelected) {
          const size = Math.max(4, Math.round(baseLine * 2.2));
          drawCornerMarkers(a.bbox, color, size);
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
        ctx.lineWidth = baseLine * 1.6;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(left, top, w, h);
        ctx.fillRect(left, top, w, h);
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

  const getImageCoords = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawX = (event.clientX - rect.left) * scaleX;
    const rawY = (event.clientY - rect.top) * scaleY;
    const x = Math.round((rawX - panRef.current.x) / scaleRef.current);
    const y = Math.round((rawY - panRef.current.y) / scaleRef.current);
    return { x, y };
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

  const findResizeHandle = (x: number, y: number) => {
    const selected = getSelectedCandidate();
    const selectedAnn = getSelectedAnnotation();
    if (!selected && !selectedAnn) return null;
    const canvas = canvasRef.current;
    const size = canvas ? Math.max(10, Math.round(Math.min(canvas.width, canvas.height) * 0.01)) : 12;
    const bbox = selectedAnn?.bbox || selected?.bbox;
    if (!bbox) return null;
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
            };
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
            };
            suppressNextClickRef.current = true;
            draggingRef.current = true;
            return;
          }
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
    if (panDragRef.current.active && panDragRef.current.start && panDragRef.current.origin) {
      const dx = event.clientX - panDragRef.current.start.x;
      const dy = event.clientY - panDragRef.current.start.y;
      const next = {
        x: Math.round(panDragRef.current.origin.x + dx),
        y: Math.round(panDragRef.current.origin.y + dy),
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
      onResizeSelectedBBox(next);
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
      setManualPreview({ start: manualDragRef.current.start, current: coords });
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

  const handleMouseUp = () => {
    if (panDragRef.current.active) {
      panDragRef.current = { active: false, start: null, origin: null };
      suppressNextClickRef.current = true;
      draggingRef.current = false;
      return;
    }
    if (moveDragRef.current.active) {
      moveDragRef.current = { active: false, origin: null, start: null };
      draggingRef.current = false;
      return;
    }
    if (resizeDragRef.current.active) {
      resizeDragRef.current = { active: false, handle: null, origin: null };
      suppressNextClickRef.current = true;
      draggingRef.current = false;
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
        onCreateManualBBox({ x: left, y: top, w, h });
        suppressNextClickRef.current = true;
      }
      onManualCreateStateChange(false);
      draggingRef.current = false;
      return;
    }
    if (dragRef.current.active) {
      dragRef.current = { active: false, vertexIndex: null };
      draggingRef.current = false;
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (shouldIgnoreCanvasClick && shouldIgnoreCanvasClick()) {
      return;
    }
    if (panDragRef.current.active || spacePressedRef.current) return;
    if (manualDragRef.current.active) return;
    if (editMode) return;
    const coords = getImageCoords(event);
    if (!coords) return;
    onClickPoint(coords.x, coords.y);
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
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cursorX = (event.clientX - rect.left) * scaleX;
      const cursorY = (event.clientY - rect.top) * scaleY;
      const imgX = (cursorX - panRef.current.x) / scaleRef.current;
      const imgY = (cursorY - panRef.current.y) / scaleRef.current;
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      const nextScale = Math.min(5, Math.max(0.2, scaleRef.current + delta));
      scaleRef.current = nextScale;
      pendingScaleRef.current = nextScale;
      const nextPan = {
        x: Math.round(cursorX - imgX * nextScale),
        y: Math.round(cursorY - imgY * nextScale),
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
        onClick={imageUrl ? handleClick : undefined}
        onMouseDown={imageUrl ? handleMouseDown : undefined}
        onMouseDownCapture={imageUrl ? handleMouseDownCapture : undefined}
        onMouseMove={imageUrl ? handleMouseMove : undefined}
        onMouseUp={imageUrl ? handleMouseUp : undefined}
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
