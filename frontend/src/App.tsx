import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Annotation,
  Candidate,
  DatasetInfo,
  DatasetImageEntry,
  DetectPointResponse,
  ProjectTemplates,
  detectPoint,
  fetchProjects,
  fetchTemplates,
  fetchTemplatePreview,
  clearProjectAnnotations,
  segmentCandidate,
  toCandidates,
  importDataset,
  fetchDataset,
  selectDatasetImage,
  API_BASE,
  saveAnnotations,
  loadAnnotations,
  exportDatasetBBox,
  exportDatasetSeg,
  listDatasetProjects,
  createDatasetProject,
  deleteDatasetProject,
  autoAnnotate,
} from "./api";
import ImageCanvas, { ImageCanvasHandle } from "./components/ImageCanvas";
import NumericInputWithButtons from "./components/NumericInputWithButtons";
import { normalizeToHex } from "./utils/color";
import { clampToImage, simplifyPolygon } from "./utils/polygon";

const DEFAULT_ROI_SIZE = 200;
const DEFAULT_TOPK = 3;
const DEFAULT_SCALE_MIN = 0.5;
const DEFAULT_SCALE_MAX = 1.5;
const DEFAULT_SCALE_STEPS = 12;

export default function App() {
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [projectList, setProjectList] = useState<DatasetInfo[]>([]);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [newProjectFiles, setNewProjectFiles] = useState<FileList | null>(null);
  const [datasetSelectedName, setDatasetSelectedName] = useState<string | null>(null);
  const [imageStatusMap, setImageStatusMap] = useState<Record<string, number>>({});
  const isLoadingAnnotationsRef = useRef<boolean>(false);
  const [splitTrain, setSplitTrain] = useState<number>(7);
  const [splitVal, setSplitVal] = useState<number>(2);
  const [splitTest, setSplitTest] = useState<number>(1);
  const [splitSeed, setSplitSeed] = useState<number>(42);
  const [includeNegatives, setIncludeNegatives] = useState<boolean>(true);
  const [datasetType, setDatasetType] = useState<"bbox" | "seg">("bbox");
  const [exportFormat, setExportFormat] = useState<"folder" | "zip">("folder");
  const [refineContour, setRefineContour] = useState<boolean>(false);
  const [excludeEnabled, setExcludeEnabled] = useState<boolean>(true);
  const [excludeMode, setExcludeMode] = useState<"same_class" | "any_class">("same_class");
  const [excludeCenter, setExcludeCenter] = useState<boolean>(true);
  const [excludeIouThreshold, setExcludeIouThreshold] = useState<number>(0.6);
  const [showExportDrawer, setShowExportDrawer] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [isCanvasInteracting, setIsCanvasInteracting] = useState<boolean>(false);
  const interactionTimeoutRef = useRef<number | null>(null);
  const [showSplitSettings, setShowSplitSettings] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const [noticeVisible, setNoticeVisible] = useState<boolean>(true);
  const [hoverAction, setHoverAction] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [exportOutputDir, setExportOutputDir] = useState<string>("");
  const [exportDirHistory, setExportDirHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("draftSeeker.exportDirHistory");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [projects, setProjects] = useState<string[]>([]);
  const [templateProjects, setTemplateProjects] = useState<ProjectTemplates[]>([]);
  const [templateByDataset, setTemplateByDataset] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("draftseeker.templateByDataset");
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  });
  const [project, setProject] = useState<string>("");
  const [projectChangeUnlocked, setProjectChangeUnlocked] = useState<boolean>(false);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [roiSize, setRoiSize] = useState<number>(DEFAULT_ROI_SIZE);
  const [topk, setTopk] = useState<number>(DEFAULT_TOPK);
  const [scaleMin, setScaleMin] = useState<number>(DEFAULT_SCALE_MIN);
  const [scaleMax, setScaleMax] = useState<number>(DEFAULT_SCALE_MAX);
  const [scaleSteps, setScaleSteps] = useState<number>(DEFAULT_SCALE_STEPS);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [annotationFilterClass, setAnnotationFilterClass] = useState<string>("all");
  const [pendingManualBBox, setPendingManualBBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pendingManualClass, setPendingManualClass] = useState<string>("");
  const [annotationUndoStack, setAnnotationUndoStack] = useState<Annotation[][]>([]);
  const [annotationRedoStack, setAnnotationRedoStack] = useState<Annotation[][]>([]);
  const annotationEditActiveRef = useRef<boolean>(false);
  const editSessionRef = useRef<{
    activeId: string | null;
    before: Annotation[];
  } | null>(null);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState<boolean>(true);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const canvasRef = useRef<ImageCanvasHandle | null>(null);
  const [lastClick, setLastClick] = useState<{ x: number; y: number } | null>(null);
  const [detectDebug, setDetectDebug] = useState<DetectPointResponse["debug"] | null>(null);
  const [segEditMode, setSegEditMode] = useState<boolean>(false);
  const [showSegVertices, setShowSegVertices] = useState<boolean>(true);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [segUndoStack, setSegUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [segSimplifyEps, setSegSimplifyEps] = useState<number>(2);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [isCreatingManualBBox, setIsCreatingManualBBox] = useState<boolean>(false);
  const [highlightAnnotationId, setHighlightAnnotationId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [showHints, setShowHints] = useState<boolean>(() => {
    try {
      return localStorage.getItem("draftSeeker.hideHints") !== "1";
    } catch {
      return true;
    }
  });
  const [datasetImporting, setDatasetImporting] = useState<boolean>(false);
  const [lastImportPath, setLastImportPath] = useState<string | null>(null);
  const [autoThreshold, setAutoThreshold] = useState<number>(0.7);
  const [autoClassFilter, setAutoClassFilter] = useState<string[]>([]);
  const [autoMethod, setAutoMethod] = useState<"combined" | "scaled_templates">("combined");
  const [autoPanelOpen, setAutoPanelOpen] = useState<boolean>(true);
  const [autoAdvancedOpen, setAutoAdvancedOpen] = useState<boolean>(false);
  const [autoStride, setAutoStride] = useState<number | null>(null);
  const [advancedBaseline, setAdvancedBaseline] = useState<{
    roiSize: number;
    topk: number;
    scaleMin: number;
    scaleMax: number;
    scaleSteps: number;
    excludeEnabled: boolean;
    excludeMode: "same_class" | "any_class";
    excludeCenter: boolean;
    excludeIouThreshold: number;
    refineContour: boolean;
  } | null>(null);
  const [autoBaseline, setAutoBaseline] = useState<{
    autoThreshold: number;
    autoMethod: "combined" | "scaled_templates";
    autoClassFilter: string[];
    autoStride: number | null;
    scaleMin: number;
    scaleMax: number;
    scaleSteps: number;
    roiSize: number;
  } | null>(null);
  const [autoRunning, setAutoRunning] = useState<boolean>(false);
  const [autoResult, setAutoResult] = useState<{
    added: number;
    rejected: number;
    threshold: number;
  } | null>(null);
  const [autoProgress, setAutoProgress] = useState<number>(0);
  const [lastAutoAddedIds, setLastAutoAddedIds] = useState<string[]>([]);
  const autoProgressTimerRef = useRef<number | null>(null);
  const [checkedAnnotationIds, setCheckedAnnotationIds] = useState<string[]>([]);
  const annotationRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const exportDirInputRef = useRef<HTMLInputElement | null>(null);
  const [coordDebug, setCoordDebug] = useState<{
    screen: { x: number; y: number };
    image: { x: number; y: number };
    zoom: number;
    pan: { x: number; y: number };
    dpr: number;
    cssScale?: { sx: number; sy: number };
  } | null>(null);
  const [templatePreviewBase64, setTemplatePreviewBase64] = useState<string | null>(null);
  const templatePreviewCacheRef = useRef<Map<string, string>>(new Map());
  const didAutoRestoreRef = useRef(false);
  type AppViewState = { view: "home" } | { view: "project"; projectName: string };
  const VIEW_STATE_KEY = "draftseeker:viewState:v1";
  const [viewState, setViewState] = useState<AppViewState>(() => {
    try {
      const raw = localStorage.getItem(VIEW_STATE_KEY);
      if (!raw) return { view: "home" };
      const parsed = JSON.parse(raw) as AppViewState;
      if (parsed && parsed.view === "project" && typeof (parsed as any).projectName === "string") {
        return { view: "project", projectName: (parsed as any).projectName };
      }
      return { view: "home" };
    } catch {
      return { view: "home" };
    }
  });
  const asChildren = (nodes: React.ReactNode[]) => React.Children.toArray(nodes);

  const dismissHints = () => {
    setShowHints(false);
    try {
      localStorage.setItem("draftSeeker.hideHints", "1");
    } catch {
      // ignore
    }
  };

  const addExportDirHistory = (dir: string) => {
    const cleaned = dir.trim();
    if (!cleaned) return;
    setExportDirHistory((prev) => {
      const next = [cleaned, ...prev.filter((item) => item !== cleaned)].slice(0, 8);
      try {
        localStorage.setItem("draftSeeker.exportDirHistory", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const refreshProjectList = async () => {
    try {
      const list = await listDatasetProjects();
      const enriched = await Promise.all(
        list.map(async (p) => {
          try {
            const detail = await fetchDataset(p.project_name);
            return {
              ...p,
              total_images: detail.total_images,
              annotated_images: detail.annotated_images,
              bbox_count: detail.bbox_count,
              seg_count: detail.seg_count,
              updated_at: detail.updated_at ?? p.updated_at,
              images: detail.images ?? p.images,
            };
          } catch {
            return p;
          }
        })
      );
      setProjectList(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project list failed");
    }
  };

  const selectedCandidate = useMemo(() => {
    if (!selectedCandidateId) return null;
    return candidates.find((c) => c.id === selectedCandidateId) || null;
  }, [candidates, selectedCandidateId]);

  const isManualSelected = useMemo(
    () => selectedCandidate?.source === "manual",
    [selectedCandidate]
  );
  const manualClassMissing = useMemo(
    () => isManualSelected && !selectedCandidate?.class_name,
    [isManualSelected, selectedCandidate]
  );

  const selectedAnnotation = useMemo(() => {
    if (!selectedAnnotationId) return null;
    return annotations.find((a) => a.id === selectedAnnotationId) || null;
  }, [annotations, selectedAnnotationId]);

  const filteredAnnotations = useMemo(() => {
    if (annotationFilterClass === "all") return annotations;
    return annotations.filter((a) => a.class_name === annotationFilterClass);
  }, [annotations, annotationFilterClass]);

  const sortedAnnotations = useMemo(() => {
    return [...filteredAnnotations].sort((a, b) => {
      const ay = a.bbox.y;
      const by = b.bbox.y;
      if (ay !== by) return ay - by;
      return a.bbox.x - b.bbox.x;
    });
  }, [filteredAnnotations]);

  useEffect(() => {
    if (checkedAnnotationIds.length === 0) return;
    const currentIds = new Set(annotations.map((a) => a.id));
    const next = checkedAnnotationIds.filter((id) => currentIds.has(id));
    if (next.length !== checkedAnnotationIds.length) {
      setCheckedAnnotationIds(next);
    }
  }, [annotations, checkedAnnotationIds]);

  useEffect(() => {
    if (annotationFilterClass === "all") return;
    if (!selectedAnnotationId) return;
    const stillVisible = annotations.some(
      (a) => a.id === selectedAnnotationId && a.class_name === annotationFilterClass
    );
    if (!stillVisible) {
      setSelectedAnnotationId(null);
    }
  }, [annotationFilterClass, annotations, selectedAnnotationId]);

  const cloneAnnotations = (items: Annotation[]) =>
    items.map((a) => ({
      ...a,
      bbox: { ...a.bbox },
      segPolygon: a.segPolygon ? a.segPolygon.map((p) => ({ ...p })) : undefined,
      originalSegPolygon: a.originalSegPolygon
        ? a.originalSegPolygon.map((p) => ({ ...p }))
        : undefined,
    }));

  const pushAnnotationHistory = () => {
    setAnnotationUndoStack((prev) => [...prev, cloneAnnotations(annotations)]);
    setAnnotationRedoStack([]);
  };

  const clampBBoxToImage = (bbox: { x: number; y: number; w: number; h: number }) => {
    if (!imageSize) return bbox;
    const w = Math.max(4, Math.min(imageSize.w, bbox.w));
    const h = Math.max(4, Math.min(imageSize.h, bbox.h));
    const x = Math.min(imageSize.w - w, Math.max(0, bbox.x));
    const y = Math.min(imageSize.h - h, Math.max(0, bbox.y));
    return { x, y, w, h };
  };

  const splitSummary = useMemo(() => {
    const images = (datasetInfo?.images || [])
      .map((entry: DatasetImageEntry) => entry.original_filename || entry.filename || "")
      .filter((name) => !!name);
    const total = images.length;
    const ratios = [
      { key: "train", value: Math.max(0, splitTrain) },
      { key: "val", value: Math.max(0, splitVal) },
      { key: "test", value: Math.max(0, splitTest) },
    ];
    const ratioSum = ratios.reduce((acc, r) => acc + r.value, 0);
    if (total === 0 || ratioSum === 0) {
      return { total, train: 0, val: 0, test: 0 };
    }
    const raw = ratios.map((r) => ({
      key: r.key,
      count: (r.value / ratioSum) * total,
    }));
    const floors = raw.map((r) => Math.floor(r.count));
    let remaining = total - floors.reduce((acc, v) => acc + v, 0);
    const order = raw
      .map((r, idx) => ({ idx, frac: r.count - floors[idx] }))
      .sort((a, b) => b.frac - a.frac);
    const counts = [...floors];
    for (let i = 0; i < order.length && remaining > 0; i += 1) {
      counts[order[i].idx] += 1;
      remaining -= 1;
    }
    const shuffled = seededShuffle(images, splitSeed);
    const trainCount = counts[0];
    const valCount = counts[1];
    const testCount = counts[2];
    const _train = shuffled.slice(0, trainCount);
    const _val = shuffled.slice(trainCount, trainCount + valCount);
    const _test = shuffled.slice(trainCount + valCount, trainCount + valCount + testCount);
    return {
      total,
      train: _train.length,
      val: _val.length,
      test: _test.length,
    };
  }, [datasetInfo?.images, splitTrain, splitVal, splitTest, splitSeed]);

  const isSameArray = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, idx) => v === b[idx]);

  const advancedDirty = useMemo(() => {
    if (!advancedBaseline) return false;
    return (
      roiSize !== advancedBaseline.roiSize ||
      topk !== advancedBaseline.topk ||
      scaleMin !== advancedBaseline.scaleMin ||
      scaleMax !== advancedBaseline.scaleMax ||
      scaleSteps !== advancedBaseline.scaleSteps ||
      excludeEnabled !== advancedBaseline.excludeEnabled ||
      excludeMode !== advancedBaseline.excludeMode ||
      excludeCenter !== advancedBaseline.excludeCenter ||
      excludeIouThreshold !== advancedBaseline.excludeIouThreshold ||
      refineContour !== advancedBaseline.refineContour
    );
  }, [
    advancedBaseline,
    roiSize,
    topk,
    scaleMin,
    scaleMax,
    scaleSteps,
    excludeEnabled,
    excludeMode,
    excludeCenter,
    excludeIouThreshold,
    refineContour,
  ]);

  const autoDirty = useMemo(() => {
    if (!autoBaseline) return false;
    return (
      autoThreshold !== autoBaseline.autoThreshold ||
      autoMethod !== autoBaseline.autoMethod ||
      autoStride !== autoBaseline.autoStride ||
      scaleMin !== autoBaseline.scaleMin ||
      scaleMax !== autoBaseline.scaleMax ||
      scaleSteps !== autoBaseline.scaleSteps ||
      roiSize !== autoBaseline.roiSize ||
      !isSameArray(autoClassFilter, autoBaseline.autoClassFilter)
    );
  }, [
    autoBaseline,
    autoThreshold,
    autoMethod,
    autoStride,
    scaleMin,
    scaleMax,
    scaleSteps,
    roiSize,
    autoClassFilter,
  ]);

  const scaleMinDanger = scaleMin < 0.2;
  const scaleMaxDanger = scaleMax > 3.0;
  const scaleMinWarn = scaleMin < 0.4 || scaleMin > 0.8;
  const scaleMaxWarn = scaleMax < 1.2 || scaleMax > 2.0;
  const scaleStepsDanger = scaleSteps > 20;
  const scaleStepsWarn = scaleSteps < 6 || scaleSteps > 12;
  const topkDanger = topk > 10;
  const topkWarn = topk < 1 || topk > 5;
  const roiDanger = roiSize < 100 || roiSize > 1200;
  const roiWarn = roiSize < 200 || roiSize > 600;
  const autoThresholdDanger = autoThreshold < 0.3;
  const autoThresholdWarn = autoThreshold < 0.6 || autoThreshold > 0.85;
  const strideDanger =
    typeof autoStride === "number" && (autoStride < 16 || autoStride > 256);
  const strideWarn =
    typeof autoStride === "number" && (autoStride < 32 || autoStride > 128);

  const handleBrowseExportDir = async () => {
    try {
      if ("showDirectoryPicker" in window) {
        // @ts-expect-error - File System Access API (browser dependent)
        const handle = await window.showDirectoryPicker();
        if (handle?.name) {
          setExportOutputDir(handle.name);
          setExportDirHistory((prev) =>
            prev.includes(handle.name) ? prev : [handle.name, ...prev].slice(0, 8)
          );
        }
        return;
      }
      exportDirInputRef.current?.click();
    } catch {
      // ignore cancel
    }
  };

  const handleExportDirPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const first = files[0] as File & { webkitRelativePath?: string };
    const rel = first.webkitRelativePath || "";
    const topDir = rel.split("/")[0];
    if (topDir) {
      setExportOutputDir(topDir);
      setExportDirHistory((prev) =>
        prev.includes(topDir) ? prev : [topDir, ...prev].slice(0, 8)
      );
    }
    event.target.value = "";
  };

  const totalAnnotations = useMemo(
    () => Object.values(imageStatusMap).reduce((acc, v) => acc + v, 0),
    [imageStatusMap]
  );
  const totalImages = datasetInfo?.total_images ?? datasetInfo?.images?.length ?? 0;
  const annotatedImages = datasetInfo?.annotated_images ?? 0;
  const classesCount = classOptions.length;
  const exportFolderName = useMemo(() => {
    const base = datasetInfo?.project_name || datasetId || "dataset";
    const d = new Date();
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `dataset_${base}_${y}${m}${day}`;
  }, [datasetInfo, datasetId]);
  const exportWarnings = useMemo(() => {
    const warnings: { level: "yellow" | "orange"; text: string }[] = [];
    if (includeNegatives && totalImages > annotatedImages) {
      warnings.push({
        level: "yellow",
        text: "未アノテ画像（ネガティブ）を含みます",
      });
    }
    if (splitSummary.val === 0 || splitSummary.test === 0) {
      warnings.push({
        level: "orange",
        text: "Val または Test が 0 です（分割比率/枚数を確認してください）",
      });
    }
    return warnings;
  }, [includeNegatives, totalImages, annotatedImages, splitSummary.val, splitSummary.test]);
  const exportErrors = useMemo(() => {
    const errors: string[] = [];
    if (classesCount === 0 || totalAnnotations === 0) {
      errors.push("クラスが 0 件のためエクスポートできません");
    }
    return errors;
  }, [classesCount, totalAnnotations]);
  const canExport = exportErrors.length === 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedCandidate || segEditMode) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      let dx = 0;
      let dy = 0;
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") dx = -step;
      if (event.key === "ArrowRight") dx = step;
      if (event.key === "ArrowUp") dy = -step;
      if (event.key === "ArrowDown") dy = step;
      if (dx === 0 && dy === 0) return;

      event.preventDefault();
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.id !== selectedCandidate.id) return c;
          let nextX = c.bbox.x + dx;
          let nextY = c.bbox.y + dy;
          if (imageSize) {
            nextX = Math.min(imageSize.w - c.bbox.w, Math.max(0, nextX));
            nextY = Math.min(imageSize.h - c.bbox.h, Math.max(0, nextY));
          }
          return {
            ...c,
            bbox: { ...c.bbox, x: nextX, y: nextY },
          };
        })
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCandidate, segEditMode, imageSize]);

  useEffect(() => {
    let mounted = true;
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    fetchProjects()
      .then((list: string[]) => {
        if (!mounted) return;
        setProjects(list);
        if (!project && list.length > 0) {
          setProject(list[0]);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Projects fetch failed");
      });
    fetchTemplates()
      .then((list: ProjectTemplates[]) => {
        if (!mounted) return;
        setTemplateProjects(list);
        const selected = list.find((p: ProjectTemplates) => p.name === project) || list[0];
        const classes = selected
          ? selected.classes.map((c: { class_name: string; count: number }) => c.class_name)
          : [];
        setClassOptions(classes);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Templates fetch failed");
      });
    refreshProjectList();
    return () => {
      mounted = false;
      document.body.style.overflow = "";
    };
  }, [project]);

  useEffect(() => {
    if (didAutoRestoreRef.current) return;
    if (projectList.length === 0) return;
    if (viewState.view === "home") {
      didAutoRestoreRef.current = true;
      return;
    }
    if (datasetId === viewState.projectName) {
      didAutoRestoreRef.current = true;
      return;
    }
    if (!projectList.some((p) => p.project_name === viewState.projectName)) {
      setViewState({ view: "home" });
      didAutoRestoreRef.current = true;
      return;
    }
    didAutoRestoreRef.current = true;
    void handleOpenProject(viewState.projectName);
  }, [projectList, datasetId, viewState]);


  const handleFolderImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!datasetId) {
      setError("プロジェクトを選択してください");
      return;
    }
    const files = Array.from(event.target.files || []).filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      return ext === "jpg" || ext === "jpeg" || ext === "png";
    });
    const rawFiles = Array.from(event.target.files || []);
    if (rawFiles.length > 0) {
      const first = rawFiles[0];
      const rel = (first as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      if (rel.includes("/")) {
        setLastImportPath(rel.split("/")[0]);
      }
    }
    if (files.length === 0) return;
    setError(null);
    setNotice(null);
    setDatasetImporting(true);
    try {
      const res = await importDataset({ project_name: datasetId, files });
      const info = await fetchDataset(res.project_name);
      setDatasetInfo(info);
      setImageStatusMap({});
      setDatasetSelectedName(null);
      setNotice(`Dataset imported: ${res.project_name} (${res.count} files)`);
      refreshProjectList();
      if (info.images.length > 0) {
        void loadAllAnnotationCounts(res.project_name, info.images);
      }
      setImageId(null);
      setImageUrl(null);
      setCandidates([]);
      setSelectedCandidateId(null);
      setAnnotations([]);
      setSelectedAnnotationId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dataset import failed");
    } finally {
      setDatasetImporting(false);
      event.target.value = "";
    }
  };

  const resetAnnotationWorkState = () => {
    setCandidates([]);
    setSelectedCandidateId(null);
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setCheckedAnnotationIds([]);
    setAnnotationUndoStack([]);
    setAnnotationRedoStack([]);
    setPendingManualBBox(null);
    setPendingManualClass("");
    setIsCreatingManualBBox(false);
    setLastClick(null);
    setDetectDebug(null);
    setCoordDebug(null);
    setSegEditMode(false);
    setShowSegVertices(true);
    setSelectedVertexIndex(null);
    setSegUndoStack([]);
    setHighlightAnnotationId(null);
    setLastAutoAddedIds([]);
    setAutoResult(null);
    setAutoProgress(0);
    setAutoRunning(false);
    setAutoPanelOpen(false);
    setAutoAdvancedOpen(false);
    setShowExportDrawer(false);
    setExportResult(null);
    setImageStatusMap({});
  };

  const handleProjectTemplateChange = async (nextProject: string) => {
    if (nextProject === project) {
      setProjectChangeUnlocked(false);
      return;
    }
    const ok = window.confirm(
      "プロジェクト（テンプレ）を変更します。\nクラス定義が変わる可能性があるため、現在のアノテーション（確定/候補）とUI状態は全て削除し、クラス一覧を再読み込みします。続行しますか？"
    );
    if (!ok) {
      setProjectChangeUnlocked(false);
      return;
    }
    resetAnnotationWorkState();
    if (datasetId) {
      try {
        await clearProjectAnnotations(datasetId);
      } catch {
        // ignore clear failures
      }
    }
    if (datasetId) {
      setTemplateByDataset((prev) => {
        const next = { ...prev, [datasetId]: nextProject };
        try {
          localStorage.setItem("draftseeker.templateByDataset", JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
    setProject(nextProject);
    try {
      const list = await fetchTemplates();
      const selected = list.find((p: ProjectTemplates) => p.name === nextProject) || list[0];
      const classes = selected
        ? selected.classes.map((c: { class_name: string; count: number }) => c.class_name)
        : [];
      setClassOptions(classes);
      const nextColors = buildColorMapFromClasses(classes);
      setColorMap(nextColors);
      setAutoClassFilter(classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Templates fetch failed");
    } finally {
      setProjectChangeUnlocked(false);
    }
  };

  const handleSelectDatasetImage = async (filename: string) => {
    if (!datasetId) return;
    await loadDatasetImage(datasetId, filename);
  };

  const handleOpenProject = async (projectName: string) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    setShowAdvanced(false);
    setShowDebug(false);
    setAutoAdvancedOpen(false);
    setAutoPanelOpen(false);
    setShowSplitSettings(false);
    setShowExportDrawer(false);
    setViewState({ view: "project", projectName });
    try {
      const storedTemplate = templateByDataset[projectName];
      if (storedTemplate) {
        setProject(storedTemplate);
      }
      const info = await fetchDataset(projectName);
      setDatasetId(projectName);
      setDatasetInfo(info);
      setDatasetSelectedName(null);
      setImageStatusMap({});
      setImageId(null);
      setImageUrl(null);
      setCandidates([]);
      setSelectedCandidateId(null);
      setAnnotations([]);
      setSelectedAnnotationId(null);
      const storedColors = loadColorMapForProject(projectName);
      if (storedColors) {
        setColorMap(storedColors);
      } else {
        const nextColors = buildColorMapFromClasses(classOptions);
        setColorMap(nextColors);
        saveColorMapForProject(projectName, nextColors);
      }
      const storedAuto = loadAutoSettingsForProject(projectName);
      if (storedAuto) {
        if (typeof storedAuto.autoThreshold === "number") setAutoThreshold(storedAuto.autoThreshold);
        if (storedAuto.autoMethod) setAutoMethod(storedAuto.autoMethod);
      }
      const allClasses = classOptions.length > 0 ? classOptions : [];
      setAutoClassFilter(allClasses);
      if (info.images.length > 0) {
        void loadAllAnnotationCounts(projectName, info.images);
      }
      if (info.images.length > 0) {
        await loadDatasetImage(projectName, info.images[0].original_filename);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project open failed");
    } finally {
      setBusy(false);
    }
  };

  const closeExportDrawer = () => {
    setShowExportDrawer(false);
    setExportResult(null);
  };

  const handleBackToHome = () => {
    setError(null);
    setNotice(null);
    setBusy(false);
    setViewState({ view: "home" });
    setDatasetId(null);
    setDatasetInfo(null);
    setDatasetSelectedName(null);
    setImageStatusMap({});
    setImageId(null);
    setImageUrl(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setAnnotations([]);
    setSelectedAnnotationId(null);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) {
      setError("プロジェクト名を入力してください");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await createDatasetProject(name);
      if (newProjectFiles && newProjectFiles.length > 0) {
        await importDataset({ project_name: name, files: Array.from(newProjectFiles) });
      }
      setNewProjectName("");
      setNewProjectFiles(null);
      await refreshProjectList();
      await handleOpenProject(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project create failed");
    }
  };

  const handleDeleteProject = async (name: string) => {
    if (!window.confirm(`本当に削除しますか？\n${name}`)) return;
    setError(null);
    setNotice(null);
    try {
      await deleteDatasetProject(name);
      if (datasetId === name) {
        setDatasetId(null);
        setDatasetInfo(null);
        setDatasetSelectedName(null);
        setImageId(null);
        setImageUrl(null);
        setCandidates([]);
        setSelectedCandidateId(null);
        setAnnotations([]);
        setSelectedAnnotationId(null);
      }
      await refreshProjectList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project delete failed");
    }
  };

  const handleExportDatasetBBox = async () => {
    if (!datasetId || !datasetInfo) return;
    if (!exportOutputDir.trim()) {
      setError("保存先ディレクトリを指定してください");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await exportDatasetBBox({
        project_name: datasetId,
        project,
        split_train: splitTrain,
        split_val: splitVal,
        split_test: splitTest,
        seed: splitSeed,
        include_negatives: includeNegatives,
        output_dir: exportOutputDir.trim(),
      });
      if (!res.ok) {
        const message = res.error || "Dataset export failed";
        setError(message);
        setExportResult({ ok: false, message });
        return;
      }
      setNotice(null);
      setExportResult({ ok: true, message: `Exported: ${res.output_dir || ""}` });
      addExportDirHistory(exportOutputDir.trim());
      if (exportFormat === "zip" && res.export_id) {
        const url = `${API_BASE}/dataset/export/download?project_name=${encodeURIComponent(
          datasetId
        )}&export_id=${encodeURIComponent(res.export_id)}`;
        window.location.href = url;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dataset export failed";
      setError(message);
      setExportResult({ ok: false, message });
    } finally {
      setBusy(false);
    }
  };

  const handleExportDatasetSeg = async () => {
    if (!datasetId || !datasetInfo) return;
    if (!exportOutputDir.trim()) {
      setError("保存先ディレクトリを指定してください");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await exportDatasetSeg({
        project_name: datasetId,
        project,
        split_train: splitTrain,
        split_val: splitVal,
        split_test: splitTest,
        seed: splitSeed,
        output_dir: exportOutputDir.trim(),
      });
      if (!res.ok) {
        const message = res.error || "Dataset export failed";
        setError(message);
        setExportResult({ ok: false, message });
        return;
      }
      setNotice(null);
      setExportResult({ ok: true, message: `Exported: ${res.output_dir || ""}` });
      addExportDirHistory(exportOutputDir.trim());
      if (exportFormat === "zip" && res.export_id) {
        const url = `${API_BASE}/dataset/export/download?project_name=${encodeURIComponent(
          datasetId
        )}&export_id=${encodeURIComponent(res.export_id)}`;
        window.location.href = url;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dataset export failed";
      setError(message);
      setExportResult({ ok: false, message });
    } finally {
      setBusy(false);
    }
  };

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const handleClickPoint = async (x: number, y: number) => {
    if (isCreatingManualBBox) return;
    if (manualClassMissing) return;
    if (!imageId || !project) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    let sendX = x;
    let sendY = y;
    if (imageSize) {
      sendX = clamp(x, 0, imageSize.w - 1);
      sendY = clamp(y, 0, imageSize.h - 1);
    }
    setLastClick({ x: sendX, y: sendY });
    try {
      const res = await detectPoint({
        image_id: imageId,
        project,
        x: sendX,
        y: sendY,
        roi_size: roiSize,
        scale_min: scaleMin,
        scale_max: scaleMax,
        scale_steps: scaleSteps,
        topk,
        confirmed_boxes: annotations.map((a) => ({
          x: a.bbox.x,
          y: a.bbox.y,
          w: a.bbox.w,
          h: a.bbox.h,
        })),
        refine_contour: refineContour,
        confirmed_annotations: annotations.map((a) => ({
          class_name: a.class_name,
          bbox: { x: a.bbox.x, y: a.bbox.y, w: a.bbox.w, h: a.bbox.h },
        })),
        exclude_enabled: excludeEnabled,
        exclude_mode: excludeMode,
        exclude_center: excludeCenter,
        exclude_iou_threshold: excludeIouThreshold,
      });
      setDetectDebug(res.debug || null);
      const nextCandidates = toCandidates(res);
      setCandidates(nextCandidates);
      setSelectedCandidateId(nextCandidates.length > 0 ? nextCandidates[0].id : null);
      setColorMap((prev) => {
        const next = { ...prev };
        nextCandidates.forEach((r: Candidate) => {
          if (!next[r.class_name]) {
            next[r.class_name] = pickUniqueColor(next);
          }
        });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detect failed");
      setDetectDebug(null);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCandidate = () => {
    if (!selectedCandidate) return;
    if (selectedCandidate.source === "manual" && !selectedCandidate.class_name) {
      setError("手動候補はクラスを選択してください");
      return;
    }
    pushAnnotationHistory();
    const createdAt = new Date().toISOString();
    const source =
      selectedCandidate.source === "manual"
        ? "manual"
        : selectedCandidate.segPolygon
          ? "sam"
          : "template";
    const score =
      typeof selectedCandidate.score === "number"
        ? selectedCandidate.score
        : selectedCandidate.source === "manual"
          ? 1.0
          : undefined;
    const segPolygon = selectedCandidate.segPolygon
      ? selectedCandidate.segPolygon.map((p: { x: number; y: number }) => ({ ...p }))
      : undefined;
    const segMethod = selectedCandidate.segMethod;
    setAnnotations((prev) => [
      ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          class_name: selectedCandidate.class_name,
          bbox: selectedCandidate.bbox,
          source,
          created_at: createdAt,
          score,
          segPolygon,
          originalSegPolygon: segPolygon
            ? segPolygon.map((p: { x: number; y: number }) => ({ ...p }))
            : undefined,
          segMethod,
      },
    ]);
    setNotice(`${selectedCandidate.class_name} を確定しました`);
    if (candidates.length > 0) {
      const index = candidates.findIndex((c) => c.id === selectedCandidate.id);
      if (index >= 0) {
        const nextIndex = (index + 1) % candidates.length;
        setSelectedCandidateId(candidates[nextIndex].id);
      }
    }
  };

  const handleRejectCandidate = () => {
    if (!selectedCandidate) return;
    const index = candidates.findIndex((c) => c.id === selectedCandidate.id);
    const next = candidates.filter((c) => c.id !== selectedCandidate.id);
    setCandidates(next);
    if (next.length === 0) {
      setSelectedCandidateId(null);
      return;
    }
    const nextIndex = index < next.length ? index : next.length - 1;
    setSelectedCandidateId(next[nextIndex].id);
  };

  const handleNextCandidate = () => {
    if (candidates.length === 0) return;
    const index = selectedCandidateId
      ? candidates.findIndex((c) => c.id === selectedCandidateId)
      : -1;
    const nextIndex = index >= 0 ? (index + 1) % candidates.length : 0;
    setSelectedCandidateId(candidates[nextIndex].id);
  };

  const handleSegCandidate = async () => {
    if (!selectedCandidate || !imageId) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await segmentCandidate({
        image_id: imageId,
        bbox: selectedCandidate.bbox,
        click: lastClick,
      });
      if (!res.ok || !res.polygon) {
        setError(res.error || "Segmentation failed");
        return;
      }
      let nextPolygon = res.polygon;
      if (imageSize) {
        nextPolygon = clampToImage(nextPolygon, imageSize.w, imageSize.h);
      }
      nextPolygon = simplifyPolygon(nextPolygon, segSimplifyEps);
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidate.id
            ? { ...c, segPolygon: nextPolygon, segMethod: res.meta?.method }
            : c
        )
      );
      setNotice(`${selectedCandidate.class_name} のSegを生成しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segmentation failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!selectedCandidate) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const key = event.key;
      if (key === "Enter") {
        event.preventDefault();
        if (!manualClassMissing) handleConfirmCandidate();
        return;
      }
      if (key === "Backspace" || key === "Delete") {
        event.preventDefault();
        handleRejectCandidate();
        return;
      }
      if (key === "n" || key === "N") {
        event.preventDefault();
        handleNextCandidate();
        return;
      }
      if (key === "s" || key === "S") {
        event.preventDefault();
        handleSegCandidate();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        setSelectedCandidateId(null);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selectedCandidate, manualClassMissing]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          setAnnotationRedoStack((redoPrev) => {
            if (redoPrev.length === 0) return redoPrev;
            const next = redoPrev[redoPrev.length - 1];
            setAnnotationUndoStack((undoPrev) => [...undoPrev, cloneAnnotations(annotations)]);
            setAnnotations(next);
            return redoPrev.slice(0, -1);
          });
        } else {
          setAnnotationUndoStack((undoPrev) => {
            if (undoPrev.length === 0) return undoPrev;
            const next = undoPrev[undoPrev.length - 1];
            setAnnotationRedoStack((redoPrev) => [...redoPrev, cloneAnnotations(annotations)]);
            setAnnotations(next);
            return undoPrev.slice(0, -1);
          });
        }
        return;
      }
      if (isMeta && (event.key.toLowerCase() === "y")) {
        event.preventDefault();
        setAnnotationRedoStack((redoPrev) => {
          if (redoPrev.length === 0) return redoPrev;
          const next = redoPrev[redoPrev.length - 1];
          setAnnotationUndoStack((undoPrev) => [...undoPrev, cloneAnnotations(annotations)]);
          setAnnotations(next);
          return redoPrev.slice(0, -1);
        });
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedAnnotationId && !selectedCandidateId) {
        event.preventDefault();
        pushAnnotationHistory();
        setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
        return;
      }
      if (event.key === "Escape") {
        setSelectedAnnotationId(null);
        if (pendingManualBBox) {
          setPendingManualBBox(null);
          setPendingManualClass("");
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [annotations, selectedAnnotationId, selectedCandidateId, pendingManualBBox]);

  const pickUniqueColor = (existing: Record<string, string>) => {
    const used = new Set(Object.values(existing));
    for (let i = 0; i < 20; i += 1) {
      const hue = Math.floor(Math.random() * 360);
      const color = normalizeToHex(`hsl(${hue}, 70%, 50%)`);
      if (!used.has(color)) return color;
    }
    return "#000000";
  };

  const loadColorMapForProject = (projectName: string) => {
    try {
      const raw = localStorage.getItem(`draftseeker.colorMap.${projectName}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const saveColorMapForProject = (projectName: string, next: Record<string, string>) => {
    try {
      localStorage.setItem(`draftseeker.colorMap.${projectName}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const buildColorMapFromClasses = (classes: string[]) => {
    const next: Record<string, string> = {};
    classes.forEach((name) => {
      if (!next[name]) next[name] = pickUniqueColor(next);
    });
    return next;
  };

  const loadAdvancedSettingsForProject = (projectName: string) => {
    try {
      const raw = localStorage.getItem(`draftseeker.advanced.${projectName}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        roiSize?: number;
        topk?: number;
        scaleMin?: number;
        scaleMax?: number;
        scaleSteps?: number;
        excludeEnabled?: boolean;
        excludeMode?: "same_class" | "any_class";
        excludeCenter?: boolean;
        excludeIouThreshold?: number;
        refineContour?: boolean;
      };
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const saveAdvancedSettingsForProject = (projectName: string) => {
    try {
      const payload = {
        roiSize,
        topk,
        scaleMin,
        scaleMax,
        scaleSteps,
        excludeEnabled,
        excludeMode,
        excludeCenter,
        excludeIouThreshold,
        refineContour,
      };
      localStorage.setItem(`draftseeker.advanced.${projectName}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const loadAutoSettingsForProject = (projectName: string) => {
    try {
      const raw = localStorage.getItem(`draftseeker.auto.${projectName}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        autoThreshold?: number;
        autoMethod?: "combined" | "scaled_templates";
        autoClassFilter?: string[];
      };
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const saveAutoSettingsForProject = (projectName: string) => {
    try {
      const payload = {
        autoThreshold,
        autoMethod,
        autoClassFilter,
      };
      localStorage.setItem(`draftseeker.auto.${projectName}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const normalizeLoadedAnnotations = (items: Annotation[]) => {
    const now = Date.now();
    return items.map((ann, idx) => ({
      id: ann.id || `${now}-${Math.random()}-${idx}`,
      class_name: ann.class_name,
      bbox: ann.bbox,
      source: ann.source || "template",
      created_at: ann.created_at || new Date().toISOString(),
      score: ann.score,
      segPolygon: ann.segPolygon,
      originalSegPolygon: ann.originalSegPolygon,
      segMethod: ann.segMethod,
    }));
  };

  const loadDatasetImage = async (projectName: string, filename: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await selectDatasetImage({ project_name: projectName, filename });
      setImageId(res.image_id);
      setImageUrl(`${API_BASE}/dataset/${projectName}/image/${encodeURIComponent(filename)}`);
      setImageSize({ w: res.width, h: res.height });
      setCandidates([]);
      setSelectedCandidateId(null);
      setSelectedAnnotationId(null);
      setDatasetSelectedName(filename);
      isLoadingAnnotationsRef.current = true;
      const loaded = await loadAnnotations({ project_name: projectName, image_key: filename });
      setAnnotations(normalizeLoadedAnnotations(loaded.annotations || []));
      isLoadingAnnotationsRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dataset select failed");
    } finally {
      setBusy(false);
    }
  };

  const loadAllAnnotationCounts = async (projectName: string, images: DatasetImageEntry[]) => {
    if (!projectName || images.length === 0) return;
    try {
      const entries = await Promise.all(
        images.map(async (entry) => {
          const name = entry.original_filename || entry.filename || "";
          if (!name) return null;
          try {
            const loaded = await loadAnnotations({ project_name: projectName, image_key: name });
            return [name, loaded.annotations?.length || 0] as const;
          } catch {
            return [name, 0] as const;
          }
        })
      );
      const next: Record<string, number> = {};
      entries.forEach((item) => {
        if (!item) return;
        next[item[0]] = item[1];
      });
      setImageStatusMap(next);
    } catch {
      // ignore
    }
  };

  const handleAutoAnnotate = async () => {
    if (!imageId || !datasetId || !datasetSelectedName || !project) {
      setError("画像またはプロジェクトが選択されていません");
      return;
    }
    setError(null);
    setAutoRunning(true);
    setAutoResult(null);
    setLastAutoAddedIds([]);
    setAutoProgress(0);
    if (autoProgressTimerRef.current) {
      window.clearInterval(autoProgressTimerRef.current);
    }
    autoProgressTimerRef.current = window.setInterval(() => {
      setAutoProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 5;
      });
    }, 400);
    try {
      const clipped = Math.max(0, Math.min(1, autoThreshold));
      const strideValue = autoStride && autoStride > 0 ? autoStride : undefined;
      const res = await autoAnnotate({
        image_id: imageId,
        project,
        threshold: clipped,
        method: autoMethod,
        roi_size: roiSize,
        class_filter: autoClassFilter.length > 0 ? autoClassFilter : undefined,
        scale_min: scaleMin,
        scale_max: scaleMax,
        scale_steps: scaleSteps,
        stride: strideValue,
        project_name: datasetId,
        image_key: datasetSelectedName,
      });
      setAutoResult({
        added: res.added_count,
        rejected: res.rejected_count,
        threshold: res.threshold,
      });
      if (res.created_annotations && res.created_annotations.length > 0) {
        const createdAt = new Date().toISOString();
        const appended = res.created_annotations.map((item, idx) => ({
          id: `${Date.now()}-${Math.random()}-${idx}`,
          class_name: item.class_name,
          bbox: item.bbox,
          source: "template",
          created_at: createdAt,
          score: item.score,
        }));
        setLastAutoAddedIds(appended.map((item) => item.id));
        setAnnotations((prev) => [...prev, ...appended]);
      } else {
        const loaded = await loadAnnotations({
          project_name: datasetId,
          image_key: datasetSelectedName,
        });
        setAnnotations(normalizeLoadedAnnotations(loaded.annotations || []));
      }
      setAutoBaseline({
        autoThreshold,
        autoMethod,
        autoClassFilter: [...autoClassFilter],
        autoStride,
        scaleMin,
        scaleMax,
        scaleSteps,
        roiSize,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto annotate failed");
    } finally {
      setAutoRunning(false);
      setAutoProgress(100);
      if (autoProgressTimerRef.current) {
        window.clearInterval(autoProgressTimerRef.current);
        autoProgressTimerRef.current = null;
      }
    }
  };

  const handleUndoAutoAnnotate = () => {
    if (lastAutoAddedIds.length === 0) return;
    pushAnnotationHistory();
    setAnnotations((prev) => prev.filter((ann) => !lastAutoAddedIds.includes(ann.id)));
    setCheckedAnnotationIds((prev) => prev.filter((id) => !lastAutoAddedIds.includes(id)));
    setLastAutoAddedIds([]);
    setNotice("直前の全自動追加分を取り消しました");
  };


  const handleSelectAnnotation = (annotation: Annotation) => {
    setSelectedAnnotationId(annotation.id);
    setSegEditMode(false);
    setSelectedVertexIndex(null);
    setSegUndoStack([]);
    setShowSegVertices(true);
    setHighlightAnnotationId(annotation.id);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightAnnotationId(null);
      highlightTimerRef.current = null;
    }, 1500);
    const centerX = annotation.bbox.x + annotation.bbox.w / 2;
    const centerY = annotation.bbox.y + annotation.bbox.h / 2;
    canvasRef.current?.panTo(centerX, centerY);
  };

  const handleSegUndo = () => {
    if (segUndoStack.length === 0 || !selectedAnnotation) return;
    const last = segUndoStack[segUndoStack.length - 1];
    setSegUndoStack((prev) => prev.slice(0, -1));
    setAnnotations((prev) =>
        prev.map((a) =>
          a.id === selectedAnnotation.id
            ? { ...a, segPolygon: last.map((p: { x: number; y: number }) => ({ ...p })) }
            : a
        )
      );
  };

  const handleSegReset = () => {
    if (!selectedAnnotation?.originalSegPolygon) return;
    const reset = selectedAnnotation.originalSegPolygon.map((p: { x: number; y: number }) => ({
      ...p,
    }));
    setSegUndoStack([]);
    setAnnotations((prev) =>
      prev.map((a) => (a.id === selectedAnnotation.id ? { ...a, segPolygon: reset } : a))
    );
  };

  const sameAnnotationShape = (a?: Annotation, b?: Annotation) => {
    if (!a || !b) return false;
    if (
      a.bbox.x !== b.bbox.x ||
      a.bbox.y !== b.bbox.y ||
      a.bbox.w !== b.bbox.w ||
      a.bbox.h !== b.bbox.h
    ) {
      return false;
    }
    const ap = a.segPolygon;
    const bp = b.segPolygon;
    if (!ap && !bp) return true;
    if (!ap || !bp) return false;
    if (ap.length !== bp.length) return false;
    for (let i = 0; i < ap.length; i += 1) {
      if (ap[i].x !== bp[i].x || ap[i].y !== bp[i].y) return false;
    }
    return true;
  };

  const applySegSimplify = () => {
    if (!selectedAnnotation?.segPolygon) return;
    let next = selectedAnnotation.segPolygon;
    if (imageSize) {
      next = clampToImage(next, imageSize.w, imageSize.h);
    }
    next = simplifyPolygon(next, segSimplifyEps);
    setAnnotations((prev) =>
      prev.map((a) => (a.id === selectedAnnotation.id ? { ...a, segPolygon: next } : a))
    );
  };

  useEffect(() => {
    if (!datasetSelectedName) return;
    setImageStatusMap((prev) => ({
      ...prev,
      [datasetSelectedName]: annotations.length,
    }));
  }, [annotations.length, datasetSelectedName]);

  useEffect(() => {
    if (!showDebug) {
      setTemplatePreviewBase64(null);
      return;
    }
    const candidate = candidates.find((c) => c.id === selectedCandidateId);
    if (!candidate || !project) {
      setTemplatePreviewBase64(null);
      return;
    }
    const cacheKey = `${project}::${candidate.class_name}::${candidate.template}`;
    const cached = templatePreviewCacheRef.current.get(cacheKey);
    if (cached) {
      setTemplatePreviewBase64(cached);
      return;
    }
    setTemplatePreviewBase64(null);
    let cancelled = false;
    fetchTemplatePreview(project, candidate.class_name, candidate.template)
      .then((res) => {
        if (cancelled) return;
        if (res?.base64) {
          templatePreviewCacheRef.current.set(cacheKey, res.base64);
          setTemplatePreviewBase64(res.base64);
        } else {
          setTemplatePreviewBase64(null);
        }
      })
      .catch(() => {
        if (!cancelled) setTemplatePreviewBase64(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showDebug, selectedCandidateId, candidates, project]);

  useEffect(() => {
    if (!selectedAnnotationId) return;
    const el = annotationRowRefs.current[selectedAnnotationId];
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedAnnotationId]);

  useEffect(() => {
    if (!datasetId || !datasetSelectedName) return;
    if (isLoadingAnnotationsRef.current) return;
    const payload = {
      project_name: datasetId,
      image_key: datasetSelectedName,
      annotations,
    };
    saveAnnotations(payload).catch(() => {
      // ignore save errors for now
    });
  }, [annotations, datasetId, datasetSelectedName]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState));
    } catch {
      // ignore
    }
  }, [viewState]);

  useEffect(() => {
    if (!notice) return;
    setNoticeVisible(true);
    const timer = window.setTimeout(() => {
      setNoticeVisible(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!datasetId) return;
    if (Object.keys(colorMap).length === 0) return;
    saveColorMapForProject(datasetId, colorMap);
  }, [colorMap, datasetId]);

  useEffect(() => {
    if (!datasetId) return;
    const saved = loadAdvancedSettingsForProject(datasetId);
    const baseline = {
      roiSize: typeof saved?.roiSize === "number" ? saved.roiSize : DEFAULT_ROI_SIZE,
      topk: typeof saved?.topk === "number" ? saved.topk : DEFAULT_TOPK,
      scaleMin: typeof saved?.scaleMin === "number" ? saved.scaleMin : DEFAULT_SCALE_MIN,
      scaleMax: typeof saved?.scaleMax === "number" ? saved.scaleMax : DEFAULT_SCALE_MAX,
      scaleSteps:
        typeof saved?.scaleSteps === "number" ? saved.scaleSteps : DEFAULT_SCALE_STEPS,
      excludeEnabled: typeof saved?.excludeEnabled === "boolean" ? saved.excludeEnabled : true,
      excludeMode:
        saved?.excludeMode === "same_class" || saved?.excludeMode === "any_class"
          ? saved.excludeMode
          : "same_class",
      excludeCenter: typeof saved?.excludeCenter === "boolean" ? saved.excludeCenter : true,
      excludeIouThreshold:
        typeof saved?.excludeIouThreshold === "number" ? saved.excludeIouThreshold : 0.6,
      refineContour: typeof saved?.refineContour === "boolean" ? saved.refineContour : false,
    };
    setAdvancedBaseline(baseline);
    setRoiSize(baseline.roiSize);
    setTopk(baseline.topk);
    setScaleMin(baseline.scaleMin);
    setScaleMax(baseline.scaleMax);
    setScaleSteps(baseline.scaleSteps);
    setExcludeEnabled(baseline.excludeEnabled);
    setExcludeMode(baseline.excludeMode);
    setExcludeCenter(baseline.excludeCenter);
    setExcludeIouThreshold(baseline.excludeIouThreshold);
    setRefineContour(baseline.refineContour);
  }, [datasetId]);

  useEffect(() => {
    if (!datasetId) return;
    const saved = loadAutoSettingsForProject(datasetId);
    const baseline = {
      autoThreshold:
        typeof saved?.autoThreshold === "number" ? saved.autoThreshold : 0.7,
      autoMethod: saved?.autoMethod ? saved.autoMethod : "combined",
      autoClassFilter: Array.isArray(saved?.autoClassFilter) ? saved.autoClassFilter : [],
      autoStride: null,
      scaleMin,
      scaleMax,
      scaleSteps,
      roiSize,
    };
      setAutoBaseline(baseline);
      setAutoThreshold(baseline.autoThreshold);
      setAutoMethod(baseline.autoMethod);
      setAutoClassFilter(baseline.autoClassFilter);
      setAutoStride(baseline.autoStride);
  }, [datasetId]);

  useEffect(() => {
    if (!datasetId) return;
    saveAdvancedSettingsForProject(datasetId);
  }, [
    datasetId,
    roiSize,
    topk,
    scaleMin,
    scaleMax,
    scaleSteps,
    excludeEnabled,
    excludeMode,
    excludeCenter,
    excludeIouThreshold,
    refineContour,
  ]);

  useEffect(() => {
    if (!datasetId) return;
    saveAutoSettingsForProject(datasetId);
  }, [datasetId, autoThreshold, autoMethod, autoClassFilter]);

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        window.clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showExportDrawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeExportDrawer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showExportDrawer]);

  return (
    <div
      className="appRoot"
      style={{
        fontFamily: "\"IBM Plex Sans\", system-ui, sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <style>{`
        :root {
          --bg: #f3f6fb;
          --panel: #ffffff;
          --panel2: #f7f9fc;
          --border: #e1e6ef;
          --text: #0b1f3a;
          --muted: #6b7a90;
          --primary: #2b74ff;
          --primary-2: #35c4ff;
          --danger: #e15656;
          --warning: #f59e0b;
          --warning-bg: #fff7e6;
          --shadow: 0 10px 24px rgba(7, 20, 40, 0.08);
          --radius: 12px;
        }
        .topBar {
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          box-shadow: 0 6px 16px rgba(7, 20, 40, 0.06);
        }
        .panelShell {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
        }
        .sectionCard {
          background: var(--panel) !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius) !important;
          box-shadow: var(--shadow) !important;
          padding: 12px;
        }
        .sectionCard.muted {
          background: var(--panel2) !important;
        }
        .sectionTitle {
          font-weight: 700;
          color: var(--text);
          font-size: 12px;
          margin-bottom: 8px;
        }
        .hintText {
          font-size: 11px;
          color: var(--muted);
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          justify-content: flex-end;
        }
        .badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel2);
          color: var(--muted);
          line-height: 1.2;
        }
        .badgeWarn {
          border-color: #ffd8a8;
          background: #fff4e0;
          color: #a15c00;
        }
        .badgeDanger {
          border-color: #ffc2c2;
          background: #ffe8e8;
          color: #b00020;
        }
        .warnInput {
          border-color: #f5c168 !important;
          box-shadow: 0 0 0 2px rgba(245, 193, 104, 0.18) !important;
        }
        .dangerInput {
          border-color: var(--warning) !important;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15) !important;
        }
        .btn {
          border-radius: 10px;
          border: 1px solid transparent;
          padding: 0 12px;
          height: 32px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 120ms ease;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
        }
        .btnPrimary {
          background: linear-gradient(120deg, var(--primary), var(--primary-2)) !important;
          color: #fff !important;
          border-color: transparent !important;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.18);
          transition: all 120ms ease;
        }
        .btnSecondary {
          background: var(--panel2) !important;
          color: var(--text) !important;
          border-color: var(--border) !important;
        }
        .btnDanger {
          background: var(--danger) !important;
          color: #fff !important;
          border-color: transparent !important;
        }
        .btnGhost {
          background: transparent !important;
          border-color: var(--border) !important;
          color: var(--text) !important;
          box-shadow: none !important;
        }
        .btnSpecial {
          background: linear-gradient(120deg, #6a5cff, #2b74ff) !important;
          color: #fff !important;
          border-color: transparent !important;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
        .btn:hover:not(:disabled) {
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.10);
          filter: brightness(1.03);
        }
        .btn:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
          filter: brightness(0.98);
        }
        .btn:focus-visible {
          outline: 2px solid rgba(53, 196, 255, 0.5);
          outline-offset: 2px;
        }
        .sectionTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
          color: var(--muted);
        }
        .sectionBody {
          margin-top: 8px;
        }
        .warningCard {
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .warningYellow {
          background: #fff7d6;
          color: #9a7b00;
          border-color: #f5dda0;
          border-left: 4px solid #f0c75e;
        }
        .warningOrange {
          background: #ffe9d8;
          color: #b25b00;
          border-color: #ffc79f;
          border-left: 4px solid #f29d50;
        }
        .warningRed {
          background: #ffe1e1;
          color: #b00020;
          border-color: #ffb3b3;
          border-left: 4px solid #e15656;
        }
        .drawerFooter {
          position: sticky;
          bottom: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 12px 14px;
          border-top: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 -8px 18px rgba(15, 23, 42, 0.10);
        }
        .drawerMetaLine {
          font-size: 12px;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rightPanel {
          min-height: 0;
          height: calc(100vh - var(--topbar-h, 72px) - 24px);
        }
        .confirmedSection {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-height: 0;
        }
        .confirmedBody {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-height: 0;
        }
        .confirmedList {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
          padding-right: 4px;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
        }
        .confirmedRow {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          min-width: 0;
        }
        .inputCompact {
          width: 84px;
          text-align: right;
        }
        .inputMid {
          width: 96px;
          text-align: right;
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        .rightPanel {
          overflow-x: hidden;
        }
        .rightPanel,
        .rightPanel * {
          box-sizing: border-box;
        }
        .rightPanel input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
        .rightPanel select,
        .rightPanel textarea {
          font-size: 13px;
        }
        .rightPanel .formRow {
          display: grid;
          grid-template-columns: 104px 1fr;
          gap: 8px;
          align-items: center;
        }
        .rightPanel .controlWrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          width: 100%;
        }
        .rightPanel .controlStack {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-end;
          width: 100%;
        }
        .rightPanel .miniLabel {
          font-size: 11px;
          color: #607d8b;
          min-width: 28px;
          text-align: right;
        }
        .rightPanel .numInput {
          width: 84px !important;
          max-width: 84px !important;
          text-align: center;
        }
        .rightPanel .midInput {
          width: 120px !important;
          max-width: 120px !important;
          text-align: center;
        }
        .rightPanel .stepBtn {
          width: 36px !important;
          height: 36px !important;
        }
        .rightPanel .autoAdvanced {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .rightPanel .autoAdvanced .autoMethodCard {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .rightPanel .autoAdvanced .autoMethodHelp {
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .noWrapRow {
          flex-wrap: nowrap !important;
          gap: 6px;
        }
      `}</style>
      <div
        className="topBar"
        style={{
          padding: "12px 20px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <img
              src="/lgo_DraftSeeker.png"
              alt="DraftSeeker"
              style={{ height: 36, width: "auto", display: "block" }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            {datasetId && (
                <button
                  type="button"
                  onClick={handleBackToHome}
                  className="btn btnSecondary"
                  style={{
                  height: 30,
                  padding: "0 10px",
                }}
                >
                  Project Homeへ戻る
                </button>
            )}
            {datasetId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!exportOutputDir.trim()) {
                      setExportOutputDir("~/Downloads");
                    }
                    setExportResult(null);
                    setShowExportDrawer(true);
                  }}
                  className="btn btnSecondary"
                  style={{
                    height: 30,
                    padding: "0 10px",
                  }}
                >
                  Export dataset
                </button>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 30,
                    padding: "4px 6px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--panel2)",
                    opacity: 0.9,
                  }}
                >
                  <span style={{ fontSize: 11 }}>テンプレート</span>
                  <select
                    value={project}
                    onChange={(e) => handleProjectTemplateChange(e.target.value)}
                    disabled={!projectChangeUnlocked}
                    style={{
                      minWidth: 120,
                      height: 22,
                      fontSize: 11,
                      opacity: projectChangeUnlocked ? 1 : 0.6,
                      cursor: projectChangeUnlocked ? "pointer" : "not-allowed",
                    }}
                  >
                    {projects.length === 0 && (
                      <option key="project-none" value="">
                        (none)
                      </option>
                    )}
                    {asChildren(
                      projects.map((p, idx) => (
                        <option key={`${p}-${idx}`} value={p}>
                          {p}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn btnGhost"
                    style={{ height: 22, padding: "0 8px", fontSize: 10 }}
                    onClick={() => {
                      if (projects.length <= 1) {
                        setNotice("現在は1種類のため変更不要です");
                        return;
                      }
                      setProjectChangeUnlocked(true);
                    }}
                  >
                    変更…
                  </button>
                </label>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 30,
                    padding: "4px 6px",
                    border: "1px solid #e3e3e3",
                    borderRadius: 8,
                    background: "#fafafa",
                  }}
                >
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    {...({
                      webkitdirectory: "true",
                      directory: "true",
                    } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={handleFolderImport}
                    style={{ display: "none" }}
                    disabled={!datasetId}
                  />
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={!datasetId}
                    className="btn btnSecondary"
                    style={{
                      height: 22,
                      padding: "0 8px",
                      fontSize: 11,
                      cursor: datasetId ? "pointer" : "not-allowed",
                      opacity: datasetId ? 1 : 0.6,
                    }}
                  >
                    画像取り込み
                  </button>
                  <span style={{ fontSize: 11, color: "#666" }}>
                    {lastImportPath ? lastImportPath : "未取込"}
                  </span>
                </label>
              </>
            )}
          </div>
        </div>
        {datasetImporting && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            Dataset import中...
          </div>
        )}
      </div>

      {datasetId && (
        <div
          ref={headerScrollRef}
          onWheel={(e) => {
            if (!headerScrollRef.current) return;
            headerScrollRef.current.scrollLeft += e.deltaY;
            e.preventDefault();
          }}
          style={{
            padding: "8px 20px",
            borderBottom: "1px solid #eee",
            background: "#fff",
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        />
      )}
      {showExportDrawer && (
        <>
          <div
            onClick={closeExportDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              zIndex: 40,
            }}
          />
          <div
            className="panelShell"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100vh",
              width: 420,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="sectionTitle">Export dataset</div>
              <button
                type="button"
                onClick={closeExportDrawer}
                className="btn btnGhost"
                style={{
                  fontSize: 18,
                  width: 32,
                  height: 32,
                  padding: 0,
                  boxShadow: "none",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16, overflowY: "auto", display: "grid", gap: 12 }}>
              <div className="sectionCard muted" style={{ pointerEvents: "none" }}>
                <div className="sectionTitle">Summary</div>
                <div className="sectionBody" style={{ fontSize: 12, color: "var(--muted)" }}>
                <div>Project: {project || "-"}</div>
                <div>Dataset: {datasetInfo?.project_name || "-"}</div>
                <div>Total images: {totalImages}</div>
                <div>Annotated images: {annotatedImages}</div>
                <div>Total annotations: {totalAnnotations}</div>
                <div>Classes: {classesCount}</div>
                <div>Negative include: {includeNegatives ? "ON" : "OFF"}</div>
                </div>
              </div>

              <div className="sectionCard">
                <button
                  type="button"
                  onClick={() => setShowSplitSettings((prev) => !prev)}
                  className="btn btnGhost"
                  style={{
                    width: "100%",
                    height: 32,
                    marginBottom: 8,
                  }}
                >
                  Split settings
                </button>
                {showSplitSettings && (
                  <div className="sectionBody">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Train</span>
                        <input
                          type="number"
                          min={0}
                          value={splitTrain}
                          onChange={(e) => setSplitTrain(Number(e.target.value))}
                          className="inputCompact"
                          style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" }}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Val</span>
                        <input
                          type="number"
                          min={0}
                          value={splitVal}
                          onChange={(e) => setSplitVal(Number(e.target.value))}
                          className="inputCompact"
                          style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" }}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Test</span>
                        <input
                          type="number"
                          min={0}
                          value={splitTest}
                          onChange={(e) => setSplitTest(Number(e.target.value))}
                          className="inputCompact"
                          style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" }}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#666" }}>Seed</span>
                      <input
                        type="number"
                        value={splitSeed}
                        onChange={(e) => setSplitSeed(Number(e.target.value))}
                        className="inputMid"
                        style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={includeNegatives}
                        onChange={(e) => setIncludeNegatives(e.target.checked)}
                      />
                      <span style={{ fontSize: 12 }}>未アノテ（ネガティブ）を含める</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="sectionCard">
                <div className="sectionTitle">Dataset type</div>
                <div className="sectionBody">
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <input
                    type="radio"
                    name="datasetType"
                    checked={datasetType === "bbox"}
                    onChange={() => setDatasetType("bbox")}
                  />
                  <span style={{ fontSize: 12 }}>bbox (YOLO)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#999" }}>
                  <input type="radio" name="datasetType" checked={datasetType === "seg"} disabled />
                  <span style={{ fontSize: 12 }}>seg (disabled)</span>
                </label>
                </div>
              </div>

              <div className="sectionCard">
                <div className="sectionTitle">Output directory</div>
                <div className="sectionBody" style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    ref={exportDirInputRef}
                    type="file"
                    multiple
                    {...({
                      webkitdirectory: "true",
                      directory: "true",
                    } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={handleExportDirPicked}
                    style={{ display: "none" }}
                  />
                  <input
                    type="text"
                    placeholder="/Users/you/exports"
                    value={exportOutputDir}
                    onChange={(e) => setExportOutputDir(e.target.value)}
                    style={{ height: 32, padding: "0 8px", flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleBrowseExportDir}
                    className="btn btnSecondary"
                    style={{
                      height: 32,
                      padding: "0 10px",
                    }}
                  >
                    Browse...
                  </button>
                </div>
                {exportDirHistory.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#666" }}>履歴</span>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setExportOutputDir(e.target.value);
                        }
                      }}
                      style={{
                        height: 28,
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        padding: "0 6px",
                        background: "var(--panel)",
                      }}
                    >
                      <option value="">選択してください</option>
                      {exportDirHistory.map((dir, idx) => (
                        <option key={`${dir}-${idx}`} value={dir}>
                          {dir}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                </div>
              </div>

              <div className="sectionCard">
                <div className="sectionTitle">Validation & Warnings</div>
                <div className="sectionBody">
                {asChildren(
                  exportErrors.map((msg, idx) => (
                    <div
                      key={`${msg}-${idx}`}
                      className="warningCard warningRed"
                    >
                      <span style={{ fontWeight: 700, fontSize: 11 }}>ERROR</span>
                      {msg}
                    </div>
                  ))
                )}
                {asChildren(
                  exportWarnings.map((w, idx) => (
                    <div
                      key={`${w.text}-${idx}`}
                      className={`warningCard ${
                        w.level === "orange" ? "warningOrange" : "warningYellow"
                      }`}
                    >
                      <span style={{ fontWeight: 700, fontSize: 11 }}>
                        {w.level === "orange" ? "CAUTION" : "WARN"}
                      </span>
                      {w.text}
                    </div>
                  ))
                )}
                {exportErrors.length === 0 && exportWarnings.length === 0 && (
                  <div style={{ fontSize: 12, color: "#666" }}>問題は検出されていません。</div>
                )}
                </div>
              </div>

              <div className="sectionCard muted" style={{ pointerEvents: "none" }}>
                <div className="sectionTitle">Export summary</div>
                <div className="sectionBody" style={{ fontSize: 12, color: "var(--muted)" }}>
                <div>Train: {splitSummary.train} images</div>
                <div>Val: {splitSummary.val} images</div>
                <div>Test: {splitSummary.test} images</div>
                <div style={{ marginTop: 6 }}>Output: {exportOutputDir || "-"}</div>
                <div>Folder: {exportFolderName}</div>
                </div>
              </div>
            </div>
            <div className="drawerFooter">
              {(exportErrors.length > 0 || exportWarnings.length > 0) && (
                <div
                  className={`warningCard ${
                    exportErrors.length > 0
                      ? "warningRed"
                      : exportWarnings[0]?.level === "orange"
                        ? "warningOrange"
                        : "warningYellow"
                  }`}
                  style={{ lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  <span style={{ fontWeight: 700, fontSize: 11 }}>
                    {exportErrors.length > 0
                      ? "ERROR"
                      : exportWarnings[0]?.level === "orange"
                        ? "CAUTION"
                        : "WARN"}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {exportErrors.length > 0
                      ? exportErrors[0]
                      : exportWarnings[0]?.text || "警告があります"}
                  </span>
                </div>
              )}
              <div className="drawerMetaLine">
                Output: {exportOutputDir || "-"}  |  Folder: {exportFolderName}
              </div>
              <button
                type="button"
                onClick={datasetType === "seg" ? handleExportDatasetSeg : handleExportDatasetBBox}
                disabled={!canExport || busy}
                className="btn btnPrimary"
                style={{
                  width: "100%",
                  height: 40,
                  fontWeight: 700,
                }}
              >
                {busy ? "Exporting..." : "Export dataset"}
              </button>
              {exportResult && (
                <div
                  style={{
                    fontSize: 12,
                    color: exportResult.ok ? "#2e7d32" : "#b00020",
                    wordBreak: "break-all",
                  }}
                >
                  {exportResult.ok ? `✅ ${exportResult.message}` : `❌ ${exportResult.message}`}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showHints && (
        <div
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e0e0e0",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 11,
            color: "#444",
            zIndex: 30,
            boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
            maxWidth: 220,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>操作ヒント</div>
            <button
              type="button"
              onClick={dismissHints}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                color: "#666",
                padding: 0,
              }}
              aria-label="Close hints"
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 6, lineHeight: 1.5 }}>
            <div>Ctrl+Wheel: Zoom</div>
            <div>Space+Drag: Pan</div>
            <div>Shift+Drag: Manual BBox</div>
            <div>Enter: Confirm / Del: Reject</div>
            <div>N: Next / S: Seg</div>
          </div>
        </div>
      )}

      {datasetId ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr 400px",
            gap: 16,
            padding: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            className="panelShell"
            style={{
              padding: 12,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              Dataset
              {datasetInfo?.project_name ? `: ${datasetInfo.project_name}` : ""}
            </div>
            {!datasetInfo && (
              <div style={{ fontSize: 12, color: "#666" }}>
                親フォルダを読み込むとサムネ一覧が表示されます。
              </div>
            )}
            {datasetInfo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {asChildren(datasetInfo.images.map((entry: DatasetImageEntry, idx: number) => {
                  const name = entry.original_filename || entry.filename || "";
                  const indexLabel = entry.internal_id || "000";
                  if (!name) {
                    return null;
                  }
                  const count = imageStatusMap[name] || 0;
                  const isDone = count > 0;
                  const isActive = datasetSelectedName === name;
                  const width = typeof entry.width === "number" ? entry.width : null;
                  const height = typeof entry.height === "number" ? entry.height : null;
                  const sizeLabel =
                    width !== null && height !== null ? `${width}×${height}` : "-";
                  return (
                    <div
                      key={`${name || entry.internal_id || "image"}-${idx}`}
                      onClick={() => handleSelectDatasetImage(name)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "54px 1fr",
                        gap: 6,
                        padding: 4,
                        borderRadius: 8,
                        border: isActive ? "1px solid #1a73e8" : "1px solid #e3e3e3",
                        background: isActive ? "#eef6ff" : "#fff",
                        cursor: "pointer",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 6,
                          overflow: "hidden",
                          background: "#f4f4f4",
                          border: "1px solid #e6e6e6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          color: "#666",
                        }}
                      >
                        <img
                          src={`${API_BASE}/dataset/${datasetId}/image/${encodeURIComponent(name)}`}
                          alt={name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>
                            ID: {indexLabel}{" "}
                            <span
                              style={{
                                fontSize: 10,
                                marginLeft: 6,
                                padding: "2px 6px",
                                borderRadius: 10,
                                background: isDone ? "#e8f5e9" : "#f1f1f1",
                                color: isDone ? "#2e7d32" : "#666",
                              }}
                            >
                              {isDone ? `済 ${count}` : "未"}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: "#666" }}>File: {name}</div>
                          <div style={{ fontSize: 10, color: "#888" }}>Size: {sizeLabel}</div>
                      </div>
                    </div>
                  );
                }))}
              </div>
            )}
          </div>

          <div
            style={{
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              opacity: showExportDrawer ? 0.45 : 1,
              filter: showExportDrawer ? "grayscale(0.6)" : "none",
              transition: "opacity 160ms ease, filter 160ms ease",
            }}
            onPointerDown={() => setIsCanvasInteracting(true)}
            onPointerUp={() => setIsCanvasInteracting(false)}
            onPointerLeave={() => setIsCanvasInteracting(false)}
            onWheel={() => {
              setIsCanvasInteracting(true);
              if (interactionTimeoutRef.current) {
                window.clearTimeout(interactionTimeoutRef.current);
              }
              interactionTimeoutRef.current = window.setTimeout(() => {
                setIsCanvasInteracting(false);
              }, 140);
            }}
          >
            {error && (
              <div style={{ marginBottom: 12, color: "#b00020" }}>Error: {error}</div>
            )}
            <div style={{ position: "sticky", top: 0 }}>
              <div style={{ position: "relative" }}>
                <ImageCanvas
                  ref={canvasRef}
                  imageUrl={imageUrl}
                  candidates={candidates}
                  selectedCandidateId={selectedCandidateId}
                  annotations={filteredAnnotations}
                  selectedAnnotationId={selectedAnnotationId}
                  colorMap={colorMap}
                  showCandidates={showCandidates}
                  showAnnotations={showAnnotations}
                  editablePolygon={segEditMode ? selectedAnnotation?.segPolygon || null : null}
                  editMode={segEditMode}
                  showVertices={showSegVertices}
                  selectedVertexIndex={selectedVertexIndex}
                  highlightAnnotationId={highlightAnnotationId}
                  onSelectVertex={setSelectedVertexIndex}
                  onUpdateEditablePolygon={(next) => {
                    if (!selectedAnnotation) return;
                    setAnnotations((prev) =>
                      prev.map((a) =>
                        a.id === selectedAnnotation.id ? { ...a, segPolygon: next } : a
                      )
                    );
                  }}
                  onVertexDragStart={() => {
                    if (!selectedAnnotation?.segPolygon) return;
                    setSegUndoStack((prev) => [
                      ...prev,
                      selectedAnnotation.segPolygon!.map((p: { x: number; y: number }) => ({
                        ...p,
                      })),
                    ]);
                  }}
                  onClickPoint={handleClickPoint}
                  onCreateManualBBox={(bbox) => {
                    setPendingManualBBox(bbox);
                    setPendingManualClass("");
                    setSelectedCandidateId(null);
                    setSelectedAnnotationId(null);
                  }}
                  onManualCreateStateChange={setIsCreatingManualBBox}
                  onResizeSelectedBBox={(bbox) => {
                    if (!selectedCandidateId) return;
                    setCandidates((prev) =>
                      prev.map((c) => (c.id === selectedCandidateId ? { ...c, bbox } : c))
                    );
                  }}
                  onResizeSelectedAnnotation={(bbox) => {
                    if (!selectedAnnotationId) return;
                    setAnnotations((prev) =>
                      prev.map((a) =>
                        a.id === selectedAnnotationId
                          ? {
                              ...a,
                              bbox: clampBBoxToImage(bbox),
                              source: a.source === "template" ? "manual" : a.source,
                            }
                          : a
                      )
                    );
                  }}
                onAnnotationEditStart={() => {
                  if (annotationEditActiveRef.current) return;
                  annotationEditActiveRef.current = true;
                  if (selectedAnnotationId) {
                    editSessionRef.current = {
                      activeId: selectedAnnotationId,
                      before: cloneAnnotations(annotations),
                    };
                  }
                }}
                onAnnotationEditEnd={() => {
                  annotationEditActiveRef.current = false;
                  const session = editSessionRef.current;
                  editSessionRef.current = null;
                  if (!session?.activeId) return;
                  const beforeAnn = session.before.find((a) => a.id === session.activeId);
                  const afterAnn = annotations.find((a) => a.id === session.activeId);
                  if (!beforeAnn || !afterAnn) return;
                  if (sameAnnotationShape(beforeAnn, afterAnn)) return;
                  setAnnotationUndoStack((prev) => [...prev, session.before]);
                  setAnnotationRedoStack([]);
                  setAnnotations((prev) =>
                    prev.map((a) =>
                      a.id === session.activeId ? { ...a, source: "manual" } : a
                    )
                  );
                }}
                  onSelectAnnotation={handleSelectAnnotation}
                  pendingManualBBox={pendingManualBBox}
                  shouldIgnoreCanvasClick={() => isCreatingManualBBox || !!pendingManualBBox}
                onDebugCoords={showDebug ? setCoordDebug : undefined}
                debugOverlay={showDebug ? detectDebug || null : null}
              />
                {selectedAnnotationId && (
                  <div
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 12,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: "rgba(11, 31, 58, 0.75)",
                      color: "#fff",
                      fontSize: 11,
                      letterSpacing: 0.2,
                      pointerEvents: "none",
                    }}
                  >
                    編集中（ドラッグで調整）
                  </div>
                )}
              </div>
            </div>
            {notice && (
              <div
                style={{
                  marginTop: 12,
                  color: "#1b5e20",
                  fontSize: 12,
                  opacity: noticeVisible ? 1 : 0,
                  transition: "opacity 400ms ease",
                }}
              >
                {notice}
              </div>
            )}
            {busy && <div style={{ marginTop: 10, color: "#666" }}>処理中...</div>}
          </div>

          <div
            className="rightPanel panelShell"
            style={{
              padding: 16,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              opacity: isCanvasInteracting ? 0.6 : 1,
              transition: "opacity 160ms ease",
              position: "relative",
            }}
          >
            {autoRunning && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(140,140,140,0.25)",
                  backdropFilter: "blur(1px)",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  padding: 10,
                  fontSize: 12,
                  color: "#0b1f3a",
                  fontWeight: 600,
                  pointerEvents: "auto",
                }}
              >
                全自動アノテーション {autoMethod === "combined" ? "Fusion Mode" : "Template Mode"} 実行中…{" "}
                {autoProgress}%
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="btn btnGhost"
                style={{
                  flex: 1,
                  height: 32,
                  background: showAdvanced ? "var(--panel2)" : "transparent",
                  borderColor: showAdvanced ? "var(--primary)" : "var(--border)",
                  color: showAdvanced ? "var(--primary)" : "inherit",
                }}
              >
                {showAdvanced ? "▼ Advanced settings" : "▶︎ Advanced settings"}
              </button>
              <button
                type="button"
                onClick={() => setShowDebug((prev) => !prev)}
                className="btn btnGhost"
                style={{
                  width: 80,
                  height: 32,
                  background: showDebug ? "var(--panel2)" : "transparent",
                  borderColor: showDebug ? "var(--primary)" : "var(--border)",
                  color: showDebug ? "var(--primary)" : "inherit",
                }}
              >
                {showDebug ? "▼ Debug" : "▶︎ Debug"}
              </button>
            </div>
            {showAdvanced && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e3e3e3" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>検出パラメータ</div>
                  {advancedDirty && advancedBaseline && (
                    <button
                      type="button"
                      className="btn btnGhost"
                      style={{ height: 24, padding: "0 8px", fontSize: 10 }}
                      onClick={() => {
                        setRoiSize(advancedBaseline.roiSize);
                        setTopk(advancedBaseline.topk);
                        setScaleMin(advancedBaseline.scaleMin);
                        setScaleMax(advancedBaseline.scaleMax);
                        setScaleSteps(advancedBaseline.scaleSteps);
                        setExcludeEnabled(advancedBaseline.excludeEnabled);
                        setExcludeMode(advancedBaseline.excludeMode);
                        setExcludeCenter(advancedBaseline.excludeCenter);
                        setExcludeIouThreshold(advancedBaseline.excludeIouThreshold);
                        setRefineContour(advancedBaseline.refineContour);
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="formRow" style={{ marginBottom: 6, alignItems: "start" }}>
                  <span style={{ fontSize: 12, paddingTop: 4 }}>スケール</span>
                  <div className="controlStack">
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }} title="±0.1">
                      <NumericInputWithButtons
                        value={scaleMin}
                        onChange={(v) => typeof v === "number" && setScaleMin(v)}
                        min={0.1}
                        step={0.1}
                        height={32}
                        inputWidth={84}
                        ariaLabel="scale min"
                        placeholder="推奨 0.4–0.8"
                        className="controlWrap"
                        inputClassName={`numInput ${scaleMinDanger ? "dangerInput" : scaleMinWarn ? "warnInput" : ""}`}
                        buttonClassName="stepBtn"
                      />
                      <span className="miniLabel" style={{ textAlign: "center" }}>min</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }} title="±0.1">
                      <NumericInputWithButtons
                        value={scaleMax}
                        onChange={(v) => typeof v === "number" && setScaleMax(v)}
                        min={0.1}
                        step={0.1}
                        height={32}
                        inputWidth={84}
                        ariaLabel="scale max"
                        placeholder="推奨 1.2–2.0"
                        className="controlWrap"
                        inputClassName={`numInput ${scaleMaxDanger ? "dangerInput" : scaleMaxWarn ? "warnInput" : ""}`}
                        buttonClassName="stepBtn"
                      />
                      <span className="miniLabel" style={{ textAlign: "center" }}>max</span>
                    </div>
                    <div className="hintText">
                      <span className="badge">推奨 min 0.4–0.8 / max 1.2–2.0</span>
                      <span className="badge badgeWarn">危険 min&lt;0.2, max&gt;3.0</span>
                      {(scaleMinWarn || scaleMaxWarn) && !scaleMinDanger && !scaleMaxDanger && (
                        <span className="badge badgeDanger">注意</span>
                      )}
                      {(scaleMinDanger || scaleMaxDanger) && (
                        <span className="badge badgeDanger">Danger</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="formRow" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12 }}>分割</span>
                  <div className="controlWrap" title="±1">
                    <NumericInputWithButtons
                      value={scaleSteps}
                      onChange={(v) => typeof v === "number" && setScaleSteps(v)}
                      min={1}
                      step={1}
                      height={32}
                      inputWidth={84}
                      ariaLabel="scale steps"
                      placeholder="推奨 6–12"
                      className="controlWrap"
                      inputClassName={`numInput ${scaleStepsDanger ? "dangerInput" : scaleStepsWarn ? "warnInput" : ""}`}
                      buttonClassName="stepBtn"
                    />
                    <span className="badge">推奨 6–12</span>
                    <span className="badge badgeWarn">危険 &gt;20</span>
                    {scaleStepsWarn && !scaleStepsDanger && <span className="badge badgeDanger">注意</span>}
                    {scaleStepsDanger && <span className="badge badgeDanger">Danger</span>}
                  </div>
                </div>
                <div className="formRow" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12 }}>上位件数</span>
                  <div className="controlWrap" title="±1">
                    <NumericInputWithButtons
                      value={topk}
                      onChange={(v) => typeof v === "number" && setTopk(v)}
                      min={1}
                      max={3}
                      step={1}
                      height={32}
                      inputWidth={84}
                      ariaLabel="topk"
                      placeholder="推奨 1–5"
                      className="controlWrap"
                      inputClassName={`numInput ${topkDanger ? "dangerInput" : topkWarn ? "warnInput" : ""}`}
                      buttonClassName="stepBtn"
                    />
                  </div>
                </div>
                <div style={{ height: 1, background: "#eee", margin: "4px 0 8px" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={excludeEnabled}
                    onChange={(e) => setExcludeEnabled(e.target.checked)}
                  />
                  <span style={{ fontSize: 12 }}>確定BBoxを除外</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={excludeCenter}
                    disabled={!excludeEnabled}
                    onChange={(e) => setExcludeCenter(e.target.checked)}
                  />
                  <span style={{ fontSize: 12 }}>中心点で除外</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, minWidth: 64 }}>除外モード</span>
                  <select
                    value={excludeMode}
                    disabled={!excludeEnabled}
                    onChange={(e) =>
                      setExcludeMode(e.target.value as "same_class" | "any_class")
                    }
                    style={{ height: 28 }}
                  >
                    <option value="same_class">same_class</option>
                    <option value="any_class">any_class</option>
                  </select>
                </label>
                <div className="formRow" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12 }}>IoU</span>
                  <div className="controlWrap" title="±0.05">
                    <NumericInputWithButtons
                      value={excludeIouThreshold}
                      onChange={(v) => typeof v === "number" && setExcludeIouThreshold(v)}
                      min={0.4}
                      max={0.8}
                      step={0.05}
                      height={32}
                      inputWidth={84}
                      disabled={!excludeEnabled}
                      ariaLabel="exclude iou"
                      placeholder="推奨 0.4–0.8"
                      className="controlWrap"
                      inputClassName="numInput"
                      buttonClassName="stepBtn"
                    />
                    <span className="badge">推奨 0.4–0.8</span>
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={refineContour}
                    onChange={(e) => setRefineContour(e.target.checked)}
                  />
                  <span style={{ fontSize: 12 }}>輪郭でBBox補正</span>
                </label>
              </div>
            )}
            {showDebug && (detectDebug || coordDebug) && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #e3e3e3" }}>
                {detectDebug && (
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Debug</div>
                )}
                {detectDebug?.clicked_image_xy && (
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                    click: {detectDebug.clicked_image_xy.x.toFixed(2)} ,{" "}
                    {detectDebug.clicked_image_xy.y.toFixed(2)}
                  </div>
                )}
                {detectDebug?.roi_bbox && (
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                    roi: ({detectDebug.roi_bbox.x1}, {detectDebug.roi_bbox.y1}) → (
                    {detectDebug.roi_bbox.x2}, {detectDebug.roi_bbox.y2})
                  </div>
                )}
                {detectDebug?.outer_bbox && (
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                    outer: {detectDebug.outer_bbox.x}, {detectDebug.outer_bbox.y},{" "}
                    {detectDebug.outer_bbox.w}×{detectDebug.outer_bbox.h}
                  </div>
                )}
                {detectDebug?.tight_bbox && (
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                    tight: {detectDebug.tight_bbox.x}, {detectDebug.tight_bbox.y},{" "}
                    {detectDebug.tight_bbox.w}×{detectDebug.tight_bbox.h}
                  </div>
                )}
                {detectDebug?.roi_click_xy && (
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                    roi click: {detectDebug.roi_click_xy.x.toFixed(2)}, {detectDebug.roi_click_xy.y.toFixed(2)}
                  </div>
                )}
                {detectDebug?.match_score !== undefined && detectDebug?.match_offset_in_roi && (
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                    match score: {detectDebug.match_score.toFixed(4)} / offset:{" "}
                    {detectDebug.match_offset_in_roi.x.toFixed(1)}, {detectDebug.match_offset_in_roi.y.toFixed(1)}
                  </div>
                )}
                {detectDebug?.match_mode && (
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                    match mode: {detectDebug.match_mode}
                  </div>
                )}
                {coordDebug && (
                  <div style={{ marginTop: detectDebug ? 10 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Coords</div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                      screen: {coordDebug.screen.x.toFixed(2)}, {coordDebug.screen.y.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                      image: {coordDebug.image.x.toFixed(2)}, {coordDebug.image.y.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                      zoom: {coordDebug.zoom.toFixed(3)}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                      pan: {coordDebug.pan.x.toFixed(2)}, {coordDebug.pan.y.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                      dpr: {coordDebug.dpr.toFixed(2)}
                    </div>
                    {coordDebug.cssScale && (
                      <div style={{ fontSize: 11, color: "#666" }}>
                        cssScale: {coordDebug.cssScale.sx.toFixed(3)}, {coordDebug.cssScale.sy.toFixed(3)}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {(detectDebug?.roi_preview_marked_base64 || detectDebug?.roi_preview_base64) && (
                    <img
                      src={`data:image/png;base64,${
                        detectDebug?.roi_preview_marked_base64 ||
                        detectDebug?.roi_preview_base64 ||
                        ""
                      }`}
                      alt="roi preview"
                      style={{ width: "100%", border: "1px solid #e3e3e3", borderRadius: 4 }}
                    />
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                      alignItems: "stretch",
                    }}
                  >
                    {detectDebug?.roi_edge_preview_base64 && (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          border: "1px solid #e3e3e3",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={`data:image/png;base64,${detectDebug.roi_edge_preview_base64}`}
                          alt="roi edges"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                    )}
                    {templatePreviewBase64 && (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          border: "1px solid #e3e3e3",
                          borderRadius: 4,
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <img
                          src={`data:image/png;base64,${
                            templatePreviewBase64 || ""
                          }`}
                          alt="template edges"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                        {typeof selectedCandidate?.score === "number" && (
                          <div
                            style={{
                              position: "absolute",
                              top: 4,
                              left: 4,
                              padding: "2px 6px",
                              borderRadius: 6,
                              background: "rgba(0,0,0,0.65)",
                              color: "#fff",
                              fontSize: 10,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {selectedCandidate.score.toFixed(3)}
                          </div>
                        )}
                      </div>
                    )}
                    {!templatePreviewBase64 && (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          border: "1px dashed #e3e3e3",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "#888",
                          background: "#fafafa",
                        }}
                      >
                        テンプレ未取得
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
            {pendingManualBBox && (
              <div
                style={{
                  marginBottom: 18,
                  paddingBottom: 12,
                  borderBottom: "1px solid #eee",
                  flex: "0 0 auto",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>手動BBox: クラス指定</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, minWidth: 60 }}>クラス選択</span>
                  <select
                    value={pendingManualClass}
                    onChange={(e) => {
                      const nextClass = e.target.value;
                      setPendingManualClass(nextClass);
                      if (!nextClass || !pendingManualBBox) return;
                      pushAnnotationHistory();
                      const createdAt = new Date().toISOString();
                      setAnnotations((prev) => [
                        ...prev,
                        {
                          id: `${Date.now()}-${Math.random()}`,
                          class_name: nextClass,
                          bbox: clampBBoxToImage(pendingManualBBox),
                          source: "manual",
                          created_at: createdAt,
                        },
                      ]);
                      if (nextClass) {
                        setColorMap((prev) => {
                          if (prev[nextClass]) return prev;
                          return { ...prev, [nextClass]: pickUniqueColor(prev) };
                        });
                      }
                      setPendingManualBBox(null);
                      setPendingManualClass("");
                    }}
                    style={{ minWidth: 200, height: 36 }}
                  >
                    <option key="class-none" value="">
                      クラスを選択
                    </option>
                    {asChildren(
                      classOptions.map((name, idx) => (
                        <option key={`${name}-${idx}`} value={name}>
                          {name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingManualBBox(null);
                      setPendingManualClass("");
                    }}
                    style={{
                      height: 30,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "1px solid #e3e3e3",
                      background: "#fff",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    キャンセル
                  </button>
                </label>
                {!pendingManualClass && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#b00020" }}>
                    手動BBoxはクラス指定が必要です
                  </div>
                )}
              </div>
            )}
            <div className="sectionCard">
              <div className="sectionTitle">検出 共通設定</div>
              <div className="sectionBody" style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                <div
                  role="button"
                  aria-pressed={showCandidates}
                  onClick={() => setShowCandidates((prev) => !prev)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    alignItems: "center",
                    gap: 10,
                    height: 28,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#455a64" }}>未確定候補を表示</span>
                  <span
                    style={{
                      width: 34,
                      height: 18,
                      borderRadius: 999,
                      background: showCandidates ? "#1a73e8" : "#cfd8dc",
                      position: "relative",
                      transition: "background 120ms ease",
                      display: "inline-block",
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: 2,
                        left: showCandidates ? 18 : 2,
                        transition: "left 120ms ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </span>
                  <span
                    style={{
                      width: 28,
                      textAlign: "right",
                      fontSize: 11,
                      color: showCandidates ? "#455a64" : "#90a4ae",
                      fontWeight: 600,
                    }}
                  >
                    {showCandidates ? "ON" : "OFF"}
                  </span>
                </div>
                <div
                  role="button"
                  aria-pressed={showAnnotations}
                  onClick={() => setShowAnnotations((prev) => !prev)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    alignItems: "center",
                    gap: 10,
                    height: 28,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#455a64" }}>確定アノテーションを表示</span>
                  <span
                    style={{
                      width: 34,
                      height: 18,
                      borderRadius: 999,
                      background: showAnnotations ? "#2e7d32" : "#cfd8dc",
                      position: "relative",
                      transition: "background 120ms ease",
                      display: "inline-block",
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#fff",
                        position: "absolute",
                        top: 2,
                        left: showAnnotations ? 18 : 2,
                        transition: "left 120ms ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </span>
                  <span
                    style={{
                      width: 28,
                      textAlign: "right",
                      fontSize: 11,
                      color: showAnnotations ? "#455a64" : "#90a4ae",
                      fontWeight: 600,
                    }}
                  >
                    {showAnnotations ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: "1px dashed #e0e0e0",
                }}
              >
                <div className="formRow">
                  <span style={{ fontSize: 12, fontWeight: 600 }}>ROIサイズ</span>
                  <div className="controlWrap">
                    <NumericInputWithButtons
                      value={roiSize}
                      onChange={(v) => typeof v === "number" && setRoiSize(v)}
                      min={10}
                      step={10}
                      height={32}
                      inputWidth={84}
                      ariaLabel="roi size"
                      className="controlWrap"
                      inputClassName="numInput"
                      buttonClassName="stepBtn"
                    />
                    <span style={{ fontSize: 11, color: "#666" }}>手動/自動で共通</span>
                  </div>
                </div>
              </div>
              {Object.keys(colorMap).length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 11 }}>
                    クラス別カラー
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      maxHeight: 84,
                      overflowY: "auto",
                      padding: "4px 2px",
                      borderRadius: 6,
                      border: "1px solid #eceff1",
                      background: "#fcfcfc",
                    }}
                  >
                    {asChildren(
                      Object.entries(colorMap).map(([name, color], idx) => {
                        const hexColor = normalizeToHex(color);
                        return (
                          <label
                            key={`${name}-${idx}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "4px 6px",
                              border: "1px solid #e3e3e3",
                              borderRadius: 999,
                              background: "#fff",
                              fontSize: 11,
                            }}
                          >
                            <input
                              type="color"
                              value={hexColor}
                              onChange={(e) =>
                                setColorMap((prev) => ({ ...prev, [name]: e.target.value }))
                              }
                              style={{ width: 20, height: 20, padding: 0, border: "none" }}
                            />
                            <span>{name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sectionCard">
              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <button
                    type="button"
                    onClick={handleConfirmCandidate}
                    disabled={!selectedCandidate || manualClassMissing}
                    onMouseEnter={() => setHoverAction("confirm")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("confirm")}
                    onMouseUp={() => setActiveAction(null)}
                    className="btn btnPrimary"
                    style={{
                      width: "100%",
                      height: 36,
                      fontWeight: 700,
                      opacity: !selectedCandidate || manualClassMissing ? 0.45 : 1,
                      transform: activeAction === "confirm" ? "translateY(1px)" : "none",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>確定</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(Enter)</span>
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <button
                    type="button"
                    onClick={handleNextCandidate}
                    disabled={candidates.length === 0}
                    onMouseEnter={() => setHoverAction("next")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("next")}
                    onMouseUp={() => setActiveAction(null)}
                    className="btn btnSecondary"
                    style={{
                      width: "100%",
                      height: 36,
                      fontWeight: 700,
                      opacity: candidates.length === 0 ? 0.45 : 1,
                      transform: activeAction === "next" ? "translateY(1px)" : "none",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>次</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(N)</span>
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <button
                    type="button"
                    onClick={handleRejectCandidate}
                    disabled={!selectedCandidate}
                    onMouseEnter={() => setHoverAction("discard")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("discard")}
                    onMouseUp={() => setActiveAction(null)}
                    className="btn btnDanger"
                    style={{
                      width: "100%",
                      height: 36,
                      fontWeight: 700,
                      opacity: !selectedCandidate ? 0.45 : 1,
                      transform: activeAction === "discard" ? "translateY(1px)" : "none",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>破棄</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(Del)</span>
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <button
                    type="button"
                    onClick={handleSegCandidate}
                    disabled={!selectedCandidate}
                    onMouseEnter={() => setHoverAction("sam")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("sam")}
                    onMouseUp={() => setActiveAction(null)}
                    className="btn btnSpecial"
                    style={{
                      width: "100%",
                      height: 36,
                      fontWeight: 700,
                      opacity: !selectedCandidate ? 0.45 : 1,
                      transform: activeAction === "sam" ? "translateY(1px)" : "none",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>SAM</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(S)</span>
                    </span>
                  </button>
                </div>
              </div>
              <div className="sectionCard muted" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setAutoPanelOpen((prev) => !prev)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#0b3954",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 0,
                  }}
                >
                  <span>全自動アノテーション</span>
                  <span style={{ fontSize: 12, color: "#546e7a" }}>
                    {autoPanelOpen ? "▼" : "▶"}
                  </span>
                </button>
                {autoPanelOpen && (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div className="formRow">
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>全自動 閾値</div>
                        <div style={{ fontSize: 11, color: "#607d8b", marginTop: 2 }}>
                          高いほど誤検出が減ります。低いほど拾いやすくなります。
                        </div>
                      </div>
                      <div className="controlWrap" title="±0.01">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={autoThreshold}
                          onChange={(e) => setAutoThreshold(Number(e.target.value))}
                          style={{ maxWidth: 200 }}
                        />
                        <NumericInputWithButtons
                          value={autoThreshold}
                          onChange={(v) => typeof v === "number" && setAutoThreshold(v)}
                          min={0}
                          max={1}
                          step={0.01}
                          height={32}
                          inputWidth={84}
                          ariaLabel="auto threshold"
                          placeholder="推奨 0.6–0.85"
                          className="controlWrap"
                          inputClassName={`numInput ${autoThresholdDanger ? "dangerInput" : autoThresholdWarn ? "warnInput" : ""}`}
                          buttonClassName="stepBtn"
                        />
                        <span className="badge">推奨 0.6–0.85</span>
                        <span className="badge badgeWarn">危険 &lt;0.3</span>
                        {autoThresholdWarn && !autoThresholdDanger && <span className="badge badgeDanger">注意</span>}
                        {autoThresholdDanger && <span className="badge badgeDanger">Danger</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>対象クラス</div>
                      <div style={{ fontSize: 11, color: "#607d8b", marginTop: 2 }}>
                        未チェックのクラスは対象外になります。
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 6,
                          maxHeight: 84,
                          overflowY: "auto",
                          padding: "4px 2px",
                          borderRadius: 6,
                          border: "1px solid #eceff1",
                          background: "#fcfcfc",
                        }}
                      >
                        {classOptions.length === 0 && (
                          <span style={{ fontSize: 12, color: "#888" }}>クラス未設定</span>
                        )}
                        {asChildren(
                          classOptions.map((name, idx) => {
                            const checked = autoClassFilter.includes(name);
                            return (
                              <label
                                key={`auto-class-${name}-${idx}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  border: "1px solid #d9e2ec",
                                  borderRadius: 999,
                                  background: checked ? "#e3f2fd" : "#fff",
                                  flexWrap: "wrap",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...autoClassFilter, name]
                                      : autoClassFilter.filter((c) => c !== name);
                                    setAutoClassFilter(next);
                                  }}
                                />
                                <span>{name}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoAnnotate}
                      disabled={autoRunning}
                      style={{
                        height: 38,
                        borderRadius: 10,
                        border: "1px solid #0b7285",
                        background: autoRunning
                          ? `linear-gradient(90deg, #0b7285 0%, #0b7285 ${autoProgress}%, #0f4c5c ${autoProgress}%, #0f4c5c 100%)`
                          : "#0b7285",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: autoRunning ? 0.7 : 1,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {autoRunning && (
                          <svg width="14" height="14" viewBox="0 0 50 50" style={{ display: "block" }}>
                            <circle
                              cx="25"
                              cy="25"
                              r="20"
                              fill="none"
                              stroke="#fff"
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray="90 60"
                            >
                              <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from="0 25 25"
                                to="360 25 25"
                                dur="1s"
                                repeatCount="indefinite"
                              />
                            </circle>
                          </svg>
                        )}
                        {autoRunning ? `実行中…${autoProgress}%` : "全自動アノテーション（追加）"}
                      </span>
                    </button>
                    {autoResult && (
                      <div style={{ fontSize: 12, color: "#0b3954" }}>
                        <div>追加されたアノテーション数: {autoResult.added}</div>
                        <div>除外された候補数: {autoResult.rejected}</div>
                        <div>使用した閾値: {autoResult.threshold.toFixed(2)}</div>
                        <button
                          type="button"
                          onClick={handleUndoAutoAnnotate}
                          disabled={lastAutoAddedIds.length === 0}
                          style={{
                            marginTop: 6,
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 6,
                            border: "1px solid #d9e2ec",
                            background: "#fff",
                            fontSize: 11,
                            cursor: "pointer",
                            opacity: lastAutoAddedIds.length === 0 ? 0.5 : 1,
                          }}
                        >
                          直前の追加分を取り消す
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAutoAdvancedOpen((prev) => !prev)}
                      style={{
                        height: 28,
                        borderRadius: 6,
                        border: "1px dashed #b0bec5",
                        background: "#fff",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {autoAdvancedOpen ? "詳細設定を閉じる" : "詳細設定を開く"}
                    </button>
                    {autoAdvancedOpen && (
                      <div className="autoAdvanced" style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }} />
                          {autoDirty && autoBaseline && (
                            <button
                              type="button"
                              className="btn btnGhost"
                              style={{ height: 24, padding: "0 8px", fontSize: 10 }}
                              onClick={() => {
                                setAutoThreshold(autoBaseline.autoThreshold);
                                setAutoMethod(autoBaseline.autoMethod);
                                setAutoClassFilter(autoBaseline.autoClassFilter);
                                setAutoStride(autoBaseline.autoStride);
                                setScaleMin(autoBaseline.scaleMin);
                                setScaleMax(autoBaseline.scaleMax);
                                setScaleSteps(autoBaseline.scaleSteps);
                                setRoiSize(autoBaseline.roiSize);
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>検出方式</div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {[
                            {
                              key: "combined",
                              label: "Fusion Mode（画像解析型）",
                              help: "二値化 + match + 黒線一致率 + NMS で判定。",
                              accent: "#1976d2",
                              bg: "#e3f2fd",
                            },
                            {
                              key: "scaled_templates",
                              label: "Template Mode（テンプレ探索型）",
                              help: "タイル/ROI内の matchTemplate スコアで判定。",
                              accent: "#546e7a",
                              bg: "#eceff1",
                            },
                          ].map((item) => {
                            const selected = autoMethod === item.key;
                            return (
                              <label
                                key={`auto-method-${item.key}`}
                                className="autoMethodCard"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: selected ? `1px solid ${item.accent}` : "1px solid #e0e0e0",
                                  background: selected ? item.bg : "#fff",
                                  fontSize: 11,
                                  cursor: "pointer",
                                  width: "100%",
                                  flexWrap: "wrap",
                                  boxSizing: "border-box",
                                }}
                              >
                                <input
                                  type="radio"
                                  name="auto-method"
                                  checked={selected}
                                  onChange={() => setAutoMethod(item.key as "combined" | "scaled_templates")}
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <span style={{ fontWeight: 700, color: item.accent }}>{item.label}</span>
                                  <span className="autoMethodHelp" style={{ color: "#666" }}>
                                    {item.help}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="formRow" style={{ alignItems: "start" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, paddingTop: 4 }}>スケール</span>
                          <div className="controlStack">
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }} title="±0.1">
                              <NumericInputWithButtons
                                value={scaleMin}
                                onChange={(v) => typeof v === "number" && setScaleMin(v)}
                                min={0.1}
                                step={0.1}
                                height={32}
                                inputWidth={84}
                                ariaLabel="auto scale min"
                                placeholder="推奨 0.4–0.8"
                                className="controlWrap"
                                inputClassName={`numInput ${scaleMinDanger ? "dangerInput" : scaleMinWarn ? "warnInput" : ""}`}
                                buttonClassName="stepBtn"
                              />
                              <span className="miniLabel" style={{ textAlign: "center" }}>min</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }} title="±0.1">
                              <NumericInputWithButtons
                                value={scaleMax}
                                onChange={(v) => typeof v === "number" && setScaleMax(v)}
                                min={0.1}
                                step={0.1}
                                height={32}
                                inputWidth={84}
                                ariaLabel="auto scale max"
                                placeholder="推奨 1.2–2.0"
                                className="controlWrap"
                                inputClassName={`numInput ${scaleMaxDanger ? "dangerInput" : scaleMaxWarn ? "warnInput" : ""}`}
                                buttonClassName="stepBtn"
                              />
                              <span className="miniLabel" style={{ textAlign: "center" }}>max</span>
                            </div>
                            <div className="hintText">
                              <span className="badge">推奨 min 0.4–0.8 / max 1.2–2.0</span>
                              <span className="badge badgeWarn">危険 min&lt;0.2, max&gt;3.0</span>
                              {(scaleMinWarn || scaleMaxWarn) && !scaleMinDanger && !scaleMaxDanger && (
                                <span className="badge badgeDanger">注意</span>
                              )}
                              {(scaleMinDanger || scaleMaxDanger) && (
                                <span className="badge badgeDanger">Danger</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="formRow">
                          <span style={{ fontSize: 12, fontWeight: 600 }}>分割</span>
                          <div className="controlWrap" title="±1">
                            <NumericInputWithButtons
                              value={scaleSteps}
                              onChange={(v) => typeof v === "number" && setScaleSteps(v)}
                              min={1}
                              step={1}
                              height={32}
                              inputWidth={84}
                              ariaLabel="auto scale steps"
                              placeholder="推奨 6–12"
                              className="controlWrap"
                              inputClassName={`numInput ${scaleStepsDanger ? "dangerInput" : scaleStepsWarn ? "warnInput" : ""}`}
                              buttonClassName="stepBtn"
                            />
                            <span className="badge">推奨 6–12</span>
                            <span className="badge badgeWarn">危険 &gt;20</span>
                            {scaleStepsWarn && !scaleStepsDanger && <span className="badge badgeDanger">注意</span>}
                            {scaleStepsDanger && <span className="badge badgeDanger">Danger</span>}
                          </div>
                        </div>
                        <div className="formRow">
                          <span style={{ fontSize: 12, fontWeight: 600 }}>stride</span>
                          <div className="controlWrap" title="±1">
                            <div style={{ display: "flex", flexWrap: "nowrap", gap: 6, alignItems: "center" }}>
                              <NumericInputWithButtons
                                value={autoStride ?? ""}
                                onChange={(v) => setAutoStride(v === "" ? null : v)}
                                min={1}
                                step={1}
                                height={32}
                                inputWidth={120}
                                ariaLabel="auto stride"
                                placeholder="推奨 auto / 32–128"
                                className="controlWrap noWrapRow"
                                inputClassName={`midInput ${strideDanger ? "dangerInput" : strideWarn ? "warnInput" : ""}`}
                                buttonClassName="stepBtn"
                              />
                            </div>
                            <span className="badge">推奨 auto / 32–128</span>
                            <span className="badge badgeWarn">危険 &lt;16 or &gt;256</span>
                            {strideWarn && !strideDanger && <span className="badge badgeDanger">注意</span>}
                            {strideDanger && <span className="badge badgeDanger">Danger</span>}
                            {typeof autoStride === "number" && autoStride <= 0 && (
                              <span className="badge badgeDanger">入力が不正です</span>
                            )}
                          </div>
                        </div>
                        <div className="formRow">
                          <span style={{ fontSize: 12, fontWeight: 600 }}>ROIサイズ</span>
                          <div className="controlWrap" title="±10">
                            <NumericInputWithButtons
                              value={roiSize}
                              onChange={(v) => typeof v === "number" && setRoiSize(v)}
                              min={10}
                              step={10}
                              height={32}
                              inputWidth={84}
                              ariaLabel="auto roi size"
                              placeholder="推奨 200–600"
                              className="controlWrap"
                              inputClassName={`numInput ${roiDanger ? "dangerInput" : roiWarn ? "warnInput" : ""}`}
                              buttonClassName="stepBtn"
                            />
                            <span style={{ fontSize: 11, color: "#607d8b" }}>
                              手動/自動で共通
                            </span>
                            <span className="badge">推奨 200–600</span>
                            <span className="badge badgeWarn">危険 &lt;100 or &gt;1200</span>
                            {roiWarn && !roiDanger && <span className="badge badgeDanger">注意</span>}
                            {roiDanger && <span className="badge badgeDanger">Danger</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginBottom: 16 }} />

            <div className="sectionCard confirmedSection" style={{ paddingTop: 4 }}>
              <div className="sectionTitle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>確定アノテーション</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>表示 {sortedAnnotations.length}件</span>
              </div>
              <div className="sectionBody confirmedBody">
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap", rowGap: 6 }}>
                <span style={{ fontSize: 11, color: "#666" }}>シリーズ</span>
                <select
                  value={annotationFilterClass}
                  onChange={(e) => setAnnotationFilterClass(e.target.value)}
                  style={{ height: 24, fontSize: 11 }}
                >
                  <option key="class-all" value="all">
                    すべて表示
                  </option>
                  {asChildren(
                    classOptions.map((name, idx) => (
                      <option key={`${name}-${idx}`} value={name}>
                        {name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (checkedAnnotationIds.length === sortedAnnotations.length) {
                      setCheckedAnnotationIds([]);
                    } else {
                      setCheckedAnnotationIds(sortedAnnotations.map((a) => a.id));
                    }
                  }}
                  style={{
                    height: 24,
                    fontSize: 11,
                    padding: "0 8px",
                    borderRadius: 6,
                    border: "1px solid #e3e3e3",
                    background: "#fafafa",
                    cursor: "pointer",
                  }}
                >
                  {checkedAnnotationIds.length === sortedAnnotations.length
                    ? "解除"
                    : "全てチェック"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (checkedAnnotationIds.length === 0) return;
                    setAnnotations((prev) =>
                      prev.filter((a) => !checkedAnnotationIds.includes(a.id))
                    );
                    if (selectedAnnotationId && checkedAnnotationIds.includes(selectedAnnotationId)) {
                      setSelectedAnnotationId(null);
                    }
                    setCheckedAnnotationIds([]);
                  }}
                  style={{
                    height: 24,
                    fontSize: 11,
                    padding: "0 8px",
                    borderRadius: 6,
                    border: "1px solid #ef9a9a",
                    background: "#ffebee",
                    color: "#b00020",
                    cursor: "pointer",
                  }}
                >
                  選択削除
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                {sortedAnnotations.length === 0
                  ? "内訳: なし"
                  : Object.entries(
                      sortedAnnotations.reduce<Record<string, number>>((acc, a) => {
                        acc[a.class_name] = (acc[a.class_name] || 0) + 1;
                        return acc;
                      }, {})
                    )
                      .map(([name, count]) => `${name}: ${count}`)
                      .join(" / ")}
              </div>
              <div className="confirmedList">
                {sortedAnnotations.length === 0 && (
                  <div style={{ color: "var(--muted)" }}>確定アノテはまだありません。</div>
                )}
                {asChildren(sortedAnnotations.map((a, idx) => (
                  <div
                    key={`${a.id || "ann"}-${idx}`}
                    className="confirmedRow"
                    ref={(el) => {
                      if (a.id) annotationRowRefs.current[a.id] = el;
                    }}
                    style={{
                      padding: "8px 10px",
                      marginBottom: 8,
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      background: selectedAnnotationId === a.id ? "rgba(37,99,235,0.06)" : "var(--panel)",
                      borderLeft: selectedAnnotationId === a.id ? "3px solid rgba(37,99,235,0.45)" : `1px solid var(--border)`,
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "18px 1fr auto 36px",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 52,
                    }}
                    onClick={() => handleSelectAnnotation(a)}
                  >
                    <input
                      type="checkbox"
                      checked={checkedAnnotationIds.includes(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...checkedAnnotationIds, a.id]
                          : checkedAnnotationIds.filter((id) => id !== a.id);
                        setCheckedAnnotationIds(next);
                      }}
                    />
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: colorMap[a.class_name] || "#333",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ color: "#0b1f3a" }}>{a.class_name}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 10,
                            background: a.source === "manual" ? "#b00020" : "#2e7d32",
                            color: "#fff",
                            border: "1px solid transparent",
                          }}
                        >
                          {a.source === "manual" ? "MANUEL" : a.source.toUpperCase()}
                        </span>
                        {a.segPolygon && a.segMethod && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 10,
                              background: a.segMethod === "sam" ? "#2e7d32" : "#888",
                              color: "#fff",
                            }}
                          >
                            {a.segMethod.toUpperCase()}
                          </span>
                        )}
                        {a.segPolygon && !a.segMethod && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 10,
                              background: "#1a73e8",
                              color: "#fff",
                            }}
                          >
                            SEG
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                        bbox: ({Math.round(a.bbox.x)}, {Math.round(a.bbox.y)}, {Math.round(a.bbox.w)}, {Math.round(a.bbox.h)})
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", fontVariantNumeric: "tabular-nums", justifySelf: "end" }}>
                      {typeof a.score === "number" ? a.score.toFixed(3) : "-"}
                      <div style={{ marginTop: 2 }}>
                        {a.created_at ? new Date(a.created_at).toLocaleTimeString() : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnnotations((prev) => prev.filter((item) => item.id !== a.id));
                        if (selectedAnnotationId === a.id) {
                          setSelectedAnnotationId(null);
                        }
                      }}
                      className="btn btnGhost"
                      style={{
                        width: 32,
                        height: 32,
                        padding: 0,
                        borderRadius: 8,
                        fontSize: 14,
                        boxShadow: "none",
                      }}
                    >
                      🗑
                    </button>
                  </div>
                )))}
              </div>
              </div>
            </div>

          {selectedAnnotation?.segPolygon && (
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Seg編集</div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={segEditMode}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (!next && segEditMode) {
                        applySegSimplify();
                      }
                      setSegEditMode(next);
                    }}
                  />
                  <span style={{ fontSize: 12 }}>編集モードON/OFF</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={showSegVertices}
                    onChange={(e) => setShowSegVertices(e.target.checked)}
                    disabled={!segEditMode}
                  />
                  <span style={{ fontSize: 12 }}>頂点を表示</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, minWidth: 70 }}>簡略化</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={segSimplifyEps}
                    onChange={(e) => setSegSimplifyEps(Number(e.target.value))}
                    disabled={!segEditMode}
                  />
                  <span style={{ fontSize: 12 }}>{segSimplifyEps}</span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSegUndo}
                    disabled={!segEditMode || segUndoStack.length === 0}
                    style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={handleSegReset}
                    disabled={!segEditMode || !selectedAnnotation.originalSegPolygon}
                    style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
                  >
                    Reset
                  </button>
                </div>
            </div>
          )}

            <div style={{ marginBottom: 18 }} />
          </div>
        </div>
      ) : (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Project Home</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
            <input
              type="text"
              id="project-name-input"
              name="project_name"
              placeholder="project_name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              style={{ height: 36, padding: "0 10px", minWidth: 240 }}
            />
            <button
              type="button"
              onClick={handleCreateProject}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #1a73e8",
                background: "#1a73e8",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              新規プロジェクト作成
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {asChildren(projectList.map((p, idx) => (
              <div
                key={`${p.project_name || "project"}-${idx}`}
                style={{
                  border: "1px solid #e3e3e3",
                  borderRadius: 10,
                  padding: 12,
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.project_name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  テンプレート: {templateByDataset[p.project_name] || "未設定"}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  画像: {p.total_images} / アノテ済: {p.annotated_images}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  bbox: {p.bbox_count} / seg: {p.seg_count}
                </div>
                <div style={{ fontSize: 11, color: "#999" }}>
                  更新: {p.updated_at || "-"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleOpenProject(p.project_name)}
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid #1a73e8",
                      background: "#e8f0fe",
                      cursor: "pointer",
                    }}
                  >
                    開く
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(p.project_name)}
                    style={{
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid #e3e3e3",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            )))}
            {projectList.length === 0 && (
              <div style={{ color: "#666" }}>プロジェクトがありません。</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function randomColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
