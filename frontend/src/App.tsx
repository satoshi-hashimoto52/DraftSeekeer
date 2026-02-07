import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Annotation,
  Candidate,
  DatasetInfo,
  DatasetImageEntry,
  ProjectTemplates,
  detectPoint,
  fetchProjects,
  fetchTemplates,
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
} from "./api";
import ImageCanvas, { ImageCanvasHandle } from "./components/ImageCanvas";
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
  const [project, setProject] = useState<string>("");
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
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState<boolean>(true);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const canvasRef = useRef<ImageCanvasHandle | null>(null);
  const [lastClick, setLastClick] = useState<{ x: number; y: number } | null>(null);
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
  const folderInputRef = useRef<HTMLInputElement | null>(null);

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
      setProjectList(list);
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

  const handleSelectDatasetImage = async (filename: string) => {
    if (!datasetId) return;
    await loadDatasetImage(datasetId, filename);
  };

  const handleOpenProject = async (projectName: string) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
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

  const handleClickPoint = async (x: number, y: number) => {
    if (isCreatingManualBBox) return;
    if (manualClassMissing) return;
    if (!imageId || !project) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    setLastClick({ x, y });
    try {
      const res = await detectPoint({
        image_id: imageId,
        project,
        x,
        y,
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

  const normalizeLoadedAnnotations = (items: Annotation[]) => {
    const now = Date.now();
    return items.map((ann, idx) => ({
      id: ann.id || `${now}-${Math.random()}-${idx}`,
      class_name: ann.class_name,
      bbox: ann.bbox,
      source: ann.source || "template",
      created_at: ann.created_at || new Date().toISOString(),
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
    if (!saved) {
      setRoiSize(DEFAULT_ROI_SIZE);
      setTopk(DEFAULT_TOPK);
      setScaleMin(DEFAULT_SCALE_MIN);
      setScaleMax(DEFAULT_SCALE_MAX);
      setScaleSteps(DEFAULT_SCALE_STEPS);
      setExcludeEnabled(true);
      setExcludeMode("same_class");
      setExcludeCenter(true);
      setExcludeIouThreshold(0.6);
      setRefineContour(false);
      return;
    }
    if (typeof saved.roiSize === "number") setRoiSize(saved.roiSize);
    if (typeof saved.topk === "number") setTopk(saved.topk);
    if (typeof saved.scaleMin === "number") setScaleMin(saved.scaleMin);
    if (typeof saved.scaleMax === "number") setScaleMax(saved.scaleMax);
    if (typeof saved.scaleSteps === "number") setScaleSteps(saved.scaleSteps);
    if (typeof saved.excludeEnabled === "boolean") setExcludeEnabled(saved.excludeEnabled);
    if (saved.excludeMode === "same_class" || saved.excludeMode === "any_class") {
      setExcludeMode(saved.excludeMode);
    }
    if (typeof saved.excludeCenter === "boolean") setExcludeCenter(saved.excludeCenter);
    if (typeof saved.excludeIouThreshold === "number") {
      setExcludeIouThreshold(saved.excludeIouThreshold);
    }
    if (typeof saved.refineContour === "boolean") setRefineContour(saved.refineContour);
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
      style={{
        fontFamily: "\"IBM Plex Sans\", system-ui, sans-serif",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #eee",
          position: "sticky",
          top: 0,
          background: "#fff",
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
            <button
              type="button"
              onClick={handleBackToHome}
              disabled={!datasetId}
              style={{
                height: 30,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid #e3e3e3",
                background: "#fff",
                fontSize: 12,
                cursor: datasetId ? "pointer" : "not-allowed",
                opacity: datasetId ? 1 : 0.5,
              }}
            >
              Project Homeへ戻る
            </button>
            <button
              type="button"
              onClick={() => {
                if (!exportOutputDir.trim()) {
                  setExportOutputDir("~/Downloads");
                }
                setExportResult(null);
                setShowExportDrawer(true);
              }}
              style={{
                height: 30,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid #e3e3e3",
                background: "#fff",
                fontSize: 12,
                cursor: "pointer",
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
                border: "1px solid #e3e3e3",
                borderRadius: 8,
                background: "#f7f7f7",
                opacity: 0.9,
              }}
            >
              <span style={{ fontSize: 11 }}>プロジェクト</span>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                style={{ minWidth: 120, height: 22, fontSize: 11 }}
              >
                {projects.length === 0 && <option value="">(none)</option>}
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
                style={{
                  height: 22,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: "1px solid #e3e3e3",
                  background: "#fff",
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
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100vh",
              width: 420,
              background: "#fff",
              zIndex: 50,
              boxShadow: "-8px 0 24px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontWeight: 700 }}>Export dataset</div>
              <button
                type="button"
                onClick={closeExportDrawer}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16, overflowY: "auto" }}>
              <div
                style={{
                  borderRadius: 8,
                  padding: 12,
                  background:
                    "repeating-linear-gradient(135deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 6px, rgba(0,0,0,0.06) 6px, rgba(0,0,0,0.06) 12px)",
                  color: "#333",
                  fontSize: 12,
                  pointerEvents: "none",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Summary</div>
                <div>Project: {project || "-"}</div>
                <div>Dataset: {datasetInfo?.project_name || "-"}</div>
                <div>Total images: {totalImages}</div>
                <div>Annotated images: {annotatedImages}</div>
                <div>Total annotations: {totalAnnotations}</div>
                <div>Classes: {classesCount}</div>
                <div>Negative include: {includeNegatives ? "ON" : "OFF"}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowSplitSettings((prev) => !prev)}
                  style={{
                    width: "100%",
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid #e3e3e3",
                    background: "#fff",
                    fontSize: 12,
                    cursor: "pointer",
                    marginBottom: 8,
                  }}
                >
                  Split settings
                </button>
                {showSplitSettings && (
                  <div
                    style={{
                      border: "1px solid #e3e3e3",
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "64px 64px 64px", gap: 8 }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Train</span>
                        <input
                          type="number"
                          min={0}
                          value={splitTrain}
                          onChange={(e) => setSplitTrain(Number(e.target.value))}
                          style={{ height: 32, padding: "0 8px", width: 64 }}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Val</span>
                        <input
                          type="number"
                          min={0}
                          value={splitVal}
                          onChange={(e) => setSplitVal(Number(e.target.value))}
                          style={{ height: 32, padding: "0 8px", width: 64 }}
                        />
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Test</span>
                        <input
                          type="number"
                          min={0}
                          value={splitTest}
                          onChange={(e) => setSplitTest(Number(e.target.value))}
                          style={{ height: 32, padding: "0 8px", width: 64 }}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#666" }}>Seed</span>
                      <input
                        type="number"
                        value={splitSeed}
                        onChange={(e) => setSplitSeed(Number(e.target.value))}
                        style={{ height: 32, padding: "0 8px", width: 96 }}
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

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Dataset type</div>
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

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Output directory</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="/Users/you/exports"
                    value={exportOutputDir}
                    onChange={(e) => setExportOutputDir(e.target.value)}
                    style={{ height: 32, padding: "0 8px", flex: 1 }}
                  />
                  <button
                    type="button"
                    disabled
                    style={{
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 8,
                      border: "1px solid #e0e0e0",
                      background: "#f7f7f7",
                      color: "#999",
                      cursor: "not-allowed",
                    }}
                  >
                    Browse...
                  </button>
                </div>
                {exportDirHistory.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {exportDirHistory.map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => setExportOutputDir(dir)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid #e0e0e0",
                          background: "#f7f7f7",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Validation & Warnings</div>
                {exportErrors.map((msg) => (
                  <div
                    key={msg}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "#ffebee",
                      color: "#b00020",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    {msg}
                  </div>
                ))}
                {exportWarnings.map((w) => (
                  <div
                    key={w.text}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: w.level === "orange" ? "#fff3e0" : "#fffde7",
                      color: w.level === "orange" ? "#ef6c00" : "#9e7b00",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    {w.text}
                  </div>
                ))}
                {exportErrors.length === 0 && exportWarnings.length === 0 && (
                  <div style={{ fontSize: 12, color: "#666" }}>問題は検出されていません。</div>
                )}
              </div>

              <div
                style={{
                  borderRadius: 8,
                  padding: 12,
                  background:
                    "repeating-linear-gradient(135deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 6px, rgba(0,0,0,0.06) 6px, rgba(0,0,0,0.06) 12px)",
                  color: "#333",
                  fontSize: 12,
                  pointerEvents: "none",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Export summary</div>
                <div>Train: {splitSummary.train} images</div>
                <div>Val: {splitSummary.val} images</div>
                <div>Test: {splitSummary.test} images</div>
                <div style={{ marginTop: 6 }}>Output: {exportOutputDir || "-"}</div>
                <div>Folder: {exportFolderName}</div>
              </div>
            </div>
            <div
              style={{
                padding: 16,
                borderTop: "1px solid #eee",
                background: "#fff",
                position: "sticky",
                bottom: 0,
              }}
            >
              <button
                type="button"
                onClick={datasetType === "seg" ? handleExportDatasetSeg : handleExportDatasetBBox}
                disabled={!canExport || busy}
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid #1a73e8",
                  background: !canExport || busy ? "#f2f2f2" : "#1a73e8",
                  color: !canExport || busy ? "#888" : "#fff",
                  fontWeight: 700,
                  cursor: !canExport || busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Exporting..." : "Export dataset"}
              </button>
              {exportResult && (
                <div
                  style={{
                    marginTop: 8,
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
            gridTemplateColumns: "260px 1fr 360px",
            gap: 16,
            padding: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          <div
            style={{
              borderRight: "1px solid #eee",
              paddingRight: 12,
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
                {datasetInfo.images.map((entry: DatasetImageEntry, idx: number) => {
                  const name = entry.original_filename || entry.filename || "";
                  const indexLabel = entry.internal_id || "000";
                  if (!name) {
                    return null;
                  }
                  const count = imageStatusMap[name] || 0;
                  const isDone = count > 0;
                  const isActive = datasetSelectedName === name;
                  return (
                    <div
                      key={name || `${entry.internal_id}-${idx}`}
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
                          {indexLabel}{" "}
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
                        <div style={{ fontSize: 10, color: "#666" }}>{name}</div>
                      </div>
                    </div>
                  );
                })}
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
                      a.id === selectedAnnotationId ? { ...a, bbox: clampBBoxToImage(bbox) } : a
                    )
                  );
                }}
                onAnnotationEditStart={() => {
                  if (annotationEditActiveRef.current) return;
                  annotationEditActiveRef.current = true;
                  pushAnnotationHistory();
                }}
                onAnnotationEditEnd={() => {
                  annotationEditActiveRef.current = false;
                }}
                onSelectAnnotation={handleSelectAnnotation}
                pendingManualBBox={pendingManualBBox}
                shouldIgnoreCanvasClick={() => isCreatingManualBBox || !!pendingManualBBox}
              />
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
            style={{
              borderLeft: "1px solid #eee",
              paddingLeft: 16,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              opacity: isCanvasInteracting ? 0.6 : 1,
              transition: "opacity 160ms ease",
            }}
          >
            <div style={{ marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={showCandidates}
                onChange={(e) => setShowCandidates(e.target.checked)}
              />
              <span style={{ fontSize: 12 }}>未確定候補を表示</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={showAnnotations}
                onChange={(e) => setShowAnnotations(e.target.checked)}
              />
              <span style={{ fontSize: 12 }}>確定アノテーションを表示</span>
            </label>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                style={{
                  width: "100%",
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid #e3e3e3",
                  background: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Advanced settings
              </button>
            </div>
            {showAdvanced && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e3e3e3" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>検出パラメータ</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, minWidth: 90 }}>ROIサイズ</span>
                  <input
                    type="number"
                    min={10}
                    value={roiSize}
                    step={10}
                    onChange={(e) => setRoiSize(Number(e.target.value))}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    style={{ width: 100, height: 28 }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, minWidth: 90 }}>スケール</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    value={scaleMin}
                    onChange={(e) => setScaleMin(Number(e.target.value))}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    style={{ width: 70, height: 28 }}
                  />
                  <span style={{ fontSize: 12, color: "#888" }}>〜</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    value={scaleMax}
                    onChange={(e) => setScaleMax(Number(e.target.value))}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    style={{ width: 70, height: 28 }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, minWidth: 90 }}>上位件数</span>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={topk}
                    onChange={(e) => setTopk(Number(e.target.value))}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    style={{ width: 60, height: 28 }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, minWidth: 90 }}>スケール分割数</span>
                  <input
                    type="number"
                    min={1}
                    value={scaleSteps}
                    onChange={(e) => setScaleSteps(Number(e.target.value))}
                    onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                    style={{ width: 60, height: 28 }}
                  />
                </label>
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
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, minWidth: 64 }}>IoU</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0.4}
                    max={0.8}
                    disabled={!excludeEnabled}
                    value={excludeIouThreshold}
                    onChange={(e) => setExcludeIouThreshold(Number(e.target.value))}
                    style={{ width: 72, height: 28 }}
                  />
                </label>
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
                    <option value="">クラスを選択</option>
                    {classOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
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
            <div
              style={{
                marginBottom: 12,
                border: "1px solid #e3e3e3",
                borderRadius: 10,
                padding: 10,
                background: "#fff",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    onClick={handleConfirmCandidate}
                    disabled={!selectedCandidate || manualClassMissing}
                    onMouseEnter={() => setHoverAction("confirm")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("confirm")}
                    onMouseUp={() => setActiveAction(null)}
                    style={{
                      height: 36,
                      borderRadius: 8,
                      border: "1px solid #1a73e8",
                      background: "#1a73e8",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: !selectedCandidate || manualClassMissing ? 0.45 : 1,
                      boxShadow:
                        hoverAction === "confirm"
                          ? "0 6px 12px rgba(26,115,232,0.24)"
                          : "0 4px 10px rgba(26,115,232,0.16)",
                      transform: activeAction === "confirm" ? "translateY(1px)" : "none",
                      transition: "all 120ms ease",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>確定</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(Enter)</span>
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    onClick={handleNextCandidate}
                    disabled={candidates.length === 0}
                    onMouseEnter={() => setHoverAction("next")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("next")}
                    onMouseUp={() => setActiveAction(null)}
                    style={{
                      height: 36,
                      borderRadius: 8,
                      border: "1px solid #90a4ae",
                      background: "#eceff1",
                      color: "#455a64",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: candidates.length === 0 ? 0.45 : 1,
                      boxShadow:
                        hoverAction === "next"
                          ? "0 6px 12px rgba(144,164,174,0.25)"
                          : "0 4px 10px rgba(144,164,174,0.16)",
                      transform: activeAction === "next" ? "translateY(1px)" : "none",
                      transition: "all 120ms ease",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>次</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(N)</span>
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    onClick={handleRejectCandidate}
                    disabled={!selectedCandidate}
                    onMouseEnter={() => setHoverAction("discard")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("discard")}
                    onMouseUp={() => setActiveAction(null)}
                    style={{
                      height: 36,
                      borderRadius: 8,
                      border: "1px solid #d32f2f",
                      background: "#d32f2f",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: !selectedCandidate ? 0.45 : 1,
                      boxShadow:
                        hoverAction === "discard"
                          ? "0 6px 12px rgba(211,47,47,0.25)"
                          : "0 4px 10px rgba(211,47,47,0.16)",
                      transform: activeAction === "discard" ? "translateY(1px)" : "none",
                      transition: "all 120ms ease",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>破棄</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(Del)</span>
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    onClick={handleSegCandidate}
                    disabled={!selectedCandidate}
                    onMouseEnter={() => setHoverAction("sam")}
                    onMouseLeave={() => setHoverAction(null)}
                    onMouseDown={() => setActiveAction("sam")}
                    onMouseUp={() => setActiveAction(null)}
                    style={{
                      height: 36,
                      borderRadius: 8,
                      border: "1px solid #2e7d32",
                      background: "#2e7d32",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: !selectedCandidate ? 0.45 : 1,
                      boxShadow:
                        hoverAction === "sam"
                          ? "0 6px 12px rgba(46,125,50,0.25)"
                          : "0 4px 10px rgba(46,125,50,0.16)",
                      transform: activeAction === "sam" ? "translateY(1px)" : "none",
                      transition: "all 120ms ease",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                      <span>SAM</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(S)</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }} />
            {Object.keys(colorMap).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>クラス別カラー</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(colorMap).map(([name, color]) => {
                    const hexColor = normalizeToHex(color);
                    return (
                      <label
                        key={name}
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
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12, paddingTop: 4, flex: "1 1 auto", minHeight: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                確定アノテーション（表示 {filteredAnnotations.length}件）
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#666" }}>シリーズ</span>
                <select
                  value={annotationFilterClass}
                  onChange={(e) => setAnnotationFilterClass(e.target.value)}
                  style={{ height: 24, fontSize: 11 }}
                >
                  <option value="all">すべて表示</option>
                  {classOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                {filteredAnnotations.length === 0
                  ? "内訳: なし"
                  : Object.entries(
                      filteredAnnotations.reduce<Record<string, number>>((acc, a) => {
                        acc[a.class_name] = (acc[a.class_name] || 0) + 1;
                        return acc;
                      }, {})
                    )
                      .map(([name, count]) => `${name}: ${count}`)
                      .join(" / ")}
              </div>
              <div style={{ overflowY: "auto", maxHeight: "36vh", paddingRight: 6 }}>
                {filteredAnnotations.length === 0 && (
                  <div style={{ color: "#666" }}>確定アノテはまだありません。</div>
                )}
                {filteredAnnotations.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "6px 8px",
                      marginBottom: 6,
                      border: "1px solid #e3e3e3",
                      borderRadius: 6,
                      background: selectedAnnotationId === a.id ? "#eef6ff" : "#fff",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onClick={() => handleSelectAnnotation(a)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <span style={{ color: colorMap[a.class_name] || "#333" }}>{a.class_name}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 10,
                            background: "#455a64",
                            color: "#fff",
                          }}
                        >
                          {a.source.toUpperCase()}
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
                      <div style={{ fontSize: 12, color: "#666" }}>
                        bbox: ({a.bbox.x}, {a.bbox.y}, {a.bbox.w}, {a.bbox.h})
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
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 16,
                      }}
                    >
                      🗑
                    </button>
                  </div>
                ))}
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
            {projectList.map((p) => (
              <div
                key={p.project_name}
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
            ))}
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
