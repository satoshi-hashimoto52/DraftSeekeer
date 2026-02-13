import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { detectPoint, fetchProjects, fetchTemplates, fetchTemplatePreview, clearProjectAnnotations, segmentCandidate, toCandidates, importDataset, fetchDataset, selectDatasetImage, API_BASE, saveAnnotations, loadAnnotations, exportDatasetBBox, exportDatasetSeg, listDatasetProjects, createDatasetProject, deleteDatasetProject, autoAnnotate, } from "./api";
import ImageCanvas from "./components/ImageCanvas";
import NumericInputWithButtons from "./components/NumericInputWithButtons";
import { normalizeToHex } from "./utils/color";
import { clampToImage, simplifyPolygon } from "./utils/polygon";
const DEFAULT_ROI_SIZE = 200;
const DEFAULT_TOPK = 3;
const DEFAULT_SCALE_MIN = 0.5;
const DEFAULT_SCALE_MAX = 1.5;
const DEFAULT_SCALE_STEPS = 12;
export default function App() {
    const headerScrollRef = useRef(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [imageId, setImageId] = useState(null);
    const [datasetId, setDatasetId] = useState(null);
    const [datasetInfo, setDatasetInfo] = useState(null);
    const [projectList, setProjectList] = useState([]);
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectFiles, setNewProjectFiles] = useState(null);
    const [datasetSelectedName, setDatasetSelectedName] = useState(null);
    const [imageStatusMap, setImageStatusMap] = useState({});
    const isLoadingAnnotationsRef = useRef(false);
    const [splitTrain, setSplitTrain] = useState(7);
    const [splitVal, setSplitVal] = useState(2);
    const [splitTest, setSplitTest] = useState(1);
    const [splitSeed, setSplitSeed] = useState(42);
    const [includeNegatives, setIncludeNegatives] = useState(true);
    const [datasetType, setDatasetType] = useState("bbox");
    const [exportFormat, setExportFormat] = useState("folder");
    const [refineContour, setRefineContour] = useState(false);
    const [excludeEnabled, setExcludeEnabled] = useState(true);
    const [excludeMode, setExcludeMode] = useState("same_class");
    const [excludeCenter, setExcludeCenter] = useState(true);
    const [excludeIouThreshold, setExcludeIouThreshold] = useState(0.6);
    const [showExportDrawer, setShowExportDrawer] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [showClassColors, setShowClassColors] = useState(true);
    const [showCommonSettings, setShowCommonSettings] = useState(true);
    const [isCanvasInteracting, setIsCanvasInteracting] = useState(false);
    const interactionTimeoutRef = useRef(null);
    const [showSplitSettings, setShowSplitSettings] = useState(false);
    const [exportResult, setExportResult] = useState(null);
    const [noticeVisible, setNoticeVisible] = useState(true);
    const [hoverAction, setHoverAction] = useState(null);
    const [activeAction, setActiveAction] = useState(null);
    const [exportOutputDir, setExportOutputDir] = useState("");
    const [exportDirHistory, setExportDirHistory] = useState(() => {
        try {
            const raw = localStorage.getItem("draftSeeker.exportDirHistory");
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    });
    const [projects, setProjects] = useState([]);
    const [templateProjects, setTemplateProjects] = useState([]);
    const [templateByDataset, setTemplateByDataset] = useState(() => {
        try {
            const raw = localStorage.getItem("draftseeker.templateByDataset");
            const parsed = raw ? JSON.parse(raw) : {};
            return typeof parsed === "object" && parsed ? parsed : {};
        }
        catch {
            return {};
        }
    });
    const [project, setProject] = useState("");
    const [projectChangeUnlocked, setProjectChangeUnlocked] = useState(false);
    const [classOptions, setClassOptions] = useState([]);
    const [roiSize, setRoiSize] = useState(DEFAULT_ROI_SIZE);
    const [topk, setTopk] = useState(DEFAULT_TOPK);
    const [scaleMin, setScaleMin] = useState(DEFAULT_SCALE_MIN);
    const [scaleMax, setScaleMax] = useState(DEFAULT_SCALE_MAX);
    const [scaleSteps, setScaleSteps] = useState(DEFAULT_SCALE_STEPS);
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState(null);
    const [annotations, setAnnotations] = useState([]);
    const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
    const [annotationFilterClass, setAnnotationFilterClass] = useState("all");
    const [pendingManualBBox, setPendingManualBBox] = useState(null);
    const [pendingManualClass, setPendingManualClass] = useState("");
    const [annotationUndoStack, setAnnotationUndoStack] = useState([]);
    const [annotationRedoStack, setAnnotationRedoStack] = useState([]);
    const annotationEditActiveRef = useRef(false);
    const editSessionRef = useRef(null);
    const [colorMap, setColorMap] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [showCandidates, setShowCandidates] = useState(true);
    const [showAnnotations, setShowAnnotations] = useState(true);
    const canvasRef = useRef(null);
    const [lastClick, setLastClick] = useState(null);
    const [detectDebug, setDetectDebug] = useState(null);
    const [segEditMode, setSegEditMode] = useState(false);
    const [showSegVertices, setShowSegVertices] = useState(true);
    const [selectedVertexIndex, setSelectedVertexIndex] = useState(null);
    const [segUndoStack, setSegUndoStack] = useState([]);
    const [segSimplifyEps, setSegSimplifyEps] = useState(2);
    const [imageSize, setImageSize] = useState(null);
    const [isCreatingManualBBox, setIsCreatingManualBBox] = useState(false);
    const [highlightAnnotationId, setHighlightAnnotationId] = useState(null);
    const highlightTimerRef = useRef(null);
    const [showHints, setShowHints] = useState(() => {
        try {
            return localStorage.getItem("draftSeeker.hideHints") !== "1";
        }
        catch {
            return true;
        }
    });
    const [datasetImporting, setDatasetImporting] = useState(false);
    const [lastImportPath, setLastImportPath] = useState(null);
    const [autoThreshold, setAutoThreshold] = useState(0.7);
    const [autoClassFilter, setAutoClassFilter] = useState([]);
    const [autoMethod, setAutoMethod] = useState("combined");
    const [autoPanelOpen, setAutoPanelOpen] = useState(true);
    const [autoAdvancedOpen, setAutoAdvancedOpen] = useState(false);
    const [autoStride, setAutoStride] = useState(null);
    const [advancedBaseline, setAdvancedBaseline] = useState(null);
    const [autoBaseline, setAutoBaseline] = useState(null);
    const [autoRunning, setAutoRunning] = useState(false);
    const [autoResult, setAutoResult] = useState(null);
    const [autoProgress, setAutoProgress] = useState(0);
    const [lastAutoAddedIds, setLastAutoAddedIds] = useState([]);
    const autoProgressTimerRef = useRef(null);
    const [checkedAnnotationIds, setCheckedAnnotationIds] = useState([]);
    const annotationRowRefs = useRef({});
    const folderInputRef = useRef(null);
    const exportDirInputRef = useRef(null);
    const [coordDebug, setCoordDebug] = useState(null);
    const [templatePreviewBase64, setTemplatePreviewBase64] = useState(null);
    const templatePreviewCacheRef = useRef(new Map());
    const didAutoRestoreRef = useRef(false);
    const VIEW_STATE_KEY = "draftseeker:viewState:v1";
    const [viewState, setViewState] = useState(() => {
        try {
            const raw = localStorage.getItem(VIEW_STATE_KEY);
            if (!raw)
                return { view: "home" };
            const parsed = JSON.parse(raw);
            if (parsed && parsed.view === "project" && typeof parsed.projectName === "string") {
                return {
                    view: "project",
                    projectName: parsed.projectName,
                    lastImageKey: typeof parsed.lastImageKey === "string" ? parsed.lastImageKey : undefined,
                };
            }
            return { view: "home" };
        }
        catch {
            return { view: "home" };
        }
    });
    const [leftFilter, setLeftFilter] = useState(() => {
        try {
            const raw = localStorage.getItem("draftseeker:leftFilter:v1");
            if (raw === "annotated" || raw === "unannotated")
                return raw;
            return "all";
        }
        catch {
            return "all";
        }
    });
    const restoredImageRef = useRef(false);
    const asChildren = (nodes) => React.Children.toArray(nodes);
    const dismissHints = () => {
        setShowHints(false);
        try {
            localStorage.setItem("draftSeeker.hideHints", "1");
        }
        catch {
            // ignore
        }
    };
    const addExportDirHistory = (dir) => {
        const cleaned = dir.trim();
        if (!cleaned)
            return;
        setExportDirHistory((prev) => {
            const next = [cleaned, ...prev.filter((item) => item !== cleaned)].slice(0, 8);
            try {
                localStorage.setItem("draftSeeker.exportDirHistory", JSON.stringify(next));
            }
            catch {
                // ignore
            }
            return next;
        });
    };
    const refreshProjectList = async () => {
        try {
            const list = await listDatasetProjects();
            const enriched = await Promise.all(list.map(async (p) => {
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
                }
                catch {
                    return p;
                }
            }));
            setProjectList(enriched);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Project list failed");
        }
    };
    const selectedCandidate = useMemo(() => {
        if (!selectedCandidateId)
            return null;
        return candidates.find((c) => c.id === selectedCandidateId) || null;
    }, [candidates, selectedCandidateId]);
    const isManualSelected = useMemo(() => selectedCandidate?.source === "manual", [selectedCandidate]);
    const manualClassMissing = useMemo(() => isManualSelected && !selectedCandidate?.class_name, [isManualSelected, selectedCandidate]);
    const selectedAnnotation = useMemo(() => {
        if (!selectedAnnotationId)
            return null;
        return annotations.find((a) => a.id === selectedAnnotationId) || null;
    }, [annotations, selectedAnnotationId]);
    const filteredAnnotations = useMemo(() => {
        if (annotationFilterClass === "all")
            return annotations;
        return annotations.filter((a) => a.class_name === annotationFilterClass);
    }, [annotations, annotationFilterClass]);
    const imagesAll = useMemo(() => (datasetInfo?.images ? [...datasetInfo.images] : []), [datasetInfo]);
    const filteredImages = useMemo(() => {
        if (leftFilter === "all")
            return imagesAll;
        if (leftFilter === "annotated") {
            return imagesAll.filter((entry) => {
                const name = entry.original_filename || entry.filename || "";
                return (imageStatusMap[name] || 0) > 0;
            });
        }
        return imagesAll.filter((entry) => {
            const name = entry.original_filename || entry.filename || "";
            return (imageStatusMap[name] || 0) === 0;
        });
    }, [imagesAll, imageStatusMap, leftFilter]);
    const sortedAnnotations = useMemo(() => {
        return [...filteredAnnotations].sort((a, b) => {
            const ay = a.bbox.y;
            const by = b.bbox.y;
            if (ay !== by)
                return ay - by;
            return a.bbox.x - b.bbox.x;
        });
    }, [filteredAnnotations]);
    useEffect(() => {
        if (checkedAnnotationIds.length === 0)
            return;
        const currentIds = new Set(annotations.map((a) => a.id));
        const next = checkedAnnotationIds.filter((id) => currentIds.has(id));
        if (next.length !== checkedAnnotationIds.length) {
            setCheckedAnnotationIds(next);
        }
    }, [annotations, checkedAnnotationIds]);
    useEffect(() => {
        if (annotationFilterClass === "all")
            return;
        if (!selectedAnnotationId)
            return;
        const stillVisible = annotations.some((a) => a.id === selectedAnnotationId && a.class_name === annotationFilterClass);
        if (!stillVisible) {
            setSelectedAnnotationId(null);
        }
    }, [annotationFilterClass, annotations, selectedAnnotationId]);
    const cloneAnnotations = (items) => items.map((a) => ({
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
    const clampBBoxToImage = (bbox) => {
        if (!imageSize)
            return bbox;
        const w = Math.max(4, Math.min(imageSize.w, bbox.w));
        const h = Math.max(4, Math.min(imageSize.h, bbox.h));
        const x = Math.min(imageSize.w - w, Math.max(0, bbox.x));
        const y = Math.min(imageSize.h - h, Math.max(0, bbox.y));
        return { x, y, w, h };
    };
    const splitSummary = useMemo(() => {
        const images = (datasetInfo?.images || [])
            .map((entry) => entry.original_filename || entry.filename || "")
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
    const isSameArray = (a, b) => a.length === b.length && a.every((v, idx) => v === b[idx]);
    const advancedDirty = useMemo(() => {
        if (!advancedBaseline)
            return false;
        return (roiSize !== advancedBaseline.roiSize ||
            topk !== advancedBaseline.topk ||
            scaleMin !== advancedBaseline.scaleMin ||
            scaleMax !== advancedBaseline.scaleMax ||
            scaleSteps !== advancedBaseline.scaleSteps ||
            excludeEnabled !== advancedBaseline.excludeEnabled ||
            excludeMode !== advancedBaseline.excludeMode ||
            excludeCenter !== advancedBaseline.excludeCenter ||
            excludeIouThreshold !== advancedBaseline.excludeIouThreshold ||
            refineContour !== advancedBaseline.refineContour);
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
        if (!autoBaseline)
            return false;
        return (autoThreshold !== autoBaseline.autoThreshold ||
            autoMethod !== autoBaseline.autoMethod ||
            autoStride !== autoBaseline.autoStride ||
            scaleMin !== autoBaseline.scaleMin ||
            scaleMax !== autoBaseline.scaleMax ||
            scaleSteps !== autoBaseline.scaleSteps ||
            roiSize !== autoBaseline.roiSize ||
            !isSameArray(autoClassFilter, autoBaseline.autoClassFilter));
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
    const strideDanger = typeof autoStride === "number" && (autoStride < 16 || autoStride > 256);
    const strideWarn = typeof autoStride === "number" && (autoStride < 32 || autoStride > 128);
    const handleBrowseExportDir = async () => {
        try {
            if ("showDirectoryPicker" in window) {
                // @ts-expect-error - File System Access API (browser dependent)
                const handle = await window.showDirectoryPicker();
                if (handle?.name) {
                    setExportOutputDir(handle.name);
                    setExportDirHistory((prev) => prev.includes(handle.name) ? prev : [handle.name, ...prev].slice(0, 8));
                }
                return;
            }
            exportDirInputRef.current?.click();
        }
        catch {
            // ignore cancel
        }
    };
    const handleExportDirPicked = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0)
            return;
        const first = files[0];
        const rel = first.webkitRelativePath || "";
        const topDir = rel.split("/")[0];
        if (topDir) {
            setExportOutputDir(topDir);
            setExportDirHistory((prev) => prev.includes(topDir) ? prev : [topDir, ...prev].slice(0, 8));
        }
        event.target.value = "";
    };
    const totalAnnotations = useMemo(() => Object.values(imageStatusMap).reduce((acc, v) => acc + v, 0), [imageStatusMap]);
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
        const warnings = [];
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
        const errors = [];
        if (classesCount === 0 || totalAnnotations === 0) {
            errors.push("クラスが 0 件のためエクスポートできません");
        }
        return errors;
    }, [classesCount, totalAnnotations]);
    const canExport = exportErrors.length === 0;
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!selectedCandidate || segEditMode)
                return;
            const target = event.target;
            const tag = target?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select")
                return;
            let dx = 0;
            let dy = 0;
            const step = event.shiftKey ? 10 : 1;
            if (event.key === "ArrowLeft")
                dx = -step;
            if (event.key === "ArrowRight")
                dx = step;
            if (event.key === "ArrowUp")
                dy = -step;
            if (event.key === "ArrowDown")
                dy = step;
            if (dx === 0 && dy === 0)
                return;
            event.preventDefault();
            setCandidates((prev) => prev.map((c) => {
                if (c.id !== selectedCandidate.id)
                    return c;
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
            }));
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedCandidate, segEditMode, imageSize]);
    useEffect(() => {
        let mounted = true;
        document.body.style.margin = "0";
        document.body.style.overflow = "hidden";
        fetchProjects()
            .then((list) => {
            if (!mounted)
                return;
            setProjects(list);
            if (!project && list.length > 0) {
                setProject(list[0]);
            }
        })
            .catch((err) => {
            if (!mounted)
                return;
            setError(err instanceof Error ? err.message : "Projects fetch failed");
        });
        fetchTemplates()
            .then((list) => {
            if (!mounted)
                return;
            setTemplateProjects(list);
            const selected = list.find((p) => p.name === project) || list[0];
            const classes = selected
                ? selected.classes.map((c) => c.class_name)
                : [];
            setClassOptions(classes);
        })
            .catch((err) => {
            if (!mounted)
                return;
            setError(err instanceof Error ? err.message : "Templates fetch failed");
        });
        refreshProjectList();
        return () => {
            mounted = false;
            document.body.style.overflow = "";
        };
    }, [project]);
    useEffect(() => {
        if (didAutoRestoreRef.current)
            return;
        if (projectList.length === 0)
            return;
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
        restoredImageRef.current = false;
        void handleOpenProject(viewState.projectName);
    }, [projectList, datasetId, viewState]);
    const handleFolderImport = async (event) => {
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
            const rel = first.webkitRelativePath || "";
            if (rel.includes("/")) {
                setLastImportPath(rel.split("/")[0]);
            }
        }
        if (files.length === 0)
            return;
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Dataset import failed");
        }
        finally {
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
    const handleProjectTemplateChange = async (nextProject) => {
        if (nextProject === project) {
            setProjectChangeUnlocked(false);
            return;
        }
        const ok = window.confirm("プロジェクト（テンプレ）を変更します。\nクラス定義が変わる可能性があるため、現在のアノテーション（確定/候補）とUI状態は全て削除し、クラス一覧を再読み込みします。続行しますか？");
        if (!ok) {
            setProjectChangeUnlocked(false);
            return;
        }
        resetAnnotationWorkState();
        if (datasetId) {
            try {
                await clearProjectAnnotations(datasetId);
            }
            catch {
                // ignore clear failures
            }
        }
        if (datasetId) {
            setTemplateByDataset((prev) => {
                const next = { ...prev, [datasetId]: nextProject };
                try {
                    localStorage.setItem("draftseeker.templateByDataset", JSON.stringify(next));
                }
                catch {
                    // ignore
                }
                return next;
            });
        }
        setProject(nextProject);
        try {
            const list = await fetchTemplates();
            const selected = list.find((p) => p.name === nextProject) || list[0];
            const classes = selected
                ? selected.classes.map((c) => c.class_name)
                : [];
            setClassOptions(classes);
            const nextColors = buildColorMapFromClasses(classes);
            setColorMap(nextColors);
            setAutoClassFilter(classes);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Templates fetch failed");
        }
        finally {
            setProjectChangeUnlocked(false);
        }
    };
    const handleSelectDatasetImage = async (filename) => {
        if (!datasetId)
            return;
        await loadDatasetImage(datasetId, filename);
    };
    const handleOpenProject = async (projectName) => {
        setError(null);
        setNotice(null);
        setBusy(true);
        setShowCommonSettings(false);
        setShowAdvanced(false);
        setShowDebug(false);
        setAutoAdvancedOpen(false);
        setAutoPanelOpen(false);
        setShowSplitSettings(false);
        setShowExportDrawer(false);
        setViewState((prev) => prev.view === "project" && prev.projectName === projectName
            ? prev
            : { view: "project", projectName });
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
            }
            else {
                const nextColors = buildColorMapFromClasses(classOptions);
                setColorMap(nextColors);
                saveColorMapForProject(projectName, nextColors);
            }
            const storedAuto = loadAutoSettingsForProject(projectName);
            if (storedAuto) {
                if (typeof storedAuto.autoThreshold === "number")
                    setAutoThreshold(storedAuto.autoThreshold);
                if (storedAuto.autoMethod)
                    setAutoMethod(storedAuto.autoMethod);
            }
            const allClasses = classOptions.length > 0 ? classOptions : [];
            setAutoClassFilter(allClasses);
            if (info.images.length > 0) {
                void loadAllAnnotationCounts(projectName, info.images);
            }
            if (info.images.length > 0) {
                await loadDatasetImage(projectName, info.images[0].original_filename);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Project open failed");
        }
        finally {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Project create failed");
        }
    };
    const handleDeleteProject = async (name) => {
        if (!window.confirm(`本当に削除しますか？\n${name}`))
            return;
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Project delete failed");
        }
    };
    const handleExportDatasetBBox = async () => {
        if (!datasetId || !datasetInfo)
            return;
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
                const url = `${API_BASE}/dataset/export/download?project_name=${encodeURIComponent(datasetId)}&export_id=${encodeURIComponent(res.export_id)}`;
                window.location.href = url;
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Dataset export failed";
            setError(message);
            setExportResult({ ok: false, message });
        }
        finally {
            setBusy(false);
        }
    };
    const handleExportDatasetSeg = async () => {
        if (!datasetId || !datasetInfo)
            return;
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
                const url = `${API_BASE}/dataset/export/download?project_name=${encodeURIComponent(datasetId)}&export_id=${encodeURIComponent(res.export_id)}`;
                window.location.href = url;
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Dataset export failed";
            setError(message);
            setExportResult({ ok: false, message });
        }
        finally {
            setBusy(false);
        }
    };
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const handleClickPoint = async (x, y) => {
        if (isCreatingManualBBox)
            return;
        if (manualClassMissing)
            return;
        if (annotationEditActiveRef.current)
            return;
        if (!imageId || !project)
            return;
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
                nextCandidates.forEach((r) => {
                    if (!next[r.class_name]) {
                        next[r.class_name] = pickUniqueColor(next);
                    }
                });
                return next;
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Detect failed");
            setDetectDebug(null);
        }
        finally {
            setBusy(false);
        }
    };
    const handleConfirmCandidate = () => {
        if (!selectedCandidate)
            return;
        if (selectedCandidate.source === "manual" && !selectedCandidate.class_name) {
            setError("手動候補はクラスを選択してください");
            return;
        }
        pushAnnotationHistory();
        const createdAt = new Date().toISOString();
        const source = selectedCandidate.source === "manual"
            ? "manual"
            : selectedCandidate.segPolygon
                ? "sam"
                : "template";
        const score = typeof selectedCandidate.score === "number"
            ? selectedCandidate.score
            : selectedCandidate.source === "manual"
                ? 1.0
                : undefined;
        const segPolygon = selectedCandidate.segPolygon
            ? selectedCandidate.segPolygon.map((p) => ({ ...p }))
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
                    ? segPolygon.map((p) => ({ ...p }))
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
        if (!selectedCandidate)
            return;
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
        if (candidates.length === 0)
            return;
        const index = selectedCandidateId
            ? candidates.findIndex((c) => c.id === selectedCandidateId)
            : -1;
        const nextIndex = index >= 0 ? (index + 1) % candidates.length : 0;
        setSelectedCandidateId(candidates[nextIndex].id);
    };
    const handleSegCandidate = async () => {
        if (!selectedCandidate || !imageId)
            return;
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
            setCandidates((prev) => prev.map((c) => c.id === selectedCandidate.id
                ? { ...c, segPolygon: nextPolygon, segMethod: res.meta?.method }
                : c));
            setNotice(`${selectedCandidate.class_name} のSegを生成しました`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Segmentation failed");
        }
        finally {
            setBusy(false);
        }
    };
    useEffect(() => {
        const handleShortcut = (event) => {
            if (!selectedCandidate)
                return;
            const target = event.target;
            const tag = target?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select")
                return;
            const key = event.key;
            if (key === "Enter") {
                event.preventDefault();
                if (!manualClassMissing)
                    handleConfirmCandidate();
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
        const handleKey = (event) => {
            const target = event.target;
            const tag = target?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select")
                return;
            const isMeta = event.metaKey || event.ctrlKey;
            if (isMeta && event.key.toLowerCase() === "z") {
                event.preventDefault();
                if (event.shiftKey) {
                    setAnnotationRedoStack((redoPrev) => {
                        if (redoPrev.length === 0)
                            return redoPrev;
                        const next = redoPrev[redoPrev.length - 1];
                        setAnnotationUndoStack((undoPrev) => [...undoPrev, cloneAnnotations(annotations)]);
                        setAnnotations(next);
                        return redoPrev.slice(0, -1);
                    });
                }
                else {
                    setAnnotationUndoStack((undoPrev) => {
                        if (undoPrev.length === 0)
                            return undoPrev;
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
                    if (redoPrev.length === 0)
                        return redoPrev;
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
    const pickUniqueColor = (existing) => {
        const used = new Set(Object.values(existing));
        for (let i = 0; i < 20; i += 1) {
            const hue = Math.floor(Math.random() * 360);
            const color = normalizeToHex(`hsl(${hue}, 70%, 50%)`);
            if (!used.has(color))
                return color;
        }
        return "#000000";
    };
    const loadColorMapForProject = (projectName) => {
        try {
            const raw = localStorage.getItem(`draftseeker.colorMap.${projectName}`);
            if (!raw)
                return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object")
                return null;
            return parsed;
        }
        catch {
            return null;
        }
    };
    const saveColorMapForProject = (projectName, next) => {
        try {
            localStorage.setItem(`draftseeker.colorMap.${projectName}`, JSON.stringify(next));
        }
        catch {
            // ignore
        }
    };
    const buildColorMapFromClasses = (classes) => {
        const next = {};
        classes.forEach((name) => {
            if (!next[name])
                next[name] = pickUniqueColor(next);
        });
        return next;
    };
    const loadAdvancedSettingsForProject = (projectName) => {
        try {
            const raw = localStorage.getItem(`draftseeker.advanced.${projectName}`);
            if (!raw)
                return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object")
                return null;
            return parsed;
        }
        catch {
            return null;
        }
    };
    const saveAdvancedSettingsForProject = (projectName) => {
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
        }
        catch {
            // ignore
        }
    };
    const loadAutoSettingsForProject = (projectName) => {
        try {
            const raw = localStorage.getItem(`draftseeker.auto.${projectName}`);
            if (!raw)
                return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object")
                return null;
            return parsed;
        }
        catch {
            return null;
        }
    };
    const saveAutoSettingsForProject = (projectName) => {
        try {
            const payload = {
                autoThreshold,
                autoMethod,
                autoClassFilter,
            };
            localStorage.setItem(`draftseeker.auto.${projectName}`, JSON.stringify(payload));
        }
        catch {
            // ignore
        }
    };
    const normalizeLoadedAnnotations = (items) => {
        const now = Date.now();
        return items.map((ann, idx) => ({
            id: ann.id || `${now}-${Math.random()}-${idx}`,
            class_name: ann.class_name,
            bbox: ann.bbox,
            source: ann.source === "template" || ann.source === "manual" || ann.source === "sam"
                ? ann.source
                : "template",
            created_at: ann.created_at || new Date().toISOString(),
            score: ann.score,
            segPolygon: ann.segPolygon,
            originalSegPolygon: ann.originalSegPolygon,
            segMethod: ann.segMethod,
        }));
    };
    const loadDatasetImage = async (projectName, filename) => {
        setError(null);
        setBusy(true);
        try {
            setViewState((prev) => {
                if (prev.view === "project" && prev.projectName === projectName) {
                    return { ...prev, lastImageKey: `${projectName}::${filename}` };
                }
                return { view: "project", projectName, lastImageKey: `${projectName}::${filename}` };
            });
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Dataset select failed");
        }
        finally {
            setBusy(false);
        }
    };
    const loadAllAnnotationCounts = async (projectName, images) => {
        if (!projectName || images.length === 0)
            return;
        try {
            const entries = await Promise.all(images.map(async (entry) => {
                const name = entry.original_filename || entry.filename || "";
                if (!name)
                    return null;
                try {
                    const loaded = await loadAnnotations({ project_name: projectName, image_key: name });
                    return [name, loaded.annotations?.length || 0];
                }
                catch {
                    return [name, 0];
                }
            }));
            const next = {};
            entries.forEach((item) => {
                if (!item)
                    return;
                next[item[0]] = item[1];
            });
            setImageStatusMap(next);
        }
        catch {
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
                if (prev >= 90)
                    return 90;
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
            }
            else {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Auto annotate failed");
        }
        finally {
            setAutoRunning(false);
            setAutoProgress(100);
            if (autoProgressTimerRef.current) {
                window.clearInterval(autoProgressTimerRef.current);
                autoProgressTimerRef.current = null;
            }
        }
    };
    const handleUndoAutoAnnotate = () => {
        if (lastAutoAddedIds.length === 0)
            return;
        pushAnnotationHistory();
        setAnnotations((prev) => prev.filter((ann) => !lastAutoAddedIds.includes(ann.id)));
        setCheckedAnnotationIds((prev) => prev.filter((id) => !lastAutoAddedIds.includes(id)));
        setLastAutoAddedIds([]);
        setNotice("直前の全自動追加分を取り消しました");
    };
    const handleSelectAnnotation = (annotation) => {
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
        if (segUndoStack.length === 0 || !selectedAnnotation)
            return;
        const last = segUndoStack[segUndoStack.length - 1];
        setSegUndoStack((prev) => prev.slice(0, -1));
        setAnnotations((prev) => prev.map((a) => a.id === selectedAnnotation.id
            ? { ...a, segPolygon: last.map((p) => ({ ...p })) }
            : a));
    };
    const handleSegReset = () => {
        if (!selectedAnnotation?.originalSegPolygon)
            return;
        const reset = selectedAnnotation.originalSegPolygon.map((p) => ({
            ...p,
        }));
        setSegUndoStack([]);
        setAnnotations((prev) => prev.map((a) => (a.id === selectedAnnotation.id ? { ...a, segPolygon: reset } : a)));
    };
    const sameAnnotationShape = (a, b) => {
        if (!a || !b)
            return false;
        if (a.bbox.x !== b.bbox.x ||
            a.bbox.y !== b.bbox.y ||
            a.bbox.w !== b.bbox.w ||
            a.bbox.h !== b.bbox.h) {
            return false;
        }
        const ap = a.segPolygon;
        const bp = b.segPolygon;
        if (!ap && !bp)
            return true;
        if (!ap || !bp)
            return false;
        if (ap.length !== bp.length)
            return false;
        for (let i = 0; i < ap.length; i += 1) {
            if (ap[i].x !== bp[i].x || ap[i].y !== bp[i].y)
                return false;
        }
        return true;
    };
    const applySegSimplify = () => {
        if (!selectedAnnotation?.segPolygon)
            return;
        let next = selectedAnnotation.segPolygon;
        if (imageSize) {
            next = clampToImage(next, imageSize.w, imageSize.h);
        }
        next = simplifyPolygon(next, segSimplifyEps);
        setAnnotations((prev) => prev.map((a) => (a.id === selectedAnnotation.id ? { ...a, segPolygon: next } : a)));
    };
    useEffect(() => {
        if (!datasetSelectedName)
            return;
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
            if (cancelled)
                return;
            if (res?.base64) {
                templatePreviewCacheRef.current.set(cacheKey, res.base64);
                setTemplatePreviewBase64(res.base64);
            }
            else {
                setTemplatePreviewBase64(null);
            }
        })
            .catch(() => {
            if (!cancelled)
                setTemplatePreviewBase64(null);
        });
        return () => {
            cancelled = true;
        };
    }, [showDebug, selectedCandidateId, candidates, project]);
    useEffect(() => {
        if (!selectedAnnotationId)
            return;
        const el = annotationRowRefs.current[selectedAnnotationId];
        if (!el)
            return;
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }, [selectedAnnotationId]);
    useEffect(() => {
        if (!datasetId || !datasetSelectedName)
            return;
        if (isLoadingAnnotationsRef.current)
            return;
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
        }
        catch {
            // ignore
        }
    }, [viewState]);
    useEffect(() => {
        if (!datasetId || !datasetInfo)
            return;
        if (viewState.view !== "project" || viewState.projectName !== datasetId)
            return;
        if (restoredImageRef.current)
            return;
        const key = viewState.lastImageKey;
        if (!key || !key.startsWith(`${datasetId}::`)) {
            restoredImageRef.current = true;
            return;
        }
        const filename = key.slice(`${datasetId}::`.length);
        const exists = datasetInfo.images?.some((img) => (img.original_filename || img.filename) === filename);
        restoredImageRef.current = true;
        if (!exists)
            return;
        if (datasetSelectedName === filename)
            return;
        void loadDatasetImage(datasetId, filename);
    }, [datasetId, datasetInfo, viewState, datasetSelectedName]);
    useEffect(() => {
        if (!notice)
            return;
        setNoticeVisible(true);
        const timer = window.setTimeout(() => {
            setNoticeVisible(false);
        }, 3000);
        return () => window.clearTimeout(timer);
    }, [notice]);
    useEffect(() => {
        try {
            localStorage.setItem("draftseeker:leftFilter:v1", leftFilter);
        }
        catch {
            // ignore
        }
    }, [leftFilter]);
    useEffect(() => {
        if (!datasetId)
            return;
        if (Object.keys(colorMap).length === 0)
            return;
        saveColorMapForProject(datasetId, colorMap);
    }, [colorMap, datasetId]);
    useEffect(() => {
        if (!datasetId)
            return;
        const saved = loadAdvancedSettingsForProject(datasetId);
        const baseline = {
            roiSize: typeof saved?.roiSize === "number" ? saved.roiSize : DEFAULT_ROI_SIZE,
            topk: typeof saved?.topk === "number" ? saved.topk : DEFAULT_TOPK,
            scaleMin: typeof saved?.scaleMin === "number" ? saved.scaleMin : DEFAULT_SCALE_MIN,
            scaleMax: typeof saved?.scaleMax === "number" ? saved.scaleMax : DEFAULT_SCALE_MAX,
            scaleSteps: typeof saved?.scaleSteps === "number" ? saved.scaleSteps : DEFAULT_SCALE_STEPS,
            excludeEnabled: typeof saved?.excludeEnabled === "boolean" ? saved.excludeEnabled : true,
            excludeMode: saved?.excludeMode === "same_class" || saved?.excludeMode === "any_class"
                ? saved.excludeMode
                : "same_class",
            excludeCenter: typeof saved?.excludeCenter === "boolean" ? saved.excludeCenter : true,
            excludeIouThreshold: typeof saved?.excludeIouThreshold === "number" ? saved.excludeIouThreshold : 0.6,
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
        if (!datasetId)
            return;
        const saved = loadAutoSettingsForProject(datasetId);
        const baseline = {
            autoThreshold: typeof saved?.autoThreshold === "number" ? saved.autoThreshold : 0.7,
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
        if (!datasetId)
            return;
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
        if (!datasetId)
            return;
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
        if (!showExportDrawer)
            return;
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                closeExportDrawer();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [showExportDrawer]);
    return (_jsxs("div", { className: "appRoot", style: {
            fontFamily: "\"IBM Plex Sans\", system-ui, sans-serif",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--bg)",
            color: "var(--text)",
        }, children: [_jsx("style", { children: `
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
        .btnDebug {
          background: #fff7ed !important;
          border-color: #fdba74 !important;
          color: #9a3412 !important;
          box-shadow: none !important;
        }
        .btnDebug.isOpen {
          background: #ffe8cc !important;
          border-color: #f59e0b !important;
          color: #92400e !important;
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
      ` }), _jsxs("div", { className: "topBar", style: {
                    padding: "12px 20px",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 16 }, children: [_jsx("div", { style: { flex: 1, display: "flex", alignItems: "center" }, children: _jsx("img", { src: "/lgo_DraftSeeker.png", alt: "DraftSeeker", style: { height: 36, width: "auto", display: "block" } }) }), _jsxs("div", { style: {
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                }, children: [datasetId && (_jsx("button", { type: "button", onClick: handleBackToHome, className: "btn btnSecondary", style: {
                                            height: 30,
                                            padding: "0 10px",
                                        }, children: "Project Home\u3078\u623B\u308B" })), datasetId && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => {
                                                    if (!exportOutputDir.trim()) {
                                                        setExportOutputDir("~/Downloads");
                                                    }
                                                    setExportResult(null);
                                                    setShowExportDrawer(true);
                                                }, className: "btn btnSecondary", style: {
                                                    height: 30,
                                                    padding: "0 10px",
                                                }, children: "Export dataset" }), _jsxs("label", { style: {
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    height: 30,
                                                    padding: "4px 6px",
                                                    border: "1px solid var(--border)",
                                                    borderRadius: 8,
                                                    background: "var(--panel2)",
                                                    opacity: 0.9,
                                                }, children: [_jsx("span", { style: { fontSize: 11 }, children: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8" }), _jsxs("select", { value: project, onChange: (e) => handleProjectTemplateChange(e.target.value), disabled: !projectChangeUnlocked, style: {
                                                            minWidth: 120,
                                                            height: 22,
                                                            fontSize: 11,
                                                            opacity: projectChangeUnlocked ? 1 : 0.6,
                                                            cursor: projectChangeUnlocked ? "pointer" : "not-allowed",
                                                        }, children: [projects.length === 0 && (_jsx("option", { value: "", children: "(none)" }, "project-none")), asChildren(projects.map((p, idx) => (_jsx("option", { value: p, children: p }, `${p}-${idx}`))))] }), _jsx("button", { type: "button", className: "btn btnGhost", style: { height: 22, padding: "0 8px", fontSize: 10 }, onClick: () => {
                                                            if (projects.length <= 1) {
                                                                setNotice("現在は1種類のため変更不要です");
                                                                return;
                                                            }
                                                            setProjectChangeUnlocked(true);
                                                        }, children: "\u5909\u66F4\u2026" })] }), _jsxs("label", { style: {
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    height: 30,
                                                    padding: "4px 6px",
                                                    border: "1px solid #e3e3e3",
                                                    borderRadius: 8,
                                                    background: "#fafafa",
                                                }, children: [_jsx("input", { ref: folderInputRef, type: "file", multiple: true, ...{
                                                            webkitdirectory: "true",
                                                            directory: "true",
                                                        }, onChange: handleFolderImport, style: { display: "none" }, disabled: !datasetId }), _jsx("button", { type: "button", onClick: () => folderInputRef.current?.click(), disabled: !datasetId, className: "btn btnSecondary", style: {
                                                            height: 22,
                                                            padding: "0 8px",
                                                            fontSize: 11,
                                                            cursor: datasetId ? "pointer" : "not-allowed",
                                                            opacity: datasetId ? 1 : 0.6,
                                                        }, children: "\u753B\u50CF\u53D6\u308A\u8FBC\u307F" }), _jsx("span", { style: { fontSize: 11, color: "#666" }, children: lastImportPath ? lastImportPath : "未取込" })] })] }))] })] }), datasetImporting && (_jsx("div", { style: { marginTop: 8, fontSize: 12, color: "#666" }, children: "Dataset import\u4E2D..." }))] }), datasetId && (_jsx("div", { ref: headerScrollRef, onWheel: (e) => {
                    if (!headerScrollRef.current)
                        return;
                    headerScrollRef.current.scrollLeft += e.deltaY;
                    e.preventDefault();
                }, style: {
                    padding: "8px 20px",
                    borderBottom: "1px solid #eee",
                    background: "#fff",
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                } })), showExportDrawer && (_jsxs(_Fragment, { children: [_jsx("div", { onClick: closeExportDrawer, style: {
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.25)",
                            zIndex: 40,
                        } }), _jsxs("div", { className: "panelShell", style: {
                            position: "fixed",
                            top: 0,
                            right: 0,
                            height: "100vh",
                            width: 420,
                            zIndex: 50,
                            display: "flex",
                            flexDirection: "column",
                        }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                                    padding: "14px 16px",
                                    borderBottom: "1px solid var(--border)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }, children: [_jsx("div", { className: "sectionTitle", children: "Export dataset" }), _jsx("button", { type: "button", onClick: closeExportDrawer, className: "btn btnGhost", style: {
                                            fontSize: 18,
                                            width: 32,
                                            height: 32,
                                            padding: 0,
                                            boxShadow: "none",
                                        }, children: "\u00D7" })] }), _jsxs("div", { style: { padding: 16, overflowY: "auto", display: "grid", gap: 12 }, children: [_jsxs("div", { className: "sectionCard muted", style: { pointerEvents: "none" }, children: [_jsx("div", { className: "sectionTitle", children: "Summary" }), _jsxs("div", { className: "sectionBody", style: { fontSize: 12, color: "var(--muted)" }, children: [_jsxs("div", { children: ["Project: ", project || "-"] }), _jsxs("div", { children: ["Dataset: ", datasetInfo?.project_name || "-"] }), _jsxs("div", { children: ["Total images: ", totalImages] }), _jsxs("div", { children: ["Annotated images: ", annotatedImages] }), _jsxs("div", { children: ["Total annotations: ", totalAnnotations] }), _jsxs("div", { children: ["Classes: ", classesCount] }), _jsxs("div", { children: ["Negative include: ", includeNegatives ? "ON" : "OFF"] })] })] }), _jsxs("div", { className: "sectionCard", children: [_jsx("button", { type: "button", onClick: () => setShowSplitSettings((prev) => !prev), className: "btn btnGhost", style: {
                                                    width: "100%",
                                                    height: 32,
                                                    marginBottom: 8,
                                                }, children: "Split settings" }), showSplitSettings && (_jsxs("div", { className: "sectionBody", children: [_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }, children: [_jsxs("label", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [_jsx("span", { style: { fontSize: 11, color: "#666" }, children: "Train" }), _jsx("input", { type: "number", min: 0, value: splitTrain, onChange: (e) => setSplitTrain(Number(e.target.value)), className: "inputCompact", style: { height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" } })] }), _jsxs("label", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [_jsx("span", { style: { fontSize: 11, color: "#666" }, children: "Val" }), _jsx("input", { type: "number", min: 0, value: splitVal, onChange: (e) => setSplitVal(Number(e.target.value)), className: "inputCompact", style: { height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" } })] }), _jsxs("label", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [_jsx("span", { style: { fontSize: 11, color: "#666" }, children: "Test" }), _jsx("input", { type: "number", min: 0, value: splitTest, onChange: (e) => setSplitTest(Number(e.target.value)), className: "inputCompact", style: { height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" } })] })] }), _jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 8 }, children: [_jsx("span", { style: { fontSize: 11, color: "#666" }, children: "Seed" }), _jsx("input", { type: "number", value: splitSeed, onChange: (e) => setSplitSeed(Number(e.target.value)), className: "inputMid", style: { height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)" } })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 8 }, children: [_jsx("input", { type: "checkbox", checked: includeNegatives, onChange: (e) => setIncludeNegatives(e.target.checked) }), _jsx("span", { style: { fontSize: 12 }, children: "\u672A\u30A2\u30CE\u30C6\uFF08\u30CD\u30AC\u30C6\u30A3\u30D6\uFF09\u3092\u542B\u3081\u308B" })] })] }))] }), _jsxs("div", { className: "sectionCard", children: [_jsx("div", { className: "sectionTitle", children: "Dataset type" }), _jsxs("div", { className: "sectionBody", children: [_jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [_jsx("input", { type: "radio", name: "datasetType", checked: datasetType === "bbox", onChange: () => setDatasetType("bbox") }), _jsx("span", { style: { fontSize: 12 }, children: "bbox (YOLO)" })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, color: "#999" }, children: [_jsx("input", { type: "radio", name: "datasetType", checked: datasetType === "seg", disabled: true }), _jsx("span", { style: { fontSize: 12 }, children: "seg (disabled)" })] })] })] }), _jsxs("div", { className: "sectionCard", children: [_jsx("div", { className: "sectionTitle", children: "Output directory" }), _jsxs("div", { className: "sectionBody", style: { display: "grid", gap: 8 }, children: [_jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("input", { ref: exportDirInputRef, type: "file", multiple: true, ...{
                                                                    webkitdirectory: "true",
                                                                    directory: "true",
                                                                }, onChange: handleExportDirPicked, style: { display: "none" } }), _jsx("input", { type: "text", placeholder: "/Users/you/exports", value: exportOutputDir, onChange: (e) => setExportOutputDir(e.target.value), style: { height: 32, padding: "0 8px", flex: 1 } }), _jsx("button", { type: "button", onClick: handleBrowseExportDir, className: "btn btnSecondary", style: {
                                                                    height: 32,
                                                                    padding: "0 10px",
                                                                }, children: "Browse..." })] }), exportDirHistory.length > 0 && (_jsxs("div", { style: { marginTop: 8, display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { style: { fontSize: 11, color: "#666" }, children: "\u5C65\u6B74" }), _jsxs("select", { value: "", onChange: (e) => {
                                                                    if (e.target.value) {
                                                                        setExportOutputDir(e.target.value);
                                                                    }
                                                                }, style: {
                                                                    height: 28,
                                                                    fontSize: 11,
                                                                    borderRadius: 6,
                                                                    border: "1px solid var(--border)",
                                                                    padding: "0 6px",
                                                                    background: "var(--panel)",
                                                                }, children: [_jsx("option", { value: "", children: "\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044" }), exportDirHistory.map((dir, idx) => (_jsx("option", { value: dir, children: dir }, `${dir}-${idx}`)))] })] }))] })] }), _jsxs("div", { className: "sectionCard", children: [_jsx("div", { className: "sectionTitle", children: "Validation & Warnings" }), _jsxs("div", { className: "sectionBody", children: [asChildren(exportErrors.map((msg, idx) => (_jsxs("div", { className: "warningCard warningRed", children: [_jsx("span", { style: { fontWeight: 700, fontSize: 11 }, children: "ERROR" }), msg] }, `${msg}-${idx}`)))), asChildren(exportWarnings.map((w, idx) => (_jsxs("div", { className: `warningCard ${w.level === "orange" ? "warningOrange" : "warningYellow"}`, children: [_jsx("span", { style: { fontWeight: 700, fontSize: 11 }, children: w.level === "orange" ? "CAUTION" : "WARN" }), w.text] }, `${w.text}-${idx}`)))), exportErrors.length === 0 && exportWarnings.length === 0 && (_jsx("div", { style: { fontSize: 12, color: "#666" }, children: "\u554F\u984C\u306F\u691C\u51FA\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002" }))] })] }), _jsxs("div", { className: "sectionCard muted", style: { pointerEvents: "none" }, children: [_jsx("div", { className: "sectionTitle", children: "Export summary" }), _jsxs("div", { className: "sectionBody", style: { fontSize: 12, color: "var(--muted)" }, children: [_jsxs("div", { children: ["Train: ", splitSummary.train, " images"] }), _jsxs("div", { children: ["Val: ", splitSummary.val, " images"] }), _jsxs("div", { children: ["Test: ", splitSummary.test, " images"] }), _jsxs("div", { style: { marginTop: 6 }, children: ["Output: ", exportOutputDir || "-"] }), _jsxs("div", { children: ["Folder: ", exportFolderName] })] })] })] }), _jsxs("div", { className: "drawerFooter", children: [(exportErrors.length > 0 || exportWarnings.length > 0) && (_jsxs("div", { className: `warningCard ${exportErrors.length > 0
                                            ? "warningRed"
                                            : exportWarnings[0]?.level === "orange"
                                                ? "warningOrange"
                                                : "warningYellow"}`, style: { lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [_jsx("span", { style: { fontWeight: 700, fontSize: 11 }, children: exportErrors.length > 0
                                                    ? "ERROR"
                                                    : exportWarnings[0]?.level === "orange"
                                                        ? "CAUTION"
                                                        : "WARN" }), _jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis" }, children: exportErrors.length > 0
                                                    ? exportErrors[0]
                                                    : exportWarnings[0]?.text || "警告があります" })] })), _jsxs("div", { className: "drawerMetaLine", children: ["Output: ", exportOutputDir || "-", "  |  Folder: ", exportFolderName] }), _jsx("button", { type: "button", onClick: datasetType === "seg" ? handleExportDatasetSeg : handleExportDatasetBBox, disabled: !canExport || busy, className: "btn btnPrimary", style: {
                                            width: "100%",
                                            height: 40,
                                            fontWeight: 700,
                                        }, children: busy ? "Exporting..." : "Export dataset" }), exportResult && (_jsx("div", { style: {
                                            fontSize: 12,
                                            color: exportResult.ok ? "#2e7d32" : "#b00020",
                                            wordBreak: "break-all",
                                        }, children: exportResult.ok ? `✅ ${exportResult.message}` : `❌ ${exportResult.message}` }))] })] })] })), showHints && (_jsxs("div", { style: {
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
                }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 8 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: "\u64CD\u4F5C\u30D2\u30F3\u30C8" }), _jsx("button", { type: "button", onClick: dismissHints, style: {
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    color: "#666",
                                    padding: 0,
                                }, "aria-label": "Close hints", children: "\u00D7" })] }), _jsxs("div", { style: { marginTop: 6, lineHeight: 1.5 }, children: [_jsx("div", { children: "Ctrl+Wheel: Zoom" }), _jsx("div", { children: "Space+Drag: Pan" }), _jsx("div", { children: "Shift+Drag: Manual BBox" }), _jsx("div", { children: "Enter: Confirm / Del: Reject" }), _jsx("div", { children: "N: Next / S: Seg" })] })] })), datasetId ? (_jsxs("div", { style: {
                    display: "grid",
                    gridTemplateColumns: "260px 1fr 400px",
                    gap: 16,
                    padding: 16,
                    flex: 1,
                    minHeight: 0,
                }, children: [_jsxs("div", { className: "panelShell", style: {
                            padding: 12,
                            minHeight: 0,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [_jsxs("div", { style: { fontWeight: 600 }, children: ["Dataset", datasetInfo?.project_name ? `: ${datasetInfo.project_name}` : ""] }), _jsxs("select", { value: leftFilter, onChange: (e) => setLeftFilter(e.target.value), style: {
                                            height: 26,
                                            fontSize: 11,
                                            borderRadius: 8,
                                            border: "1px solid var(--border)",
                                            padding: "0 8px",
                                            background: "var(--panel)",
                                            color: leftFilter === "annotated"
                                                ? "#2e7d32"
                                                : leftFilter === "unannotated"
                                                    ? "#c62828"
                                                    : "inherit",
                                        }, children: [_jsx("option", { value: "all", children: "\u5168\u8868\u793A" }), _jsx("option", { value: "annotated", style: { color: "#2e7d32" }, children: "\u30A2\u30CE\u30C6\u6E08" }), _jsx("option", { value: "unannotated", style: { color: "#c62828" }, children: "\u672A\u30A2\u30CE\u30C6" })] })] }), !datasetInfo && (_jsx("div", { style: { fontSize: 12, color: "#666" }, children: "\u89AA\u30D5\u30A9\u30EB\u30C0\u3092\u8AAD\u307F\u8FBC\u3080\u3068\u30B5\u30E0\u30CD\u4E00\u89A7\u304C\u8868\u793A\u3055\u308C\u307E\u3059\u3002" })), datasetInfo && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [datasetSelectedName &&
                                        !filteredImages.some((entry) => (entry.original_filename || entry.filename || "") === datasetSelectedName) && (_jsx("div", { style: { fontSize: 11, color: "#a56900", marginBottom: 4 }, children: "\u73FE\u5728\u9078\u629E\u4E2D\u306E\u753B\u50CF\u306F\u30D5\u30A3\u30EB\u30BF\u6761\u4EF6\u306B\u3088\u308A\u4E00\u89A7\u306B\u975E\u8868\u793A\u3067\u3059\u3002" })), asChildren(filteredImages.map((entry, idx) => {
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
                                        const sizeLabel = width !== null && height !== null ? `${width}×${height}` : "-";
                                        return (_jsxs("div", { onClick: () => handleSelectDatasetImage(name), style: {
                                                display: "grid",
                                                gridTemplateColumns: "54px 1fr",
                                                gap: 6,
                                                padding: 4,
                                                borderRadius: 8,
                                                border: isActive ? "1px solid #1a73e8" : "1px solid #e3e3e3",
                                                background: isActive ? "#eef6ff" : "#fff",
                                                cursor: "pointer",
                                                alignItems: "center",
                                            }, children: [_jsx("div", { style: {
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
                                                    }, children: _jsx("img", { src: `${API_BASE}/dataset/${datasetId}/image/${encodeURIComponent(name)}`, alt: name, style: { width: "100%", height: "100%", objectFit: "cover" } }) }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 600 }, children: ["ID: ", indexLabel, " ", _jsx("span", { style: {
                                                                        fontSize: 10,
                                                                        marginLeft: 6,
                                                                        padding: "2px 6px",
                                                                        borderRadius: 10,
                                                                        background: isDone ? "#e8f5e9" : "#fdeaea",
                                                                        color: isDone ? "#2e7d32" : "#c62828",
                                                                    }, children: isDone ? `済 ${count}` : "未" })] }), _jsxs("div", { style: { fontSize: 10, color: "#666" }, children: ["File: ", name] }), _jsxs("div", { style: { fontSize: 10, color: "#888" }, children: ["Size: ", sizeLabel] })] })] }, `${name || entry.internal_id || "image"}-${idx}`));
                                    }))] }))] }), _jsxs("div", { style: {
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            position: "relative",
                            opacity: showExportDrawer ? 0.45 : 1,
                            filter: showExportDrawer ? "grayscale(0.6)" : "none",
                            transition: "opacity 160ms ease, filter 160ms ease",
                        }, onPointerDown: () => setIsCanvasInteracting(true), onPointerUp: () => setIsCanvasInteracting(false), onPointerLeave: () => setIsCanvasInteracting(false), onWheel: () => {
                            setIsCanvasInteracting(true);
                            if (interactionTimeoutRef.current) {
                                window.clearTimeout(interactionTimeoutRef.current);
                            }
                            interactionTimeoutRef.current = window.setTimeout(() => {
                                setIsCanvasInteracting(false);
                            }, 140);
                        }, children: [error && (_jsxs("div", { style: { marginBottom: 12, color: "#b00020" }, children: ["Error: ", error] })), _jsx("div", { style: { position: "sticky", top: 0 }, children: _jsxs("div", { style: { position: "relative" }, children: [_jsx(ImageCanvas, { ref: canvasRef, imageUrl: imageUrl, candidates: candidates, selectedCandidateId: selectedCandidateId, annotations: filteredAnnotations, selectedAnnotationId: selectedAnnotationId, colorMap: colorMap, showCandidates: showCandidates, showAnnotations: showAnnotations, editablePolygon: segEditMode ? selectedAnnotation?.segPolygon || null : null, editMode: segEditMode, showVertices: showSegVertices, selectedVertexIndex: selectedVertexIndex, highlightAnnotationId: highlightAnnotationId, onSelectVertex: setSelectedVertexIndex, onUpdateEditablePolygon: (next) => {
                                                if (!selectedAnnotation)
                                                    return;
                                                setAnnotations((prev) => prev.map((a) => a.id === selectedAnnotation.id ? { ...a, segPolygon: next } : a));
                                            }, onVertexDragStart: () => {
                                                if (!selectedAnnotation?.segPolygon)
                                                    return;
                                                setSegUndoStack((prev) => [
                                                    ...prev,
                                                    selectedAnnotation.segPolygon.map((p) => ({
                                                        ...p,
                                                    })),
                                                ]);
                                            }, onClickPoint: handleClickPoint, onCreateManualBBox: (bbox) => {
                                                setPendingManualBBox(bbox);
                                                setPendingManualClass("");
                                                setSelectedCandidateId(null);
                                                setSelectedAnnotationId(null);
                                            }, onManualCreateStateChange: setIsCreatingManualBBox, onResizeSelectedBBox: (bbox) => {
                                                if (!selectedCandidateId)
                                                    return;
                                                setCandidates((prev) => prev.map((c) => (c.id === selectedCandidateId ? { ...c, bbox } : c)));
                                            }, onResizeSelectedAnnotation: (bbox) => {
                                                if (!selectedAnnotationId)
                                                    return;
                                                setAnnotations((prev) => prev.map((a) => a.id === selectedAnnotationId
                                                    ? {
                                                        ...a,
                                                        bbox: clampBBoxToImage(bbox),
                                                        source: a.source === "template" ? "manual" : a.source,
                                                    }
                                                    : a));
                                            }, onAnnotationEditStart: () => {
                                                if (annotationEditActiveRef.current)
                                                    return;
                                                annotationEditActiveRef.current = true;
                                                if (selectedAnnotationId) {
                                                    editSessionRef.current = {
                                                        activeId: selectedAnnotationId,
                                                        before: cloneAnnotations(annotations),
                                                    };
                                                }
                                            }, onAnnotationEditEnd: () => {
                                                annotationEditActiveRef.current = false;
                                                const session = editSessionRef.current;
                                                editSessionRef.current = null;
                                                if (!session?.activeId)
                                                    return;
                                                const beforeAnn = session.before.find((a) => a.id === session.activeId);
                                                const afterAnn = annotations.find((a) => a.id === session.activeId);
                                                if (!beforeAnn || !afterAnn)
                                                    return;
                                                if (sameAnnotationShape(beforeAnn, afterAnn))
                                                    return;
                                                setAnnotationUndoStack((prev) => [...prev, session.before]);
                                                setAnnotationRedoStack([]);
                                                setAnnotations((prev) => prev.map((a) => a.id === session.activeId ? { ...a, source: "manual" } : a));
                                            }, onSelectAnnotation: handleSelectAnnotation, onClearSelectedAnnotation: () => setSelectedAnnotationId(null), pendingManualBBox: pendingManualBBox, shouldIgnoreCanvasClick: () => isCreatingManualBBox || !!pendingManualBBox, onDebugCoords: showDebug ? setCoordDebug : undefined, debugOverlay: showDebug ? detectDebug || null : null }), selectedAnnotationId && (_jsxs("div", { style: {
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
                                            }, children: ["\u7DE8\u96C6\u4E2D\uFF08\u30C9\u30E9\u30C3\u30B0\u3067\u8ABF\u6574\uFF09", _jsx("div", { style: { marginTop: 4, fontSize: 10, opacity: 0.85 }, children: "\u5185\u5074: \u79FB\u52D5 / \u8FBA: \u30EA\u30B5\u30A4\u30BA" }), _jsx("div", { style: { marginTop: 2, fontSize: 10, opacity: 0.85 }, children: "\u7DE8\u96C6\u5B8C\u4E86\u306FEsc" })] }))] }) }), notice && (_jsx("div", { style: {
                                    marginTop: 12,
                                    color: "#1b5e20",
                                    fontSize: 12,
                                    opacity: noticeVisible ? 1 : 0,
                                    transition: "opacity 400ms ease",
                                }, children: notice })), busy && _jsx("div", { style: { marginTop: 10, color: "#666" }, children: "\u51E6\u7406\u4E2D..." })] }), _jsxs("div", { className: "rightPanel panelShell", style: {
                            padding: 16,
                            minHeight: 0,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            opacity: isCanvasInteracting ? 0.6 : 1,
                            transition: "opacity 160ms ease",
                            position: "relative",
                        }, children: [autoRunning && (_jsxs("div", { style: {
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
                                }, children: ["\u5168\u81EA\u52D5\u30A2\u30CE\u30C6\u30FC\u30B7\u30E7\u30F3 ", autoMethod === "combined" ? "Fusion Mode" : "Template Mode", " \u5B9F\u884C\u4E2D\u2026", " ", autoProgress, "%"] })), pendingManualBBox && (_jsxs("div", { style: {
                                    marginBottom: 18,
                                    paddingBottom: 12,
                                    borderBottom: "1px solid #eee",
                                    flex: "0 0 auto",
                                }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: 8 }, children: "\u624B\u52D5BBox: \u30AF\u30E9\u30B9\u6307\u5B9A" }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { style: { fontSize: 12, minWidth: 60 }, children: "\u30AF\u30E9\u30B9\u9078\u629E" }), _jsxs("select", { value: pendingManualClass, onChange: (e) => {
                                                    const nextClass = e.target.value;
                                                    setPendingManualClass(nextClass);
                                                    if (!nextClass || !pendingManualBBox)
                                                        return;
                                                    pushAnnotationHistory();
                                                    const createdAt = new Date().toISOString();
                                                    const nextAnnotation = {
                                                        id: `${Date.now()}-${Math.random()}`,
                                                        class_name: nextClass,
                                                        bbox: clampBBoxToImage(pendingManualBBox),
                                                        source: "manual",
                                                        created_at: createdAt,
                                                    };
                                                    setAnnotations((prev) => [...prev, nextAnnotation]);
                                                    if (nextClass) {
                                                        setColorMap((prev) => {
                                                            if (prev[nextClass])
                                                                return prev;
                                                            return { ...prev, [nextClass]: pickUniqueColor(prev) };
                                                        });
                                                    }
                                                    setPendingManualBBox(null);
                                                    setPendingManualClass("");
                                                }, style: { minWidth: 200, height: 36 }, children: [_jsx("option", { value: "", children: "\u30AF\u30E9\u30B9\u3092\u9078\u629E" }, "class-none"), asChildren(classOptions.map((name, idx) => (_jsx("option", { value: name, children: name }, `${name}-${idx}`))))] }), _jsx("button", { type: "button", onClick: () => {
                                                    setPendingManualBBox(null);
                                                    setPendingManualClass("");
                                                }, style: {
                                                    height: 30,
                                                    padding: "0 10px",
                                                    borderRadius: 6,
                                                    border: "1px solid #e3e3e3",
                                                    background: "#fff",
                                                    fontSize: 12,
                                                    cursor: "pointer",
                                                }, children: "\u30AD\u30E3\u30F3\u30BB\u30EB" })] }), !pendingManualClass && (_jsx("div", { style: { marginTop: 6, fontSize: 12, color: "#b00020" }, children: "\u624B\u52D5BBox\u306F\u30AF\u30E9\u30B9\u6307\u5B9A\u304C\u5FC5\u8981\u3067\u3059" }))] })), _jsx("div", { className: "sectionCard", children: _jsxs("div", { style: {
                                        display: "flex",
                                        gap: 8,
                                    }, children: [_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, flex: 1 }, children: _jsx("button", { type: "button", onClick: handleConfirmCandidate, disabled: !selectedCandidate || manualClassMissing, onMouseEnter: () => setHoverAction("confirm"), onMouseLeave: () => setHoverAction(null), onMouseDown: () => setActiveAction("confirm"), onMouseUp: () => setActiveAction(null), className: "btn btnPrimary", style: {
                                                    width: "100%",
                                                    height: 36,
                                                    fontWeight: 700,
                                                    opacity: !selectedCandidate || manualClassMissing ? 0.45 : 1,
                                                    transform: activeAction === "confirm" ? "translateY(1px)" : "none",
                                                }, children: _jsxs("span", { style: { display: "flex", flexDirection: "column", lineHeight: 1.1 }, children: [_jsx("span", { children: "\u78BA\u5B9A" }), _jsx("span", { style: { fontSize: 10, fontWeight: 600 }, children: "(Enter)" })] }) }) }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, flex: 1 }, children: _jsx("button", { type: "button", onClick: handleNextCandidate, disabled: candidates.length === 0, onMouseEnter: () => setHoverAction("next"), onMouseLeave: () => setHoverAction(null), onMouseDown: () => setActiveAction("next"), onMouseUp: () => setActiveAction(null), className: "btn btnSecondary", style: {
                                                    width: "100%",
                                                    height: 36,
                                                    fontWeight: 700,
                                                    opacity: candidates.length === 0 ? 0.45 : 1,
                                                    transform: activeAction === "next" ? "translateY(1px)" : "none",
                                                }, children: _jsxs("span", { style: { display: "flex", flexDirection: "column", lineHeight: 1.1 }, children: [_jsx("span", { children: "\u6B21" }), _jsx("span", { style: { fontSize: 10, fontWeight: 600 }, children: "(N)" })] }) }) }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, flex: 1 }, children: _jsx("button", { type: "button", onClick: handleRejectCandidate, disabled: !selectedCandidate, onMouseEnter: () => setHoverAction("discard"), onMouseLeave: () => setHoverAction(null), onMouseDown: () => setActiveAction("discard"), onMouseUp: () => setActiveAction(null), className: "btn btnDanger", style: {
                                                    width: "100%",
                                                    height: 36,
                                                    fontWeight: 700,
                                                    opacity: !selectedCandidate ? 0.45 : 1,
                                                    transform: activeAction === "discard" ? "translateY(1px)" : "none",
                                                }, children: _jsxs("span", { style: { display: "flex", flexDirection: "column", lineHeight: 1.1 }, children: [_jsx("span", { children: "\u7834\u68C4" }), _jsx("span", { style: { fontSize: 10, fontWeight: 600 }, children: "(Del)" })] }) }) }), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, flex: 1 }, children: _jsx("button", { type: "button", onClick: handleSegCandidate, disabled: !selectedCandidate, onMouseEnter: () => setHoverAction("sam"), onMouseLeave: () => setHoverAction(null), onMouseDown: () => setActiveAction("sam"), onMouseUp: () => setActiveAction(null), className: "btn btnSpecial", style: {
                                                    width: "100%",
                                                    height: 36,
                                                    fontWeight: 700,
                                                    opacity: !selectedCandidate ? 0.45 : 1,
                                                    transform: activeAction === "sam" ? "translateY(1px)" : "none",
                                                }, children: _jsxs("span", { style: { display: "flex", flexDirection: "column", lineHeight: 1.1 }, children: [_jsx("span", { children: "SAM" }), _jsx("span", { style: { fontSize: 10, fontWeight: 600 }, children: "(S)" })] }) }) })] }) }), _jsxs("div", { className: "sectionCard", children: [_jsxs("button", { type: "button", onClick: () => setShowCommonSettings((prev) => !prev), style: {
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
                                            justifyContent: "flex-start",
                                            gap: 6,
                                            padding: 0,
                                        }, children: [_jsx("span", { style: { fontSize: 12, color: "#546e7a" }, children: showCommonSettings ? "▼" : "▶" }), _jsx("span", { children: "\u691C\u51FA \u5171\u901A\u8A2D\u5B9A" })] }), showCommonSettings && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "sectionBody", style: { display: "grid", gap: 6, marginBottom: 10 }, children: [_jsxs("div", { role: "button", "aria-pressed": showCandidates, onClick: () => setShowCandidates((prev) => !prev), style: {
                                                            display: "grid",
                                                            gridTemplateColumns: "1fr auto auto",
                                                            alignItems: "center",
                                                            gap: 10,
                                                            height: 28,
                                                            cursor: "pointer",
                                                        }, children: [_jsx("span", { style: { fontSize: 12, color: "#455a64" }, children: "\u672A\u78BA\u5B9A\u5019\u88DC\u3092\u8868\u793A" }), _jsx("span", { style: {
                                                                    width: 34,
                                                                    height: 18,
                                                                    borderRadius: 999,
                                                                    background: showCandidates ? "#1a73e8" : "#cfd8dc",
                                                                    position: "relative",
                                                                    transition: "background 120ms ease",
                                                                    display: "inline-block",
                                                                }, children: _jsx("span", { style: {
                                                                        width: 14,
                                                                        height: 14,
                                                                        borderRadius: "50%",
                                                                        background: "#fff",
                                                                        position: "absolute",
                                                                        top: 2,
                                                                        left: showCandidates ? 18 : 2,
                                                                        transition: "left 120ms ease",
                                                                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                                                    } }) }), _jsx("span", { style: {
                                                                    width: 28,
                                                                    textAlign: "right",
                                                                    fontSize: 11,
                                                                    color: showCandidates ? "#455a64" : "#90a4ae",
                                                                    fontWeight: 600,
                                                                }, children: showCandidates ? "ON" : "OFF" })] }), _jsxs("div", { role: "button", "aria-pressed": showAnnotations, onClick: () => setShowAnnotations((prev) => !prev), style: {
                                                            display: "grid",
                                                            gridTemplateColumns: "1fr auto auto",
                                                            alignItems: "center",
                                                            gap: 10,
                                                            height: 28,
                                                            cursor: "pointer",
                                                        }, children: [_jsx("span", { style: { fontSize: 12, color: "#455a64" }, children: "\u78BA\u5B9A\u30A2\u30CE\u30C6\u30FC\u30B7\u30E7\u30F3\u3092\u8868\u793A" }), _jsx("span", { style: {
                                                                    width: 34,
                                                                    height: 18,
                                                                    borderRadius: 999,
                                                                    background: showAnnotations ? "#2e7d32" : "#cfd8dc",
                                                                    position: "relative",
                                                                    transition: "background 120ms ease",
                                                                    display: "inline-block",
                                                                }, children: _jsx("span", { style: {
                                                                        width: 14,
                                                                        height: 14,
                                                                        borderRadius: "50%",
                                                                        background: "#fff",
                                                                        position: "absolute",
                                                                        top: 2,
                                                                        left: showAnnotations ? 18 : 2,
                                                                        transition: "left 120ms ease",
                                                                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                                                    } }) }), _jsx("span", { style: {
                                                                    width: 28,
                                                                    textAlign: "right",
                                                                    fontSize: 11,
                                                                    color: showAnnotations ? "#455a64" : "#90a4ae",
                                                                    fontWeight: 600,
                                                                }, children: showAnnotations ? "ON" : "OFF" })] })] }), _jsx("div", { style: {
                                                    marginBottom: 10,
                                                    paddingBottom: 10,
                                                    borderBottom: "1px dashed #e0e0e0",
                                                }, children: _jsxs("div", { className: "formRow", children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600 }, children: "ROI\u30B5\u30A4\u30BA" }), _jsxs("div", { className: "controlWrap", children: [_jsx(NumericInputWithButtons, { value: roiSize, onChange: (v) => typeof v === "number" && setRoiSize(v), min: 10, step: 10, height: 32, inputWidth: 84, ariaLabel: "roi size", className: "controlWrap", inputClassName: "numInput", buttonClassName: "stepBtn" }), _jsx("span", { style: { fontSize: 11, color: "#666" }, children: "\u624B\u52D5/\u81EA\u52D5\u3067\u5171\u901A" })] })] }) }), Object.keys(colorMap).length > 0 && (_jsxs("div", { style: { marginBottom: 4 }, children: [_jsx("button", { type: "button", onClick: () => setShowClassColors((prev) => !prev), className: "btn btnGhost", style: { width: "auto", height: 32, marginBottom: 8 }, children: showClassColors ? "▼ クラス別カラー" : "▶︎ クラス別カラー" }), showClassColors && (_jsx("div", { style: {
                                                            display: "flex",
                                                            flexWrap: "wrap",
                                                            gap: 8,
                                                            maxHeight: 84,
                                                            overflowY: "auto",
                                                            padding: "4px 2px",
                                                            borderRadius: 6,
                                                            border: "1px solid #eceff1",
                                                            background: "#fcfcfc",
                                                        }, children: asChildren(Object.entries(colorMap).map(([name, color], idx) => {
                                                            const hexColor = normalizeToHex(color);
                                                            return (_jsxs("label", { style: {
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    padding: "4px 6px",
                                                                    border: "1px solid #e3e3e3",
                                                                    borderRadius: 999,
                                                                    background: "#fff",
                                                                    fontSize: 11,
                                                                }, children: [_jsx("input", { type: "color", value: hexColor, onChange: (e) => setColorMap((prev) => ({ ...prev, [name]: e.target.value })), style: { width: 20, height: 20, padding: 0, border: "none" } }), _jsx("span", { children: name })] }, `${name}-${idx}`));
                                                        })) }))] })), _jsx("div", { style: { marginTop: 8 }, children: _jsx("button", { type: "button", onClick: () => setShowAdvanced((prev) => !prev), className: "btn btnGhost", style: {
                                                        width: "100%",
                                                        height: 32,
                                                        background: showAdvanced ? "var(--panel2)" : "transparent",
                                                        borderColor: showAdvanced ? "var(--primary)" : "var(--border)",
                                                        color: showAdvanced ? "var(--primary)" : "inherit",
                                                    }, children: showAdvanced ? "▼ Advanced settings" : "▶︎ Advanced settings" }) }), showAdvanced && (_jsxs("div", { style: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e3e3e3" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "\u691C\u51FA\u30D1\u30E9\u30E1\u30FC\u30BF" }), advancedDirty && advancedBaseline && (_jsx("button", { type: "button", className: "btn btnGhost", style: { height: 24, padding: "0 8px", fontSize: 10 }, onClick: () => {
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
                                                                }, children: "Reset" }))] }), _jsxs("div", { className: "formRow", style: { marginBottom: 6, alignItems: "start" }, children: [_jsx("span", { style: { fontSize: 12, paddingTop: 4 }, children: "\u30B9\u30B1\u30FC\u30EB" }), _jsxs("div", { className: "controlStack", children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }, title: "\u00B10.1", children: [_jsx(NumericInputWithButtons, { value: scaleMin, onChange: (v) => typeof v === "number" && setScaleMin(v), min: 0.1, step: 0.1, height: 32, inputWidth: 84, ariaLabel: "scale min", placeholder: "\u63A8\u5968 0.4\u20130.8", className: "controlWrap", inputClassName: `numInput ${scaleMinDanger ? "dangerInput" : scaleMinWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { className: "miniLabel", style: { textAlign: "center" }, children: "min" })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }, title: "\u00B10.1", children: [_jsx(NumericInputWithButtons, { value: scaleMax, onChange: (v) => typeof v === "number" && setScaleMax(v), min: 0.1, step: 0.1, height: 32, inputWidth: 84, ariaLabel: "scale max", placeholder: "\u63A8\u5968 1.2\u20132.0", className: "controlWrap", inputClassName: `numInput ${scaleMaxDanger ? "dangerInput" : scaleMaxWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { className: "miniLabel", style: { textAlign: "center" }, children: "max" })] }), _jsxs("div", { className: "hintText", children: [_jsx("span", { className: "badge", children: "\u63A8\u5968 min 0.4\u20130.8 / max 1.2\u20132.0" }), _jsx("span", { className: "badge badgeWarn", children: "\u5371\u967A min<0.2, max>3.0" }), (scaleMinWarn || scaleMaxWarn) && !scaleMinDanger && !scaleMaxDanger && (_jsx("span", { className: "badge badgeDanger", children: "\u6CE8\u610F" })), (scaleMinDanger || scaleMaxDanger) && (_jsx("span", { className: "badge badgeDanger", children: "Danger" }))] })] })] }), _jsxs("div", { className: "formRow", style: { marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 12 }, children: "\u5206\u5272" }), _jsxs("div", { className: "controlWrap", title: "\u00B11", children: [_jsx(NumericInputWithButtons, { value: scaleSteps, onChange: (v) => typeof v === "number" && setScaleSteps(v), min: 1, step: 1, height: 32, inputWidth: 84, ariaLabel: "scale steps", placeholder: "\u63A8\u5968 6\u201312", className: "controlWrap", inputClassName: `numInput ${scaleStepsDanger ? "dangerInput" : scaleStepsWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { className: "badge", children: "\u63A8\u5968 6\u201312" }), _jsx("span", { className: "badge badgeWarn", children: "\u5371\u967A >20" }), scaleStepsWarn && !scaleStepsDanger && _jsx("span", { className: "badge badgeDanger", children: "\u6CE8\u610F" }), scaleStepsDanger && _jsx("span", { className: "badge badgeDanger", children: "Danger" })] })] }), _jsxs("div", { className: "formRow", style: { marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 12 }, children: "\u4E0A\u4F4D\u4EF6\u6570" }), _jsx("div", { className: "controlWrap", title: "\u00B11", children: _jsx(NumericInputWithButtons, { value: topk, onChange: (v) => typeof v === "number" && setTopk(v), min: 1, max: 3, step: 1, height: 32, inputWidth: 84, ariaLabel: "topk", placeholder: "\u63A8\u5968 1\u20135", className: "controlWrap", inputClassName: `numInput ${topkDanger ? "dangerInput" : topkWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }) })] }), _jsx("div", { style: { height: 1, background: "#eee", margin: "4px 0 8px" } }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [_jsx("input", { type: "checkbox", checked: excludeEnabled, onChange: (e) => setExcludeEnabled(e.target.checked) }), _jsx("span", { style: { fontSize: 12 }, children: "\u78BA\u5B9ABBox\u3092\u9664\u5916" })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [_jsx("input", { type: "checkbox", checked: excludeCenter, disabled: !excludeEnabled, onChange: (e) => setExcludeCenter(e.target.checked) }), _jsx("span", { style: { fontSize: 12 }, children: "\u4E2D\u5FC3\u70B9\u3067\u9664\u5916" })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 12, minWidth: 64 }, children: "\u9664\u5916\u30E2\u30FC\u30C9" }), _jsxs("select", { value: excludeMode, disabled: !excludeEnabled, onChange: (e) => setExcludeMode(e.target.value), style: { height: 28 }, children: [_jsx("option", { value: "same_class", children: "same_class" }), _jsx("option", { value: "any_class", children: "any_class" })] })] }), _jsxs("div", { className: "formRow", style: { marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 12 }, children: "IoU" }), _jsxs("div", { className: "controlWrap", title: "\u00B10.05", children: [_jsx(NumericInputWithButtons, { value: excludeIouThreshold, onChange: (v) => typeof v === "number" && setExcludeIouThreshold(v), min: 0.4, max: 0.8, step: 0.05, height: 32, inputWidth: 84, disabled: !excludeEnabled, ariaLabel: "exclude iou", placeholder: "\u63A8\u5968 0.4\u20130.8", className: "controlWrap", inputClassName: "numInput", buttonClassName: "stepBtn" }), _jsx("span", { className: "badge", children: "\u63A8\u5968 0.4\u20130.8" })] })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: refineContour, onChange: (e) => setRefineContour(e.target.checked) }), _jsx("span", { style: { fontSize: 12 }, children: "\u8F2A\u90ED\u3067BBox\u88DC\u6B63" })] })] })), _jsxs("div", { style: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed #e3e3e3" }, children: [_jsx("button", { type: "button", onClick: () => setShowDebug((prev) => !prev), className: `btn btnDebug ${showDebug ? "isOpen" : ""}`, style: {
                                                            width: "auto",
                                                            height: 32,
                                                        }, children: showDebug ? "▼ Debug" : "▶︎ Debug" }), showDebug && (detectDebug || coordDebug) && (_jsxs("div", { style: {
                                                            marginTop: 10,
                                                            background: "#fff7ed",
                                                            border: "1px solid #fdba74",
                                                            borderRadius: 8,
                                                            padding: 10,
                                                        }, children: [detectDebug && (_jsx("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 6 }, children: "Debug" })), detectDebug?.clicked_image_xy && (_jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["click: ", detectDebug.clicked_image_xy.x.toFixed(2), " ,", " ", detectDebug.clicked_image_xy.y.toFixed(2)] })), detectDebug?.roi_bbox && (_jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["roi: (", detectDebug.roi_bbox.x1, ", ", detectDebug.roi_bbox.y1, ") \u2192 (", detectDebug.roi_bbox.x2, ", ", detectDebug.roi_bbox.y2, ")"] })), detectDebug?.outer_bbox && (_jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["outer: ", detectDebug.outer_bbox.x, ", ", detectDebug.outer_bbox.y, ",", " ", detectDebug.outer_bbox.w, "\u00D7", detectDebug.outer_bbox.h] })), detectDebug?.tight_bbox && (_jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 6 }, children: ["tight: ", detectDebug.tight_bbox.x, ", ", detectDebug.tight_bbox.y, ",", " ", detectDebug.tight_bbox.w, "\u00D7", detectDebug.tight_bbox.h] })), detectDebug?.roi_click_xy && (_jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 6 }, children: ["roi click: ", detectDebug.roi_click_xy.x.toFixed(2), ", ", detectDebug.roi_click_xy.y.toFixed(2)] })), detectDebug?.match_score !== undefined && detectDebug?.match_offset_in_roi && (_jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 6 }, children: ["match score: ", detectDebug.match_score.toFixed(4), " / offset:", " ", detectDebug.match_offset_in_roi.x.toFixed(1), ", ", detectDebug.match_offset_in_roi.y.toFixed(1)] })), detectDebug?.match_mode && (_jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 6 }, children: ["match mode: ", detectDebug.match_mode] })), coordDebug && (_jsxs("div", { style: { marginTop: detectDebug ? 10 : 0 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 6 }, children: "Coords" }), _jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["screen: ", coordDebug.screen.x.toFixed(2), ", ", coordDebug.screen.y.toFixed(2)] }), _jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["image: ", coordDebug.image.x.toFixed(2), ", ", coordDebug.image.y.toFixed(2)] }), _jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["zoom: ", coordDebug.zoom.toFixed(3)] }), _jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["pan: ", coordDebug.pan.x.toFixed(2), ", ", coordDebug.pan.y.toFixed(2)] }), _jsxs("div", { style: { fontSize: 11, color: "#666", marginBottom: 4 }, children: ["dpr: ", coordDebug.dpr.toFixed(2)] }), coordDebug.cssScale && (_jsxs("div", { style: { fontSize: 11, color: "#666" }, children: ["cssScale: ", coordDebug.cssScale.sx.toFixed(3), ", ", coordDebug.cssScale.sy.toFixed(3)] }))] })), _jsxs("div", { style: { marginTop: 10, display: "grid", gap: 6 }, children: [(detectDebug?.roi_preview_marked_base64 || detectDebug?.roi_preview_base64) && (_jsx("img", { src: `data:image/png;base64,${detectDebug?.roi_preview_marked_base64 ||
                                                                            detectDebug?.roi_preview_base64 ||
                                                                            ""}`, alt: "roi preview", style: { width: "100%", border: "1px solid #e3e3e3", borderRadius: 4 } })), _jsxs("div", { style: {
                                                                            display: "grid",
                                                                            gridTemplateColumns: "1fr 1fr",
                                                                            gap: 6,
                                                                            alignItems: "stretch",
                                                                        }, children: [detectDebug?.roi_edge_preview_base64 && (_jsx("div", { style: {
                                                                                    width: "100%",
                                                                                    aspectRatio: "1 / 1",
                                                                                    border: "1px solid #e3e3e3",
                                                                                    borderRadius: 4,
                                                                                    overflow: "hidden",
                                                                                }, children: _jsx("img", { src: `data:image/png;base64,${detectDebug.roi_edge_preview_base64}`, alt: "roi edges", style: {
                                                                                        width: "100%",
                                                                                        height: "100%",
                                                                                        objectFit: "contain",
                                                                                        display: "block",
                                                                                    } }) })), templatePreviewBase64 && (_jsxs("div", { style: {
                                                                                    width: "100%",
                                                                                    aspectRatio: "1 / 1",
                                                                                    border: "1px solid #e3e3e3",
                                                                                    borderRadius: 4,
                                                                                    overflow: "hidden",
                                                                                    position: "relative",
                                                                                }, children: [_jsx("img", { src: `data:image/png;base64,${templatePreviewBase64 || ""}`, alt: "template edges", style: {
                                                                                            width: "100%",
                                                                                            height: "100%",
                                                                                            objectFit: "contain",
                                                                                            display: "block",
                                                                                        } }), selectedCandidate?.class_name && (_jsx("div", { style: {
                                                                                            position: "absolute",
                                                                                            top: 4,
                                                                                            left: 4,
                                                                                            padding: "2px 6px",
                                                                                            borderRadius: 6,
                                                                                            background: "rgba(0,0,0,0.65)",
                                                                                            color: "#fff",
                                                                                            fontSize: 10,
                                                                                        }, children: selectedCandidate.class_name })), typeof selectedCandidate?.score === "number" && (_jsx("div", { style: {
                                                                                            position: "absolute",
                                                                                            top: 4,
                                                                                            right: 4,
                                                                                            padding: "2px 6px",
                                                                                            borderRadius: 6,
                                                                                            background: "rgba(0,0,0,0.65)",
                                                                                            color: "#fff",
                                                                                            fontSize: 10,
                                                                                            fontVariantNumeric: "tabular-nums",
                                                                                        }, children: selectedCandidate.score.toFixed(3) }))] })), !templatePreviewBase64 && (_jsx("div", { style: {
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
                                                                                }, children: "\u30C6\u30F3\u30D7\u30EC\u672A\u53D6\u5F97" }))] })] })] }))] })] }))] }), _jsxs("div", { className: "sectionCard muted", style: { marginTop: 12 }, children: [_jsxs("button", { type: "button", onClick: () => setAutoPanelOpen((prev) => !prev), style: {
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
                                            justifyContent: "flex-start",
                                            gap: 6,
                                            padding: 0,
                                        }, children: [_jsx("span", { style: { fontSize: 12, color: "#546e7a" }, children: autoPanelOpen ? "▼" : "▶" }), _jsx("span", { children: "\u5168\u81EA\u52D5\u30A2\u30CE\u30C6\u30FC\u30B7\u30E7\u30F3" })] }), autoPanelOpen && (_jsxs("div", { style: { marginTop: 10, display: "grid", gap: 10 }, children: [_jsxs("div", { className: "formRow", children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "\u5168\u81EA\u52D5 \u95BE\u5024" }), _jsx("div", { style: { fontSize: 11, color: "#607d8b", marginTop: 2 }, children: "\u9AD8\u3044\u307B\u3069\u8AA4\u691C\u51FA\u304C\u6E1B\u308A\u307E\u3059\u3002\u4F4E\u3044\u307B\u3069\u62FE\u3044\u3084\u3059\u304F\u306A\u308A\u307E\u3059\u3002" })] }), _jsxs("div", { className: "controlWrap", title: "\u00B10.01", children: [_jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: autoThreshold, onChange: (e) => setAutoThreshold(Number(e.target.value)), style: { maxWidth: 200 } }), _jsx(NumericInputWithButtons, { value: autoThreshold, onChange: (v) => typeof v === "number" && setAutoThreshold(v), min: 0, max: 1, step: 0.01, height: 32, inputWidth: 84, ariaLabel: "auto threshold", placeholder: "\u63A8\u5968 0.6\u20130.85", className: "controlWrap", inputClassName: `numInput ${autoThresholdDanger ? "dangerInput" : autoThresholdWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { className: "badge", children: "\u63A8\u5968 0.6\u20130.85" }), _jsx("span", { className: "badge badgeWarn", children: "\u5371\u967A <0.3" }), autoThresholdWarn && !autoThresholdDanger && _jsx("span", { className: "badge badgeDanger", children: "\u6CE8\u610F" }), autoThresholdDanger && _jsx("span", { className: "badge badgeDanger", children: "Danger" })] })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "\u5BFE\u8C61\u30AF\u30E9\u30B9" }), _jsx("div", { style: { fontSize: 11, color: "#607d8b", marginTop: 2 }, children: "\u672A\u30C1\u30A7\u30C3\u30AF\u306E\u30AF\u30E9\u30B9\u306F\u5BFE\u8C61\u5916\u306B\u306A\u308A\u307E\u3059\u3002" }), _jsxs("div", { style: {
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
                                                        }, children: [classOptions.length === 0 && (_jsx("span", { style: { fontSize: 12, color: "#888" }, children: "\u30AF\u30E9\u30B9\u672A\u8A2D\u5B9A" })), asChildren(classOptions.map((name, idx) => {
                                                                const checked = autoClassFilter.includes(name);
                                                                return (_jsxs("label", { style: {
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        gap: 4,
                                                                        fontSize: 11,
                                                                        padding: "2px 8px",
                                                                        border: "1px solid #d9e2ec",
                                                                        borderRadius: 999,
                                                                        background: checked ? "#e3f2fd" : "#fff",
                                                                        flexWrap: "wrap",
                                                                    }, children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (e) => {
                                                                                const next = e.target.checked
                                                                                    ? [...autoClassFilter, name]
                                                                                    : autoClassFilter.filter((c) => c !== name);
                                                                                setAutoClassFilter(next);
                                                                            } }), _jsx("span", { children: name })] }, `auto-class-${name}-${idx}`));
                                                            }))] })] }), _jsx("button", { type: "button", onClick: handleAutoAnnotate, disabled: autoRunning, style: {
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
                                                }, children: _jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [autoRunning && (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 50 50", style: { display: "block" }, children: _jsx("circle", { cx: "25", cy: "25", r: "20", fill: "none", stroke: "#fff", strokeWidth: "5", strokeLinecap: "round", strokeDasharray: "90 60", children: _jsx("animateTransform", { attributeName: "transform", type: "rotate", from: "0 25 25", to: "360 25 25", dur: "1s", repeatCount: "indefinite" }) }) })), autoRunning ? `実行中…${autoProgress}%` : "全自動アノテーション（追加）"] }) }), autoResult && (_jsxs("div", { style: { fontSize: 12, color: "#0b3954" }, children: [_jsxs("div", { children: ["\u8FFD\u52A0\u3055\u308C\u305F\u30A2\u30CE\u30C6\u30FC\u30B7\u30E7\u30F3\u6570: ", autoResult.added] }), _jsxs("div", { children: ["\u9664\u5916\u3055\u308C\u305F\u5019\u88DC\u6570: ", autoResult.rejected] }), _jsxs("div", { children: ["\u4F7F\u7528\u3057\u305F\u95BE\u5024: ", autoResult.threshold.toFixed(2)] }), _jsx("button", { type: "button", onClick: handleUndoAutoAnnotate, disabled: lastAutoAddedIds.length === 0, style: {
                                                            marginTop: 6,
                                                            height: 28,
                                                            padding: "0 10px",
                                                            borderRadius: 6,
                                                            border: "1px solid #d9e2ec",
                                                            background: "#fff",
                                                            fontSize: 11,
                                                            cursor: "pointer",
                                                            opacity: lastAutoAddedIds.length === 0 ? 0.5 : 1,
                                                        }, children: "\u76F4\u524D\u306E\u8FFD\u52A0\u5206\u3092\u53D6\u308A\u6D88\u3059" })] })), _jsx("button", { type: "button", onClick: () => setAutoAdvancedOpen((prev) => !prev), style: {
                                                    height: 28,
                                                    borderRadius: 6,
                                                    border: "1px dashed #b0bec5",
                                                    background: "#fff",
                                                    fontSize: 11,
                                                    cursor: "pointer",
                                                }, children: autoAdvancedOpen ? "詳細設定を閉じる" : "詳細設定を開く" }), autoAdvancedOpen && (_jsxs("div", { className: "autoAdvanced", style: {
                                                    display: "grid",
                                                    gap: 8,
                                                    marginTop: 2,
                                                    padding: 10,
                                                    borderRadius: 8,
                                                    background: "#eef3ff",
                                                    border: "1px solid #c8d6ff",
                                                }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 600 } }), autoDirty && autoBaseline && (_jsx("button", { type: "button", className: "btn btnGhost", style: { height: 24, padding: "0 8px", fontSize: 10 }, onClick: () => {
                                                                    setAutoThreshold(autoBaseline.autoThreshold);
                                                                    setAutoMethod(autoBaseline.autoMethod);
                                                                    setAutoClassFilter(autoBaseline.autoClassFilter);
                                                                    setAutoStride(autoBaseline.autoStride);
                                                                    setScaleMin(autoBaseline.scaleMin);
                                                                    setScaleMax(autoBaseline.scaleMax);
                                                                    setScaleSteps(autoBaseline.scaleSteps);
                                                                    setRoiSize(autoBaseline.roiSize);
                                                                }, children: "Reset" }))] }), _jsx("div", { style: { fontSize: 12, fontWeight: 600 }, children: "\u691C\u51FA\u65B9\u5F0F" }), _jsx("div", { style: { display: "grid", gap: 6 }, children: [
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
                                                            return (_jsxs("label", { className: "autoMethodCard", style: {
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
                                                                }, children: [_jsx("input", { type: "radio", name: "auto-method", checked: selected, onChange: () => setAutoMethod(item.key) }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [_jsx("span", { style: { fontWeight: 700, color: item.accent }, children: item.label }), _jsx("span", { className: "autoMethodHelp", style: { color: "#666" }, children: item.help })] })] }, `auto-method-${item.key}`));
                                                        }) }), _jsxs("div", { className: "formRow", style: { alignItems: "start" }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600, paddingTop: 4 }, children: "\u30B9\u30B1\u30FC\u30EB" }), _jsxs("div", { className: "controlStack", children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }, title: "\u00B10.1", children: [_jsx(NumericInputWithButtons, { value: scaleMin, onChange: (v) => typeof v === "number" && setScaleMin(v), min: 0.1, step: 0.1, height: 32, inputWidth: 84, ariaLabel: "auto scale min", placeholder: "\u63A8\u5968 0.4\u20130.8", className: "controlWrap", inputClassName: `numInput ${scaleMinDanger ? "dangerInput" : scaleMinWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { className: "miniLabel", style: { textAlign: "center" }, children: "min" })] }), _jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }, title: "\u00B10.1", children: [_jsx(NumericInputWithButtons, { value: scaleMax, onChange: (v) => typeof v === "number" && setScaleMax(v), min: 0.1, step: 0.1, height: 32, inputWidth: 84, ariaLabel: "auto scale max", placeholder: "\u63A8\u5968 1.2\u20132.0", className: "controlWrap", inputClassName: `numInput ${scaleMaxDanger ? "dangerInput" : scaleMaxWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { className: "miniLabel", style: { textAlign: "center" }, children: "max" })] }), _jsxs("div", { className: "hintText", children: [_jsx("span", { className: "badge", children: "\u63A8\u5968 min 0.4\u20130.8 / max 1.2\u20132.0" }), _jsx("span", { className: "badge badgeWarn", children: "\u5371\u967A min<0.2, max>3.0" }), (scaleMinWarn || scaleMaxWarn) && !scaleMinDanger && !scaleMaxDanger && (_jsx("span", { className: "badge badgeDanger", children: "\u6CE8\u610F" })), (scaleMinDanger || scaleMaxDanger) && (_jsx("span", { className: "badge badgeDanger", children: "Danger" }))] })] })] }), _jsxs("div", { className: "formRow", children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600 }, children: "\u5206\u5272" }), _jsxs("div", { className: "controlWrap", title: "\u00B11", children: [_jsx(NumericInputWithButtons, { value: scaleSteps, onChange: (v) => typeof v === "number" && setScaleSteps(v), min: 1, step: 1, height: 32, inputWidth: 84, ariaLabel: "auto scale steps", placeholder: "\u63A8\u5968 6\u201312", className: "controlWrap", inputClassName: `numInput ${scaleStepsDanger ? "dangerInput" : scaleStepsWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { className: "badge", children: "\u63A8\u5968 6\u201312" }), _jsx("span", { className: "badge badgeWarn", children: "\u5371\u967A >20" }), scaleStepsWarn && !scaleStepsDanger && _jsx("span", { className: "badge badgeDanger", children: "\u6CE8\u610F" }), scaleStepsDanger && _jsx("span", { className: "badge badgeDanger", children: "Danger" })] })] }), _jsxs("div", { className: "formRow", children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600 }, children: "stride" }), _jsxs("div", { className: "controlWrap", title: "\u00B11", children: [_jsx("div", { style: { display: "flex", flexWrap: "nowrap", gap: 6, alignItems: "center" }, children: _jsx(NumericInputWithButtons, { value: autoStride ?? "", onChange: (v) => setAutoStride(v === "" ? null : v), min: 1, step: 1, height: 32, inputWidth: 120, ariaLabel: "auto stride", placeholder: "\u63A8\u5968 auto / 32\u2013128", className: "controlWrap noWrapRow", inputClassName: `midInput ${strideDanger ? "dangerInput" : strideWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }) }), _jsx("span", { className: "badge", children: "\u63A8\u5968 auto / 32\u2013128" }), _jsx("span", { className: "badge badgeWarn", children: "\u5371\u967A <16 or >256" }), strideWarn && !strideDanger && _jsx("span", { className: "badge badgeDanger", children: "\u6CE8\u610F" }), strideDanger && _jsx("span", { className: "badge badgeDanger", children: "Danger" }), typeof autoStride === "number" && autoStride <= 0 && (_jsx("span", { className: "badge badgeDanger", children: "\u5165\u529B\u304C\u4E0D\u6B63\u3067\u3059" }))] })] }), _jsxs("div", { className: "formRow", children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600 }, children: "ROI\u30B5\u30A4\u30BA" }), _jsxs("div", { className: "controlWrap", title: "\u00B110", children: [_jsx(NumericInputWithButtons, { value: roiSize, onChange: (v) => typeof v === "number" && setRoiSize(v), min: 10, step: 10, height: 32, inputWidth: 84, ariaLabel: "auto roi size", placeholder: "\u63A8\u5968 200\u2013600", className: "controlWrap", inputClassName: `numInput ${roiDanger ? "dangerInput" : roiWarn ? "warnInput" : ""}`, buttonClassName: "stepBtn" }), _jsx("span", { style: { fontSize: 11, color: "#607d8b" }, children: "\u624B\u52D5/\u81EA\u52D5\u3067\u5171\u901A" }), _jsx("span", { className: "badge", children: "\u63A8\u5968 200\u2013600" }), _jsx("span", { className: "badge badgeWarn", children: "\u5371\u967A <100 or >1200" }), roiWarn && !roiDanger && _jsx("span", { className: "badge badgeDanger", children: "\u6CE8\u610F" }), roiDanger && _jsx("span", { className: "badge badgeDanger", children: "Danger" })] })] })] }))] }))] }), _jsx("div", { style: { marginBottom: 16 } }), _jsxs("div", { className: "sectionCard confirmedSection", style: { paddingTop: 4 }, children: [_jsxs("div", { className: "sectionTitle", style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("span", { children: "\u78BA\u5B9A\u30A2\u30CE\u30C6\u30FC\u30B7\u30E7\u30F3" }), _jsxs("span", { style: { fontSize: 11, color: "var(--muted)" }, children: ["\u8868\u793A ", sortedAnnotations.length, "\u4EF6"] })] }), _jsxs("div", { className: "sectionBody confirmedBody", children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap", rowGap: 6 }, children: [_jsx("span", { style: { fontSize: 11, color: "#666" }, children: "\u30B7\u30EA\u30FC\u30BA" }), _jsxs("select", { value: annotationFilterClass, onChange: (e) => setAnnotationFilterClass(e.target.value), style: { height: 24, fontSize: 11 }, children: [_jsx("option", { value: "all", children: "\u3059\u3079\u3066\u8868\u793A" }, "class-all"), asChildren(classOptions.map((name, idx) => (_jsx("option", { value: name, children: name }, `${name}-${idx}`))))] }), _jsx("button", { type: "button", onClick: () => {
                                                            if (checkedAnnotationIds.length === sortedAnnotations.length) {
                                                                setCheckedAnnotationIds([]);
                                                            }
                                                            else {
                                                                setCheckedAnnotationIds(sortedAnnotations.map((a) => a.id));
                                                            }
                                                        }, style: {
                                                            height: 24,
                                                            fontSize: 11,
                                                            padding: "0 8px",
                                                            borderRadius: 6,
                                                            border: "1px solid #e3e3e3",
                                                            background: "#fafafa",
                                                            cursor: "pointer",
                                                        }, children: checkedAnnotationIds.length === sortedAnnotations.length
                                                            ? "解除"
                                                            : "全てチェック" }), _jsx("button", { type: "button", onClick: () => {
                                                            if (checkedAnnotationIds.length === 0)
                                                                return;
                                                            setAnnotations((prev) => prev.filter((a) => !checkedAnnotationIds.includes(a.id)));
                                                            if (selectedAnnotationId && checkedAnnotationIds.includes(selectedAnnotationId)) {
                                                                setSelectedAnnotationId(null);
                                                            }
                                                            setCheckedAnnotationIds([]);
                                                        }, style: {
                                                            height: 24,
                                                            fontSize: 11,
                                                            padding: "0 8px",
                                                            borderRadius: 6,
                                                            border: "1px solid #ef9a9a",
                                                            background: "#ffebee",
                                                            color: "#b00020",
                                                            cursor: "pointer",
                                                        }, children: "\u9078\u629E\u524A\u9664" })] }), _jsx("div", { style: { fontSize: 11, color: "#666", marginBottom: 6 }, children: sortedAnnotations.length === 0
                                                    ? "内訳: なし"
                                                    : Object.entries(sortedAnnotations.reduce((acc, a) => {
                                                        acc[a.class_name] = (acc[a.class_name] || 0) + 1;
                                                        return acc;
                                                    }, {}))
                                                        .map(([name, count]) => `${name}: ${count}`)
                                                        .join(" / ") }), _jsxs("div", { className: "confirmedList", children: [sortedAnnotations.length === 0 && (_jsx("div", { style: { color: "var(--muted)" }, children: "\u78BA\u5B9A\u30A2\u30CE\u30C6\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002" })), asChildren(sortedAnnotations.map((a, idx) => (_jsxs("div", { className: "confirmedRow", ref: (el) => {
                                                            if (a.id)
                                                                annotationRowRefs.current[a.id] = el;
                                                        }, style: {
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
                                                            minHeight: 70,
                                                        }, onClick: () => handleSelectAnnotation(a), children: [_jsx("input", { type: "checkbox", checked: checkedAnnotationIds.includes(a.id), onClick: (e) => e.stopPropagation(), onChange: (e) => {
                                                                    const next = e.target.checked
                                                                        ? [...checkedAnnotationIds, a.id]
                                                                        : checkedAnnotationIds.filter((id) => id !== a.id);
                                                                    setCheckedAnnotationIds(next);
                                                                } }), _jsxs("div", { style: { display: "grid", gap: 4 }, children: [_jsxs("div", { style: { fontWeight: 600, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }, children: [_jsx("span", { style: {
                                                                                    width: 16,
                                                                                    height: 16,
                                                                                    borderRadius: 2,
                                                                                    background: colorMap[a.class_name] || "#333",
                                                                                    display: "inline-block",
                                                                                } }), _jsx("span", { style: { color: "#0b1f3a" }, children: a.class_name }), _jsx("span", { style: {
                                                                                    fontSize: 10,
                                                                                    padding: "2px 6px",
                                                                                    borderRadius: 10,
                                                                                    background: a.source === "manual" ? "#b00020" : "#2e7d32",
                                                                                    color: "#fff",
                                                                                    border: "1px solid transparent",
                                                                                }, children: a.source === "manual" ? "MANUEL" : a.source.toUpperCase() }), a.segPolygon && a.segMethod && (_jsx("span", { style: {
                                                                                    fontSize: 10,
                                                                                    padding: "2px 6px",
                                                                                    borderRadius: 10,
                                                                                    background: a.segMethod === "sam" ? "#2e7d32" : "#888",
                                                                                    color: "#fff",
                                                                                }, children: a.segMethod.toUpperCase() })), a.segPolygon && !a.segMethod && (_jsx("span", { style: {
                                                                                    fontSize: 10,
                                                                                    padding: "2px 6px",
                                                                                    borderRadius: 10,
                                                                                    background: "#1a73e8",
                                                                                    color: "#fff",
                                                                                }, children: "SEG" }))] }), _jsxs("div", { style: { fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }, children: ["BBox: (", Math.round(a.bbox.x), ", ", Math.round(a.bbox.y), ", ", Math.round(a.bbox.w), ", ", Math.round(a.bbox.h), ")"] }), _jsxs("div", { style: {
                                                                            display: "flex",
                                                                            justifyContent: "space-between",
                                                                            gap: 8,
                                                                            fontSize: 11,
                                                                            color: "var(--muted)",
                                                                            fontVariantNumeric: "tabular-nums",
                                                                        }, children: [_jsxs("span", { children: ["CONF: ", typeof a.score === "number" ? a.score.toFixed(3) : "-"] }), _jsxs("span", { children: ["TIME: ", a.created_at ? new Date(a.created_at).toLocaleTimeString() : ""] })] })] }), _jsx("div", { style: { textAlign: "right", justifySelf: "end" } }), _jsx("button", { type: "button", "aria-label": "delete", onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    setAnnotations((prev) => prev.filter((item) => item.id !== a.id));
                                                                    if (selectedAnnotationId === a.id) {
                                                                        setSelectedAnnotationId(null);
                                                                    }
                                                                }, className: "btn btnGhost", style: {
                                                                    width: 32,
                                                                    height: 32,
                                                                    padding: 0,
                                                                    borderRadius: 8,
                                                                    fontSize: 14,
                                                                    boxShadow: "none",
                                                                }, children: "\uD83D\uDDD1" })] }, `${a.id || "ann"}-${idx}`))))] })] })] }), selectedAnnotation?.segPolygon && (_jsxs("div", { style: { marginBottom: 18 }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: 8 }, children: "Seg\u7DE8\u96C6" }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [_jsx("input", { type: "checkbox", checked: segEditMode, onChange: (e) => {
                                                    const next = e.target.checked;
                                                    if (!next && segEditMode) {
                                                        applySegSimplify();
                                                    }
                                                    setSegEditMode(next);
                                                } }), _jsx("span", { style: { fontSize: 12 }, children: "\u7DE8\u96C6\u30E2\u30FC\u30C9ON/OFF" })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }, children: [_jsx("input", { type: "checkbox", checked: showSegVertices, onChange: (e) => setShowSegVertices(e.target.checked), disabled: !segEditMode }), _jsx("span", { style: { fontSize: 12 }, children: "\u9802\u70B9\u3092\u8868\u793A" })] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 12, minWidth: 70 }, children: "\u7C21\u7565\u5316" }), _jsx("input", { type: "range", min: 1, max: 10, step: 1, value: segSimplifyEps, onChange: (e) => setSegSimplifyEps(Number(e.target.value)), disabled: !segEditMode }), _jsx("span", { style: { fontSize: 12 }, children: segSimplifyEps })] }), _jsxs("div", { style: { display: "flex", gap: 8 }, children: [_jsx("button", { type: "button", onClick: handleSegUndo, disabled: !segEditMode || segUndoStack.length === 0, style: { padding: "6px 10px", fontSize: 12, cursor: "pointer" }, children: "Undo" }), _jsx("button", { type: "button", onClick: handleSegReset, disabled: !segEditMode || !selectedAnnotation.originalSegPolygon, style: { padding: "6px 10px", fontSize: 12, cursor: "pointer" }, children: "Reset" })] })] })), _jsx("div", { style: { marginBottom: 18 } })] })] })) : (_jsxs("div", { style: { padding: 24 }, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 700, marginBottom: 12 }, children: "Project Home" }), _jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }, children: [_jsx("input", { type: "text", id: "project-name-input", name: "project_name", placeholder: "project_name", value: newProjectName, onChange: (e) => setNewProjectName(e.target.value), style: { height: 36, padding: "0 10px", minWidth: 240 } }), _jsx("button", { type: "button", onClick: handleCreateProject, style: {
                                    height: 36,
                                    padding: "0 12px",
                                    borderRadius: 8,
                                    border: "1px solid #1a73e8",
                                    background: "#1a73e8",
                                    color: "#fff",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }, children: "\u65B0\u898F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u4F5C\u6210" })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }, children: [asChildren(projectList.map((p, idx) => (_jsxs("div", { style: {
                                    border: "1px solid #e3e3e3",
                                    borderRadius: 10,
                                    padding: 12,
                                    background: "#fff",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                }, children: [_jsx("div", { style: { fontWeight: 600 }, children: p.project_name }), _jsxs("div", { style: { fontSize: 12, color: "#666" }, children: ["\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8: ", templateByDataset[p.project_name] || "未設定"] }), _jsxs("div", { style: { fontSize: 12, color: "#666" }, children: ["\u753B\u50CF: ", p.total_images, " / \u30A2\u30CE\u30C6\u6E08: ", p.annotated_images] }), _jsxs("div", { style: { fontSize: 12, color: "#666" }, children: ["bbox: ", p.bbox_count, " / seg: ", p.seg_count] }), _jsxs("div", { style: { fontSize: 11, color: "#999" }, children: ["\u66F4\u65B0: ", p.updated_at || "-"] }), _jsxs("div", { style: { display: "flex", gap: 8, marginTop: 6 }, children: [_jsx("button", { type: "button", onClick: () => handleOpenProject(p.project_name), style: {
                                                    flex: 1,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    border: "1px solid #1a73e8",
                                                    background: "#e8f0fe",
                                                    cursor: "pointer",
                                                }, children: "\u958B\u304F" }), _jsx("button", { type: "button", onClick: () => handleDeleteProject(p.project_name), style: {
                                                    height: 32,
                                                    borderRadius: 8,
                                                    border: "1px solid #e3e3e3",
                                                    background: "#fff",
                                                    cursor: "pointer",
                                                }, children: "\u524A\u9664" })] })] }, `${p.project_name || "project"}-${idx}`)))), projectList.length === 0 && (_jsx("div", { style: { color: "#666" }, children: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u304C\u3042\u308A\u307E\u305B\u3093\u3002" }))] })] }))] }));
}
function randomColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
}
function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function seededShuffle(items, seed) {
    const arr = [...items];
    const rnd = mulberry32(seed);
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
