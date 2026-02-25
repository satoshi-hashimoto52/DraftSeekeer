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
  fetchTemplateClassPreviews,
  fetchTemplateClassItems,
  buildTemplateImageUrl,
  buildTemplateBinaryImageUrl,
  buildTemplateOverlayBlueImageUrl,
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
  fetchAutoAnnotateProgress,
  fetchProjectAnnotationStats,
  shutdownApp,
  ProjectAnnotationStatsResponse,
} from "./api.ts";
import ImageCanvas, { ImageCanvasHandle } from "./components/ImageCanvas.tsx";
import NumericInputWithButtons from "./components/NumericInputWithButtons.tsx";
import { normalizeToHex } from "./utils/color.ts";
import { clampToImage, simplifyPolygon } from "./utils/polygon.ts";

const DEFAULT_ROI_SIZE = 350;
const DEFAULT_TOPK = 3;
const DEFAULT_SCALE_MIN = 0.6;
const DEFAULT_SCALE_MAX = 1.4;
const DEFAULT_SCALE_STEPS = 8;
const SCALE_RANGE_MIN = 0.1;
const SCALE_RANGE_MAX = 2.0;
const DEFAULT_SHAPE_RATIO_THRESHOLD = 0.6;
const DEFAULT_EXCLUDE_ENABLED = true;
const DEFAULT_EXCLUDE_MODE: "same_class" | "any_class" = "same_class";
const DEFAULT_EXCLUDE_CENTER = true;
const DEFAULT_EXCLUDE_IOU_THRESHOLD = 0.6;
const DEFAULT_REFINE_CONTOUR = false;
type AutoMethod = "combined" | "scaled_templates" | "scaled_templates_beta";
type DetectionMode = "click" | "hover";
type DebugPanelTab = "follow" | "last";

const DEFAULT_AUTO_METHOD: AutoMethod = "combined";
const DEFAULT_HOVER_DETECT_INTERVAL_MS = 120;
const DEFAULT_HOVER_REDETECT_DISTANCE_PX = 10;
const DEBUG_TEMPLATE_SCALE_STEP = 0.01;
const PROJECT_STATS_POPUP_W = 760;
const PROJECT_STATS_POPUP_H = 380;
const HOME_PREREQ_SEEN_KEY = "draftseeker:homePrereqSeen:v1";
const HOME_PREREQ_SHOW_ON_STARTUP_KEY = "draftseeker:homePrereqShowOnStartup:v1";
const HOME_PREREQ_AUTO_SHOWN_SESSION_KEY = "draftseeker:homePrereqAutoShownSession:v1";
const DEFAULT_AUTO_THRESHOLD_BY_METHOD: Record<AutoMethod, number> = {
  combined: 0.65,
  scaled_templates: 0.7,
  scaled_templates_beta: 0.8,
};

function TemplateLockIcon({ unlocked }: { unlocked: boolean }) {
  const neon = unlocked ? "#ff3b30" : "#39ff14";
  const outline = "#000000";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <filter id="lockGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="5.5" y="10" width="13" height="10" rx="2.4" fill={neon} fillOpacity="0.22" />
      <rect x="5.5" y="10" width="13" height="10" rx="2.4" stroke={outline} strokeWidth="3.8" />
      <rect
        x="5.5"
        y="10"
        width="13"
        height="10"
        rx="2.4"
        stroke={neon}
        strokeWidth="2.2"
        filter="url(#lockGlow)"
      />
      {!unlocked ? (
        <>
          <path d="M8 10V7.1a4 4 0 1 1 8 0V10" stroke={outline} strokeWidth="3.8" strokeLinecap="round" />
          <path
            d="M8 10V7.1a4 4 0 1 1 8 0V10"
            stroke={neon}
            strokeWidth="2.2"
            strokeLinecap="round"
            filter="url(#lockGlow)"
          />
          <circle cx="12" cy="14.6" r="1.25" stroke={outline} strokeWidth="2.8" />
          <circle cx="12" cy="14.6" r="1.25" stroke={neon} strokeWidth="1.8" filter="url(#lockGlow)" />
          <path d="M12 16V17.5" stroke={outline} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M12 16V17.5" stroke={neon} strokeWidth="1.8" strokeLinecap="round" filter="url(#lockGlow)" />
        </>
      ) : (
        <>
          <path d="M16.2 10V7.1a4 4 0 1 0-8 0v1.6" stroke={outline} strokeWidth="3.8" strokeLinecap="round" />
          <path
            d="M16.2 10V7.1a4 4 0 1 0-8 0v1.6"
            stroke={neon}
            strokeWidth="2.2"
            strokeLinecap="round"
            filter="url(#lockGlow)"
          />
          <path d="M9 8.7l-2 1.7" stroke={outline} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M9 8.7l-2 1.7" stroke={neon} strokeWidth="1.8" strokeLinecap="round" filter="url(#lockGlow)" />
        </>
      )}
    </svg>
  );
}

export default function App() {
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [projectList, setProjectList] = useState<DatasetInfo[]>([]);
  const [hoverProjectStatsAnchor, setHoverProjectStatsAnchor] = useState<{
    projectName: string;
    rect: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const hoverProjectStatsTimerRef = useRef<number | null>(null);
  const [projectStatsPopupPos, setProjectStatsPopupPos] = useState<{ left: number; top: number } | null>(null);
  const projectStatsDragRef = useRef<{ active: boolean; dx: number; dy: number }>({
    active: false,
    dx: 0,
    dy: 0,
  });
  const [projectStatsByName, setProjectStatsByName] = useState<Record<string, ProjectAnnotationStatsResponse>>({});
  const [projectStatsLoadingName, setProjectStatsLoadingName] = useState<string | null>(null);
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
  const [refineContour, setRefineContour] = useState<boolean>(DEFAULT_REFINE_CONTOUR);
  const [excludeEnabled, setExcludeEnabled] = useState<boolean>(DEFAULT_EXCLUDE_ENABLED);
  const [excludeMode, setExcludeMode] = useState<"same_class" | "any_class">(DEFAULT_EXCLUDE_MODE);
  const [excludeCenter, setExcludeCenter] = useState<boolean>(DEFAULT_EXCLUDE_CENTER);
  const [excludeIouThreshold, setExcludeIouThreshold] = useState<number>(DEFAULT_EXCLUDE_IOU_THRESHOLD);
  const [showExportDrawer, setShowExportDrawer] = useState<boolean>(false);
  const [advancedTab, setAdvancedTab] = useState<"params" | "classes">("params");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [debugPanelTab, setDebugPanelTab] = useState<DebugPanelTab>("follow");
  const [classCardFilter, setClassCardFilter] = useState<"all" | "enabled">("all");
  const [showCommonSettings, setShowCommonSettings] = useState<boolean>(true);
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
  const [shapeRatioThreshold, setShapeRatioThreshold] = useState<number>(DEFAULT_SHAPE_RATIO_THRESHOLD);
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
  const [showRoiArea, setShowRoiArea] = useState<boolean>(true);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("click");
  const [hoverDetectIntervalMs, setHoverDetectIntervalMs] = useState<number>(
    DEFAULT_HOVER_DETECT_INTERVAL_MS
  );
  const [hoverRedetectDistancePx, setHoverRedetectDistancePx] = useState<number>(
    DEFAULT_HOVER_REDETECT_DISTANCE_PX
  );
  const canvasRef = useRef<ImageCanvasHandle | null>(null);
  const [lastClick, setLastClick] = useState<{ x: number; y: number } | null>(null);
  const [followupScanReady, setFollowupScanReady] = useState<boolean>(false);
  const followupScanPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverDetectTimerRef = useRef<number | null>(null);
  const hoverLastDetectedPointRef = useRef<{ x: number; y: number } | null>(null);
  const [detectDebug, setDetectDebug] = useState<DetectPointResponse["debug"] | null>(null);
  const [lastDetectionSnapshot, setLastDetectionSnapshot] = useState<{
    mode: DetectionMode;
    point: { x: number; y: number };
    roiSize: number;
    scaleMin: number;
    scaleMax: number;
    scaleSteps: number;
    topk: number;
    shapeRatioThreshold: number;
    classFilter: string[];
    excludeMode: "same_class" | "any_class";
    excludeCenter: boolean;
    excludeIouThreshold: number;
    bestClass: string;
    bestScore: number | null;
    bestScale: number | null;
    bestTemplate: string;
    bestMatchMode: string;
    matchedTemplateBase64: string | null;
  } | null>(null);
  const [segEditMode, setSegEditMode] = useState<boolean>(false);
  const [showSegVertices, setShowSegVertices] = useState<boolean>(true);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [segUndoStack, setSegUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [segSimplifyEps, setSegSimplifyEps] = useState<number>(2);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [isCreatingManualBBox, setIsCreatingManualBBox] = useState<boolean>(false);
  const [highlightAnnotationId, setHighlightAnnotationId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [showHints, setShowHints] = useState<boolean>(true);
  const [datasetImporting, setDatasetImporting] = useState<boolean>(false);
  const [lastImportPath, setLastImportPath] = useState<string | null>(null);
  const [importPathByDataset, setImportPathByDataset] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("draftseeker.importPathByDataset");
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  });
  const [showHeaderSettings, setShowHeaderSettings] = useState<boolean>(false);
  const headerSettingsRef = useRef<HTMLDivElement | null>(null);
  const [showHomePrereqModal, setShowHomePrereqModal] = useState<boolean>(false);
  const [showHomePrereqOnStartup, setShowHomePrereqOnStartup] = useState<boolean>(true);
  const [autoThreshold, setAutoThreshold] = useState<number>(
    DEFAULT_AUTO_THRESHOLD_BY_METHOD[DEFAULT_AUTO_METHOD]
  );
  const [autoClassFilter, setAutoClassFilter] = useState<string[]>([]);
  const [autoMethod, setAutoMethod] = useState<AutoMethod>(DEFAULT_AUTO_METHOD);
  const [autoPanelOpen, setAutoPanelOpen] = useState<boolean>(true);
  const [autoStride, setAutoStride] = useState<number | null>(null);
  const [advancedBaseline, setAdvancedBaseline] = useState<{
    roiSize: number;
    topk: number;
    shapeRatioThreshold: number;
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
    autoMethod: AutoMethod;
    autoClassFilter: string[];
    autoStride: number | null;
  } | null>(null);
  const [autoRunning, setAutoRunning] = useState<boolean>(false);
  const [autoResult, setAutoResult] = useState<{
    added: number;
    rejected: number;
    threshold: number;
    elapsedMs: number;
    classProgress: { className: string; confirmed: number; preDetect: number }[];
  } | null>(null);
  const [autoProgress, setAutoProgress] = useState<number>(0);
  const [autoProgressId, setAutoProgressId] = useState<string>("");
  const [autoRuntimeClassProgress, setAutoRuntimeClassProgress] = useState<
    { className: string; confirmed: number; preDetect: number }[]
  >([]);
  const [lastAutoAddedIds, setLastAutoAddedIds] = useState<string[]>([]);
  const autoProgressPollRef = useRef<number | null>(null);
  const [checkedAnnotationIds, setCheckedAnnotationIds] = useState<string[]>([]);
  const [editingAnnotationClassId, setEditingAnnotationClassId] = useState<string | null>(null);
  const annotationRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const allowAnnotationAutoScrollRef = useRef<boolean>(false);
  const confirmedListRef = useRef<HTMLDivElement | null>(null);
  const templatePreviewRepeatTimerRef = useRef<number | null>(null);
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
  const [templateClassPreviews, setTemplateClassPreviews] = useState<Record<string, string | null>>({});
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState<boolean>(false);
  const [templateGalleryClassName, setTemplateGalleryClassName] = useState<string>("");
  const [templateGalleryItems, setTemplateGalleryItems] = useState<
    { name: string; width: number; height: number }[]
  >([]);
  const [templateGalleryLoading, setTemplateGalleryLoading] = useState<boolean>(false);
  const [templateGalleryPreviewName, setTemplateGalleryPreviewName] = useState<string | null>(null);
  const templateGalleryPreviewNameRef = useRef<string | null>(null);
  const [templateGalleryPreviewNaturalSize, setTemplateGalleryPreviewNaturalSize] = useState<
    { w: number; h: number } | null
  >(null);
  const debugParamSyncRef = useRef<string>("");
  const templatePreviewCacheRef = useRef<Map<string, string>>(new Map());
  const [debugTemplateClass, setDebugTemplateClass] = useState<string>("");
  const [debugTemplateItems, setDebugTemplateItems] = useState<
    { name: string; width: number; height: number }[]
  >([]);
  const [debugTemplateName, setDebugTemplateName] = useState<string>("");
  const [debugTemplateLoading, setDebugTemplateLoading] = useState<boolean>(false);
  const [debugTemplateScale, setDebugTemplateScale] = useState<number>(1);
  const prevDebugTemplateClassRef = useRef<string>("");
  const [classScoreVisibility, setClassScoreVisibility] = useState<Record<string, number>>({});
  const [classScaleVisibility, setClassScaleVisibility] = useState<Record<string, number>>({});
  const templateGalleryTextColor = "rgba(72, 132, 255, 0.92)";
  const templateGalleryPreviewTextColor = "rgba(214, 236, 255, 0.98)";
  const didAutoRestoreRef = useRef(false);
  const previewImageBoostStyle = useMemo(() => {
    if (!templateGalleryPreviewNaturalSize) {
      return { width: "auto", height: "auto" } as const;
    }
    const vw = typeof window !== "undefined" ? window.innerWidth : 1400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const targetW = vw * 0.6;
    const targetH = vh * 0.6;
    const { w, h } = templateGalleryPreviewNaturalSize;
    const isLandscape = w >= h;
    const currentLong = isLandscape ? w : h;
    const targetLong = isLandscape ? targetW : targetH;
    if (currentLong >= targetLong * 0.98) {
      return { width: "auto", height: "auto" } as const;
    }
    if (isLandscape) {
      return { width: `${Math.round(targetW)}px`, height: "auto" } as const;
    }
    return { width: "auto", height: `${Math.round(targetH)}px` } as const;
  }, [templateGalleryPreviewNaturalSize]);
  const debugTemplateImageUrl = useMemo(() => {
    if (!project || !debugTemplateClass || !debugTemplateName) return null;
    return buildTemplateOverlayBlueImageUrl(project, debugTemplateClass, debugTemplateName);
  }, [project, debugTemplateClass, debugTemplateName]);
  const applyAutoMethodDefaults = (method: AutoMethod) => {
    setAutoMethod(method);
    setAutoThreshold(DEFAULT_AUTO_THRESHOLD_BY_METHOD[method]);
  };
  type AppViewState =
    | { view: "home" }
    | { view: "project"; projectName: string; lastImageKey?: string };
  const VIEW_STATE_KEY = "draftseeker:viewState:v1";
  const FIRST_BOOT_SESSION_KEY = "draftseeker:firstBootDone:v1";
  const [viewState, setViewState] = useState<AppViewState>(() => {
    try {
      const firstBootDone = sessionStorage.getItem(FIRST_BOOT_SESSION_KEY) === "1";
      if (!firstBootDone) {
        sessionStorage.setItem(FIRST_BOOT_SESSION_KEY, "1");
        return { view: "home" };
      }
      const raw = localStorage.getItem(VIEW_STATE_KEY);
      if (!raw) return { view: "home" };
      const parsed = JSON.parse(raw) as AppViewState;
      if (parsed && parsed.view === "project" && typeof (parsed as any).projectName === "string") {
        return {
          view: "project",
          projectName: (parsed as any).projectName,
          lastImageKey:
            typeof (parsed as any).lastImageKey === "string" ? (parsed as any).lastImageKey : undefined,
        };
      }
      return { view: "home" };
    } catch {
      return { view: "home" };
    }
  });
  const [leftFilter, setLeftFilter] = useState<"all" | "annotated" | "unannotated">(() => {
    try {
      const raw = localStorage.getItem("draftseeker:leftFilter:v1");
      if (raw === "annotated" || raw === "unannotated") return raw;
      return "all";
    } catch {
      return "all";
    }
  });
  const restoredImageRef = useRef(false);
  const asChildren = (nodes: React.ReactNode[]) => React.Children.toArray(nodes);

  const dismissHints = () => {
    setShowHints(false);
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

  const handleProjectCardHoverEnter = async (
    projectName: string,
    rect: { left: number; top: number; right: number; bottom: number }
  ) => {
    if (hoverProjectStatsTimerRef.current !== null) {
      window.clearTimeout(hoverProjectStatsTimerRef.current);
      hoverProjectStatsTimerRef.current = null;
    }
    hoverProjectStatsTimerRef.current = window.setTimeout(() => {
      setHoverProjectStatsAnchor({ projectName, rect });
      hoverProjectStatsTimerRef.current = null;
    }, 1000);
    if (projectStatsByName[projectName] || projectStatsLoadingName === projectName) return;
    setProjectStatsLoadingName(projectName);
    try {
      const stats = await fetchProjectAnnotationStats(projectName);
      setProjectStatsByName((prev) => ({ ...prev, [projectName]: stats }));
    } catch {
      setProjectStatsByName((prev) => ({
        ...prev,
        [projectName]: {
          project_name: projectName,
          rows: [],
          total_confirmed: 0,
          updated_at: null,
        },
      }));
    } finally {
      setProjectStatsLoadingName((prev) => (prev === projectName ? null : prev));
    }
  };

  const getProjectStatsPopupDefaultPos = (anchor: {
    rect: { left: number; top: number; right: number; bottom: number };
  }) => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1600;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const left = Math.max(16, Math.min(vw - PROJECT_STATS_POPUP_W - 16, anchor.rect.right + 10));
    const top = Math.max(16, Math.min(vh - PROJECT_STATS_POPUP_H - 16, anchor.rect.top - 18));
    return { left, top };
  };

  const refreshTemplateStateForProject = async (targetProject: string) => {
    const list = await fetchTemplates();
    setTemplateProjects(list);
    setProjects(list.map((p) => p.name));
    const selected = list.find((p: ProjectTemplates) => p.name === targetProject);
    const classes =
      selected?.classes.map((c: { class_name: string; count: number }) => c.class_name) || [];
    setClassOptions(classes);
    setAutoClassFilter(classes);
    setClassScoreVisibility({});
    setClassScaleVisibility({});
    setTemplateClassPreviews({});
    setColorMap((prev) => {
      const defaults = buildColorMapFromClasses(classes);
      const next: Record<string, string> = {};
      classes.forEach((name) => {
        next[name] = prev[name] || defaults[name];
      });
      return next;
    });
    return classes;
  };

  const resetParamsToDefaults = (classes: string[]) => {
    const nextAdvancedBaseline = {
      roiSize: DEFAULT_ROI_SIZE,
      topk: DEFAULT_TOPK,
      shapeRatioThreshold: DEFAULT_SHAPE_RATIO_THRESHOLD,
      scaleMin: DEFAULT_SCALE_MIN,
      scaleMax: DEFAULT_SCALE_MAX,
      scaleSteps: DEFAULT_SCALE_STEPS,
      excludeEnabled: DEFAULT_EXCLUDE_ENABLED,
      excludeMode: DEFAULT_EXCLUDE_MODE,
      excludeCenter: DEFAULT_EXCLUDE_CENTER,
      excludeIouThreshold: DEFAULT_EXCLUDE_IOU_THRESHOLD,
      refineContour: DEFAULT_REFINE_CONTOUR,
    };
    setAdvancedBaseline(nextAdvancedBaseline);
    setRoiSize(nextAdvancedBaseline.roiSize);
    setTopk(nextAdvancedBaseline.topk);
    setShapeRatioThreshold(nextAdvancedBaseline.shapeRatioThreshold);
    setScaleMin(nextAdvancedBaseline.scaleMin);
    setScaleMax(nextAdvancedBaseline.scaleMax);
    setScaleSteps(nextAdvancedBaseline.scaleSteps);
    setExcludeEnabled(nextAdvancedBaseline.excludeEnabled);
    setExcludeMode(nextAdvancedBaseline.excludeMode);
    setExcludeCenter(nextAdvancedBaseline.excludeCenter);
    setExcludeIouThreshold(nextAdvancedBaseline.excludeIouThreshold);
    setRefineContour(nextAdvancedBaseline.refineContour);

    const nextAutoBaseline = {
      autoThreshold: DEFAULT_AUTO_THRESHOLD_BY_METHOD[DEFAULT_AUTO_METHOD],
      autoMethod: DEFAULT_AUTO_METHOD,
      autoClassFilter: classes,
      autoStride: null,
    };
    setAutoBaseline(nextAutoBaseline);
    setAutoThreshold(nextAutoBaseline.autoThreshold);
    setAutoMethod(nextAutoBaseline.autoMethod);
    setAutoClassFilter(nextAutoBaseline.autoClassFilter);
    setAutoStride(nextAutoBaseline.autoStride);
  };

  const selectedCandidate = useMemo(() => {
    if (!selectedCandidateId) return null;
    return candidates.find((c) => c.id === selectedCandidateId) || null;
  }, [candidates, selectedCandidateId]);
  const activeDetectedCandidate = useMemo(
    () => selectedCandidate || candidates[0] || null,
    [selectedCandidate, candidates]
  );
  const roiOverlayConfidence = useMemo(() => {
    if (
      activeDetectedCandidate &&
      typeof activeDetectedCandidate.score === "number" &&
      Number.isFinite(activeDetectedCandidate.score)
    ) {
      return activeDetectedCandidate.score;
    }
    if (detectDebug && typeof detectDebug.match_score === "number" && Number.isFinite(detectDebug.match_score)) {
      return detectDebug.match_score;
    }
    if (
      lastDetectionSnapshot &&
      typeof lastDetectionSnapshot.bestScore === "number" &&
      Number.isFinite(lastDetectionSnapshot.bestScore)
    ) {
      return lastDetectionSnapshot.bestScore;
    }
    return null;
  }, [activeDetectedCandidate, detectDebug, lastDetectionSnapshot]);

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

  const imagesAll = useMemo(
    () => (datasetInfo?.images ? [...datasetInfo.images] : []),
    [datasetInfo]
  );

  const filteredImages = useMemo(() => {
    if (leftFilter === "all") return imagesAll;
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
      if (ay !== by) return ay - by;
      return a.bbox.x - b.bbox.x;
    });
  }, [filteredAnnotations]);
  const confirmedSeriesOptions = useMemo(() => {
    const names = new Set<string>();
    for (const ann of annotations) {
      if (ann.class_name) names.add(ann.class_name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [annotations]);

  const classAnnotationStats = useMemo(() => {
    const stats: Record<
      string,
      {
        count: number;
        minScore: number | null;
        maxScore: number | null;
        minScale: number | null;
        maxScale: number | null;
      }
    > = {};
    for (const ann of annotations) {
      const key = ann.class_name;
      if (!stats[key]) {
        stats[key] = { count: 0, minScore: null, maxScore: null, minScale: null, maxScale: null };
      }
      stats[key].count += 1;
      if (typeof ann.score === "number" && Number.isFinite(ann.score)) {
        stats[key].minScore =
          stats[key].minScore === null ? ann.score : Math.min(stats[key].minScore, ann.score);
        stats[key].maxScore =
          stats[key].maxScore === null ? ann.score : Math.max(stats[key].maxScore, ann.score);
      }
      if (typeof ann.scale === "number" && Number.isFinite(ann.scale)) {
        stats[key].minScale =
          stats[key].minScale === null ? ann.scale : Math.min(stats[key].minScale, ann.scale);
        stats[key].maxScale =
          stats[key].maxScale === null ? ann.scale : Math.max(stats[key].maxScale, ann.scale);
      }
    }
    return stats;
  }, [annotations]);
  const detectionTargetClasses = useMemo(() => {
    return autoClassFilter.length > 0 ? autoClassFilter : classOptions;
  }, [autoClassFilter, classOptions]);

  const syncClassScoreVisibilityForClasses = (
    nextAnnotations: Annotation[],
    classNames: string[]
  ) => {
    if (classNames.length === 0) return;
    const targets = new Set(classNames.filter(Boolean));
    if (targets.size === 0) return;
    setClassScoreVisibility((prev) => {
      const next = { ...prev };
      targets.forEach((className) => {
        const classItems = nextAnnotations.filter((ann) => ann.class_name === className);
        if (classItems.length <= 1) {
          delete next[className];
          return;
        }
        const scores = classItems
          .map((ann) => ann.score)
          .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
        if (scores.length === 0) {
          delete next[className];
          return;
        }
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const minTrunc = Math.floor(minScore * 100) / 100;
        const maxTrunc = Math.floor(maxScore * 100) / 100;
        if (!(maxTrunc > minTrunc)) {
          delete next[className];
          return;
        }
        // Keep class card slider synchronized to current confirmed range after deletions.
        next[className] = minTrunc;
      });
      return next;
    });
  };
  const ensureClassScoreVisibilityIncludes = (className: string, score?: number) => {
    if (!className || typeof score !== "number" || !Number.isFinite(score)) return;
    const floorScore = Math.floor(score * 100) / 100;
    setClassScoreVisibility((prev) => {
      const current = prev[className];
      if (typeof current !== "number") return prev;
      if (floorScore >= current) return prev;
      return { ...prev, [className]: floorScore };
    });
  };
  const syncClassScaleVisibilityForClasses = (
    nextAnnotations: Annotation[],
    classNames: string[]
  ) => {
    if (classNames.length === 0) return;
    const targets = new Set(classNames.filter(Boolean));
    if (targets.size === 0) return;
    setClassScaleVisibility((prev) => {
      const next = { ...prev };
      targets.forEach((className) => {
        const classItems = nextAnnotations.filter((ann) => ann.class_name === className);
        if (classItems.length <= 1) {
          delete next[className];
          return;
        }
        const scales = classItems
          .map((ann) => ann.scale)
          .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
        if (scales.length === 0) {
          delete next[className];
          return;
        }
        const minScale = Math.min(...scales);
        const maxScale = Math.max(...scales);
        const minTrunc = Math.floor(minScale * 100) / 100;
        const maxTrunc = Math.floor(maxScale * 100) / 100;
        if (!(maxTrunc > minTrunc)) {
          delete next[className];
          return;
        }
        next[className] = minTrunc;
      });
      return next;
    });
  };
  const ensureClassScaleVisibilityIncludes = (className: string, scale?: number) => {
    if (!className || typeof scale !== "number" || !Number.isFinite(scale)) return;
    const floorScale = Math.floor(scale * 100) / 100;
    setClassScaleVisibility((prev) => {
      const current = prev[className];
      if (typeof current !== "number") return prev;
      if (floorScale >= current) return prev;
      return { ...prev, [className]: floorScale };
    });
  };

  useEffect(() => {
    setClassScoreVisibility((prev) => {
      const next: Record<string, number> = {};
      const classNames = new Set<string>([...classOptions, ...Object.keys(classAnnotationStats)]);
      classNames.forEach((className) => {
        const stats = classAnnotationStats[className];
        const minScore = stats?.minScore;
        const maxScore = stats?.maxScore;
        const hasRange =
          (stats?.count || 0) > 1 &&
          typeof minScore === "number" &&
          typeof maxScore === "number" &&
          Number.isFinite(minScore) &&
          Number.isFinite(maxScore);
        if (!hasRange) return;
        const minTrunc = Math.floor(minScore * 100) / 100;
        const maxTrunc = Math.floor(maxScore * 100) / 100;
        if (!(maxTrunc > minTrunc)) return;
        const prevValue = prev[className];
        const base = typeof prevValue === "number" ? prevValue : minTrunc;
        const clamped = Math.min(maxTrunc, Math.max(minTrunc, Math.floor(base * 100) / 100));
        next[className] = clamped;
      });
      return next;
    });
  }, [classOptions, classAnnotationStats]);

  useEffect(() => {
    setClassScaleVisibility((prev) => {
      const next: Record<string, number> = {};
      const classNames = new Set<string>([...classOptions, ...Object.keys(classAnnotationStats)]);
      classNames.forEach((className) => {
        const stats = classAnnotationStats[className];
        const minScale = stats?.minScale;
        const maxScale = stats?.maxScale;
        const hasRange =
          (stats?.count || 0) > 1 &&
          typeof minScale === "number" &&
          typeof maxScale === "number" &&
          Number.isFinite(minScale) &&
          Number.isFinite(maxScale);
        if (!hasRange) return;
        const minTrunc = Math.floor(minScale * 100) / 100;
        const maxTrunc = Math.floor(maxScale * 100) / 100;
        if (!(maxTrunc > minTrunc)) return;
        const prevValue = prev[className];
        const base = typeof prevValue === "number" ? prevValue : minTrunc;
        const clamped = Math.min(maxTrunc, Math.max(minTrunc, Math.floor(base * 100) / 100));
        next[className] = clamped;
      });
      return next;
    });
  }, [classOptions, classAnnotationStats]);

  useEffect(() => {
    if (checkedAnnotationIds.length === 0) return;
    const currentIds = new Set(annotations.map((a) => a.id));
    const next = checkedAnnotationIds.filter((id) => currentIds.has(id));
    if (next.length !== checkedAnnotationIds.length) {
      setCheckedAnnotationIds(next);
    }
  }, [annotations, checkedAnnotationIds]);

  const canvasAnnotations = useMemo(() => {
    return filteredAnnotations.filter((ann) => {
      const scoreThreshold = classScoreVisibility[ann.class_name];
      if (
        typeof scoreThreshold === "number" &&
        typeof ann.score === "number" &&
        Number.isFinite(ann.score) &&
        ann.score < scoreThreshold
      ) {
        return false;
      }
      const scaleThreshold = classScaleVisibility[ann.class_name];
      if (
        typeof scaleThreshold === "number" &&
        typeof ann.scale === "number" &&
        Number.isFinite(ann.scale) &&
        ann.scale < scaleThreshold
      ) {
        return false;
      }
      return true;
    });
  }, [filteredAnnotations, classScoreVisibility, classScaleVisibility]);

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

  const changeAnnotationClass = (annotationId: string, nextClass: string) => {
    if (!annotationId || !nextClass) return;
    setAnnotations((prev) => {
      let prevClass: string | null = null;
      const next = prev.map((ann) => {
        if (ann.id !== annotationId) return ann;
        prevClass = ann.class_name;
        return { ...ann, class_name: nextClass };
      });
      if (prevClass !== null && prevClass !== nextClass) {
        syncClassScoreVisibilityForClasses(next, [prevClass, nextClass]);
        syncClassScaleVisibilityForClasses(next, [prevClass, nextClass]);
      }
      return next;
    });
    setColorMap((prev) => {
      if (prev[nextClass]) return prev;
      return { ...prev, [nextClass]: pickUniqueColor(prev) };
    });
    setEditingAnnotationClassId(null);
  };

  const showUnsetTemplateOption = useMemo(() => {
    if (!datasetId) return true;
    if (!Object.prototype.hasOwnProperty.call(templateByDataset, datasetId)) return true;
    return !templateByDataset[datasetId];
  }, [datasetId, templateByDataset]);

  const isSameArray = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, idx) => v === b[idx]);

  const advancedDirty = useMemo(() => {
    if (!advancedBaseline) return false;
    return (
      roiSize !== advancedBaseline.roiSize ||
      topk !== advancedBaseline.topk ||
      shapeRatioThreshold !== advancedBaseline.shapeRatioThreshold ||
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
    shapeRatioThreshold,
    scaleMin,
    scaleMax,
    scaleSteps,
    excludeEnabled,
    excludeMode,
    excludeCenter,
    excludeIouThreshold,
    refineContour,
  ]);
  const detectionDefaultDirty =
    roiSize !== DEFAULT_ROI_SIZE ||
    topk !== DEFAULT_TOPK ||
    shapeRatioThreshold !== DEFAULT_SHAPE_RATIO_THRESHOLD ||
    scaleMin !== DEFAULT_SCALE_MIN ||
    scaleMax !== DEFAULT_SCALE_MAX ||
    scaleSteps !== DEFAULT_SCALE_STEPS ||
    excludeEnabled !== DEFAULT_EXCLUDE_ENABLED ||
    excludeMode !== DEFAULT_EXCLUDE_MODE ||
    excludeCenter !== DEFAULT_EXCLUDE_CENTER ||
    excludeIouThreshold !== DEFAULT_EXCLUDE_IOU_THRESHOLD ||
    refineContour !== DEFAULT_REFINE_CONTOUR;

  const autoDirty = useMemo(() => {
    if (!autoBaseline) return false;
    return (
      autoThreshold !== autoBaseline.autoThreshold ||
      autoMethod !== autoBaseline.autoMethod ||
      autoStride !== autoBaseline.autoStride ||
      !isSameArray(autoClassFilter, autoBaseline.autoClassFilter)
    );
  }, [
    autoBaseline,
    autoThreshold,
    autoMethod,
    autoStride,
    autoClassFilter,
  ]);

  const scaleMinDanger = scaleMin < 0.2;
  const scaleMaxDanger = scaleMax > SCALE_RANGE_MAX;
  const scaleMinWarn = scaleMin < 0.4 || scaleMin > 0.8;
  const scaleMaxWarn = scaleMax < 1.2 || scaleMax > 2.0;
  const scaleStepsDanger = scaleSteps > 20;
  const scaleStepsWarn = scaleSteps < 6 || scaleSteps > 12;
  const topkDanger = topk > 10;
  const topkWarn = topk < 1 || topk > 5;
  const roiDanger = roiSize < 100 || roiSize > 1200;
  const roiWarn = roiSize < 200 || roiSize > 600;
  const shapeRatioDanger = shapeRatioThreshold < 0.5 || shapeRatioThreshold > 0.7;
  const autoThresholdDanger =
    autoMethod === "scaled_templates_beta" ? autoThreshold < 0.7 : autoThreshold < 0.3;
  const autoThresholdWarn =
    autoMethod === "scaled_templates_beta"
      ? autoThreshold < 0.8 || autoThreshold > 0.98
      : autoThreshold < 0.6 || autoThreshold > 0.85;
  const strideDanger =
    typeof autoStride === "number" && (autoStride < 16 || autoStride > 256);
  const strideWarn =
    typeof autoStride === "number" && (autoStride < 32 || autoStride > 128);
  const autoUsesStride = autoMethod === "scaled_templates";
  const autoUsesRoi = autoMethod !== "scaled_templates_beta";
  const autoDisablesRoiUi = autoMethod === "scaled_templates_beta";
  const scaleMinLabel = scaleMin.toFixed(2);
  const scaleMaxLabel = scaleMax.toFixed(2);

  useEffect(() => {
    if (scaleMax - scaleMin >= 0.1) return;
    const nextMax = Math.min(SCALE_RANGE_MAX, Math.round((scaleMin + 0.1) * 20) / 20);
    if (nextMax - scaleMin >= 0.1) {
      setScaleMax(nextMax);
      return;
    }
    const nextMin = Math.max(SCALE_RANGE_MIN, Math.round((scaleMax - 0.1) * 20) / 20);
    setScaleMin(nextMin);
  }, [scaleMin, scaleMax]);

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
  const importedImageCount = datasetInfo?.images?.length ?? 0;
  const importStatusText = importedImageCount > 0 ? `取込済 (${importedImageCount}枚)` : "未取込（画像なし）";
  const splitValidationMessage = useMemo(() => {
    const train = Number(splitTrain);
    const val = Number(splitVal);
    const test = Number(splitTest);
    const validNumbers = [train, val, test].every((n) => Number.isFinite(n) && n >= 0);
    if (!validNumbers) {
      return "Train / Val / Test は 0 以上の数値で入力してください。";
    }
    if (train + val + test !== 10) {
      return "Train + Val + Test の合計を 10 にしてください。";
    }
    if (!(train > val && val >= test)) {
      return "Train > Val >= Test を満たしてください。";
    }
    return null;
  }, [splitTrain, splitVal, splitTest]);
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
    if (splitValidationMessage) {
      errors.push(`Split settings: ${splitValidationMessage}`);
    }
    return errors;
  }, [classesCount, totalAnnotations, splitValidationMessage]);
  const canExport = exportErrors.length === 0;

  useEffect(() => {
    let mounted = true;
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    fetchProjects()
      .then((list: string[]) => {
        if (!mounted) return;
        setProjects(list);
        if (!project && list.length > 0 && viewState.view === "home") {
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
        const selected = project
          ? list.find((p: ProjectTemplates) => p.name === project)
          : undefined;
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
  }, [project, viewState.view]);

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
    restoredImageRef.current = false;
    void handleOpenProject(viewState.projectName);
  }, [projectList, datasetId, viewState]);

  useEffect(() => {
    if (!showHeaderSettings) return;
    const onPointerDown = (event: MouseEvent) => {
      const node = headerSettingsRef.current;
      if (!node) return;
      if (!node.contains(event.target as Node)) {
        setShowHeaderSettings(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showHeaderSettings]);

  useEffect(() => {
    if (!datasetId) {
      setShowHeaderSettings(false);
    }
  }, [datasetId]);

  useEffect(() => {
    if (!showHeaderSettings) {
      setProjectChangeUnlocked(false);
    }
  }, [showHeaderSettings]);


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
        const topDir = rel.split("/")[0];
        setLastImportPath(topDir);
        setImportPathByDataset((prev) => {
          if (!datasetId) return prev;
          const next = { ...prev, [datasetId]: topDir };
          try {
            localStorage.setItem("draftseeker.importPathByDataset", JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    }
    if (files.length === 0) return;
    const ok = window.confirm(
      `画像を取り込みます（対象: ${files.length} ファイル）。\n` +
        "この処理はプロジェクト内の画像一覧を、選択したフォルダ内容で同期します。\n" +
        "選択フォルダに含まれない既存画像と対応アノテーションは削除されます。\n" +
        "続行しますか？"
    );
    if (!ok) {
      event.target.value = "";
      return;
    }
    setError(null);
    setNotice(null);
    setDatasetImporting(true);
    try {
      const res = await importDataset({ project_name: datasetId, files });
      const info = await fetchDataset(res.project_name);
      setDatasetInfo(info);
      setImageStatusMap({});
      setDatasetSelectedName(null);
      setNotice(
        `Dataset synced: ${res.project_name} (total ${info.total_images} files, added ${res.count})`
      );
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
    if (hoverDetectTimerRef.current) {
      window.clearTimeout(hoverDetectTimerRef.current);
      hoverDetectTimerRef.current = null;
    }
    hoverLastDetectedPointRef.current = null;
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
    setFollowupScanReady(false);
    followupScanPointRef.current = null;
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
    setAutoProgressId("");
    setAutoRunning(false);
    setAutoPanelOpen(false);
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
      "テンプレートを切り替えます。\n画像データはそのまま保持されます。\nクラス定義が変わる可能性があるため、現在のアノテーション（確定/候補）とUI状態は削除され、クラス一覧を再読み込みします。\n続行しますか？"
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
      try {
        // Do not carry previous class-filter checks across template sets.
        localStorage.removeItem(`draftseeker.auto.${datasetId}`);
      } catch {
        // ignore
      }
    }
    setProject(nextProject);
    setShowCommonSettings(true);
    setAdvancedTab("classes");
    setClassCardFilter("all");
    setAutoPanelOpen(false);
    setShowDebug(false);
    try {
      const classes = await refreshTemplateStateForProject(nextProject);
      resetParamsToDefaults(classes);
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
    setShowCommonSettings(false);
    setShowDebug(false);
    setAutoPanelOpen(false);
    setShowSplitSettings(false);
    setShowExportDrawer(false);
    setLastImportPath(importPathByDataset[projectName] || null);
    setViewState((prev) =>
      prev.view === "project" && prev.projectName === projectName
        ? prev
        : { view: "project", projectName }
    );
    try {
      let templateMap = templateByDataset;
      try {
        const raw = localStorage.getItem("draftseeker.templateByDataset");
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === "object") {
          templateMap = parsed as Record<string, string>;
        }
      } catch {
        // ignore
      }
      const hasStoredTemplate = Object.prototype.hasOwnProperty.call(templateMap, projectName);
      const storedTemplate = templateMap[projectName];
      const resolvedTemplateProject = hasStoredTemplate ? (storedTemplate || "") : "";
      if (hasStoredTemplate) {
        setProject(storedTemplate || "");
      } else {
        // Never carry over previous template selection into a new/unmapped dataset.
        setProject("");
      }
      if (resolvedTemplateProject) {
        await refreshTemplateStateForProject(resolvedTemplateProject);
      } else {
        setClassOptions([]);
        setAutoClassFilter([]);
        setTemplateClassPreviews({});
        setClassScoreVisibility({});
        setClassScaleVisibility({});
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
        setColorMap((prev) => {
          const baseClasses = Object.keys(prev);
          const next: Record<string, string> = {};
          baseClasses.forEach((name) => {
            next[name] = storedColors[name] || prev[name];
          });
          return next;
        });
      } else {
        setColorMap((prev) => {
          const classes = Object.keys(prev);
          const nextColors = buildColorMapFromClasses(classes);
          saveColorMapForProject(projectName, nextColors);
          return nextColors;
        });
      }
      const storedAuto = loadAutoSettingsForProject(projectName);
      if (storedAuto) {
        if (typeof storedAuto.autoThreshold === "number") setAutoThreshold(storedAuto.autoThreshold);
        if (
          storedAuto.autoMethod === "combined" ||
          storedAuto.autoMethod === "scaled_templates" ||
          storedAuto.autoMethod === "scaled_templates_beta"
        ) {
          setAutoMethod(storedAuto.autoMethod);
        }
      }
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
    setShowHeaderSettings(false);
    setViewState({ view: "home" });
    setDatasetId(null);
    setDatasetInfo(null);
    setLastImportPath(null);
    setDatasetSelectedName(null);
    setImageStatusMap({});
    setImageId(null);
    setImageUrl(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setAnnotations([]);
    setSelectedAnnotationId(null);
    // Invalidate cached per-project annotation stats so hover popup reloads fresh data.
    setProjectStatsByName({});
    setProjectStatsLoadingName(null);
    // Refresh home project summary cards (counts/updated_at).
    void refreshProjectList();
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
      // Ensure newly created project starts from true defaults even when
      // localStorage has stale settings from a previously deleted project
      // with the same name.
      try {
        localStorage.removeItem(`draftseeker.advanced.${name}`);
        localStorage.removeItem(`draftseeker.auto.${name}`);
      } catch {
        // ignore
      }
      if (newProjectFiles && newProjectFiles.length > 0) {
        await importDataset({ project_name: name, files: Array.from(newProjectFiles) });
      }
      const nextTemplateByDataset = { ...templateByDataset, [name]: "" };
      setTemplateByDataset(nextTemplateByDataset);
      try {
        localStorage.setItem("draftseeker.templateByDataset", JSON.stringify(nextTemplateByDataset));
      } catch {
        // ignore
      }
      // Ensure a brand-new project always starts with template "unset".
      setProject("");
      setNewProjectName("");
      setNewProjectFiles(null);
      await refreshProjectList();
      await handleOpenProject(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project create failed");
    }
  };

  const handleDeleteProject = async (name: string) => {
    if (!window.confirm(`プロジェクトを削除します。\n対象: ${name}\nこの操作は取り消せません。続行しますか？`)) return;
    setError(null);
    setNotice(null);
    try {
      await deleteDatasetProject(name);
      setImportPathByDataset((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, name)) return prev;
        const next = { ...prev };
        delete next[name];
        try {
          localStorage.setItem("draftseeker.importPathByDataset", JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      if (datasetId === name) {
        setDatasetId(null);
        setDatasetInfo(null);
        setLastImportPath(null);
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

  const handleShutdownApp = async () => {
    if (!window.confirm("アプリを終了しますか？\n(バックエンドも停止します)")) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const closeFrontend = () => {
      // Hide current UI immediately to avoid looking "alive" while closing.
      try {
        document.documentElement.style.opacity = "0";
      } catch {
        // ignore
      }
      // Try to close tab first (works in limited browser contexts).
      try {
        window.open("", "_self");
        window.close();
      } catch {
        // ignore
      }
      // Ensure frontend UI is terminated even when window.close is blocked.
      window.setTimeout(() => {
        try {
          window.location.replace("about:blank");
        } catch {
          // Last resort: clear current document.
          try {
            document.body.innerHTML = "";
            document.documentElement.style.background = "#fff";
          } catch {
            // ignore
          }
        }
      }, 20);
    };
    try {
      await shutdownApp();
      setNotice("終了処理を開始しました。");
    } catch (err) {
      // Even if backend shutdown fails, frontend should still terminate.
      setError(err instanceof Error ? err.message : "Shutdown failed");
    } finally {
      closeFrontend();
      window.setTimeout(() => {
        setBusy(false);
      }, 0);
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

  const computeNextScanPoint = (fromPoint: { x: number; y: number }) => {
    if (!imageSize) return null;
    const step = Math.max(1, Math.round(roiSize * 0.5));
    const half = step / 2;
    const maxX = imageSize.w - 1;
    const maxY = imageSize.h - 1;

    let nextX = fromPoint.x + step;
    let nextY = fromPoint.y;
    if (nextX > maxX) {
      nextX = half;
      nextY += step;
    }
    if (nextY > maxY) return null;
    return {
      x: clamp(nextX, 0, maxX),
      y: clamp(nextY, 0, maxY),
    };
  };

  const handleClickPoint = async (
    x: number,
    y: number,
    opts?: { fromFollowup?: boolean; roiSizeOverride?: number }
  ) => {
    if (isCreatingManualBBox) return;
    if (manualClassMissing) return;
    if (annotationEditActiveRef.current) return;
    if (!imageId || !project) return;
    if (!opts?.fromFollowup) {
      setFollowupScanReady(false);
      followupScanPointRef.current = null;
    }
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
        roi_size: opts?.roiSizeOverride ?? roiSize,
        scale_min: scaleMin,
        scale_max: scaleMax,
        scale_steps: scaleSteps,
        class_filter: autoClassFilter,
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
        shape_ratio_threshold: shapeRatioThreshold,
      });
      setDetectDebug(res.debug || null);
      const nextCandidates = toCandidates(res);
      const best = nextCandidates[0] || null;
      setLastDetectionSnapshot({
        mode: detectionMode,
        point: { x: sendX, y: sendY },
        roiSize: opts?.roiSizeOverride ?? roiSize,
        scaleMin,
        scaleMax,
        scaleSteps,
        topk,
        shapeRatioThreshold,
        classFilter: [...autoClassFilter],
        excludeMode,
        excludeCenter,
        excludeIouThreshold,
        bestClass: best?.class_name || res.debug?.matched_class_name || "",
        bestScore:
          typeof best?.score === "number" && Number.isFinite(best.score) ? best.score : res.debug?.match_score ?? null,
        bestScale:
          typeof best?.scale === "number" && Number.isFinite(best.scale) ? best.scale : null,
        bestTemplate: best?.template || "",
        bestMatchMode: best?.match_mode || res.debug?.match_mode || "",
        matchedTemplateBase64:
          best?.template_scaled_base64 || res.debug?.matched_template_scaled_base64 || null,
      });
      setCandidates(nextCandidates);
      setSelectedCandidateId(nextCandidates.length > 0 ? nextCandidates[0].id : null);
      const nextPoint = computeNextScanPoint({ x: sendX, y: sendY });
      followupScanPointRef.current = nextPoint;
      setFollowupScanReady(Boolean(nextPoint));
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
    const createdId = `${Date.now()}-${Math.random()}`;
    const confirmedClassName = selectedCandidate.class_name;
    const confirmedScore = score;
    setAnnotations((prev) => [
      ...prev,
        {
          id: createdId,
          class_name: selectedCandidate.class_name,
          bbox: selectedCandidate.bbox,
          template_name: selectedCandidate.template || undefined,
          scale:
            typeof selectedCandidate.scale === "number" && Number.isFinite(selectedCandidate.scale)
              ? selectedCandidate.scale
              : undefined,
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
    ensureClassScoreVisibilityIncludes(confirmedClassName, confirmedScore);
    ensureClassScaleVisibilityIncludes(confirmedClassName, selectedCandidate.scale);
    allowAnnotationAutoScrollRef.current = true;
    setSelectedAnnotationId(createdId);
    const basePoint = lastClick || {
      x: selectedCandidate.bbox.x + selectedCandidate.bbox.w / 2,
      y: selectedCandidate.bbox.y + selectedCandidate.bbox.h / 2,
    };
    const nextPoint = computeNextScanPoint(basePoint);
    followupScanPointRef.current = nextPoint;
    setFollowupScanReady(Boolean(nextPoint));
    if (detectionMode === "hover") {
      setCandidates([]);
      setSelectedCandidateId(null);
      return;
    }
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

  const handlePrevCandidate = () => {
    if (candidates.length === 0) return;
    const index = selectedCandidateId
      ? candidates.findIndex((c) => c.id === selectedCandidateId)
      : -1;
    const prevIndex = index >= 0 ? (index - 1 + candidates.length) % candidates.length : candidates.length - 1;
    setSelectedCandidateId(candidates[prevIndex].id);
  };

  const cycleDebugTemplateClass = (delta: 1 | -1) => {
    if (!classOptions.length) return;
    const currentIndex = debugTemplateClass ? classOptions.indexOf(debugTemplateClass) : -1;
    const base = currentIndex >= 0 ? currentIndex : delta > 0 ? -1 : 0;
    const nextIndex = (base + delta + classOptions.length) % classOptions.length;
    const nextClass = classOptions[nextIndex];
    if (nextClass === debugTemplateClass) return;
    setDebugTemplateClass(nextClass);
    setDebugTemplateName("");
  };

  const cycleDebugTemplateName = (delta: 1 | -1) => {
    if (!debugTemplateClass || !debugTemplateItems.length) return;
    const names = debugTemplateItems.map((item) => item.name);
    const currentIndex = debugTemplateName ? names.indexOf(debugTemplateName) : -1;
    const base = currentIndex >= 0 ? currentIndex : delta > 0 ? -1 : 0;
    const nextIndex = (base + delta + names.length) % names.length;
    const nextName = names[nextIndex];
    if (!nextName || nextName === debugTemplateName) return;
    setDebugTemplateName(nextName);
  };

  const clearDetectionState = () => {
    if (hoverDetectTimerRef.current) {
      window.clearTimeout(hoverDetectTimerRef.current);
      hoverDetectTimerRef.current = null;
    }
    hoverLastDetectedPointRef.current = null;
    setSelectedCandidateId(null);
    setCandidates([]);
    setDetectDebug(null);
    setLastClick(null);
    debugParamSyncRef.current = "";
    setFollowupScanReady(false);
    followupScanPointRef.current = null;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segmentation failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const key = event.key;
      if (showDebug && debugPanelTab === "follow") {
        if (key === "i" || key === "I") {
          event.preventDefault();
          setDebugTemplateScale((prev) => Math.min(8, Math.round((prev + DEBUG_TEMPLATE_SCALE_STEP) * 100) / 100));
          return;
        }
        if (key === "o" || key === "O") {
          event.preventDefault();
          setDebugTemplateScale((prev) => Math.max(0.1, Math.round((prev - DEBUG_TEMPLATE_SCALE_STEP) * 100) / 100));
          return;
        }
        if (event.code === "ArrowUp") {
          event.preventDefault();
          cycleDebugTemplateClass(-1);
          return;
        }
        if (event.code === "ArrowDown") {
          event.preventDefault();
          cycleDebugTemplateClass(1);
          return;
        }
        if (event.code === "ArrowLeft") {
          event.preventDefault();
          cycleDebugTemplateName(-1);
          return;
        }
        if (event.code === "ArrowRight") {
          event.preventDefault();
          cycleDebugTemplateName(1);
          return;
        }
      }
      if (event.code === "ArrowDown") {
        event.preventDefault();
        setRoiSize((prev) => {
          const next = Math.max(10, prev - 10);
          const clickPoint = coordDebug?.image || detectDebug?.clicked_image_xy || lastClick;
          if (next !== prev && clickPoint && !busy && !autoRunning) {
            void handleClickPoint(clickPoint.x, clickPoint.y, { roiSizeOverride: next });
          }
          return next;
        });
        return;
      }
      if (event.code === "ArrowUp") {
        event.preventDefault();
        setRoiSize((prev) => {
          const next = Math.min(2000, prev + 10);
          const clickPoint = coordDebug?.image || detectDebug?.clicked_image_xy || lastClick;
          if (next !== prev && clickPoint && !busy && !autoRunning) {
            void handleClickPoint(clickPoint.x, clickPoint.y, { roiSizeOverride: next });
          }
          return next;
        });
        return;
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        handlePrevCandidate();
        return;
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        handleNextCandidate();
        return;
      }
      const hasActiveDetection = candidates.length > 0 || Boolean(detectDebug) || followupScanReady;
      if ((key === "Backspace" || key === "Delete" || key === "Escape") && hasActiveDetection) {
        event.preventDefault();
        clearDetectionState();
        return;
      }
      if (!selectedCandidate) return;
      if (key === "Enter") {
        event.preventDefault();
        if (!manualClassMissing) handleConfirmCandidate();
        return;
      }
      if (key === "s" || key === "S") {
        event.preventDefault();
        handleSegCandidate();
        return;
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    selectedCandidate,
    manualClassMissing,
    followupScanReady,
    showDebug,
    debugPanelTab,
    classOptions,
    debugTemplateClass,
    debugTemplateName,
    debugTemplateItems,
    debugTemplateScale,
    busy,
    autoRunning,
    candidates,
    coordDebug,
    detectDebug,
    lastClick,
  ]);

  useEffect(() => {
    if (detectionMode !== "hover" || (showDebug && debugPanelTab !== "last")) {
      if (hoverDetectTimerRef.current) {
        window.clearTimeout(hoverDetectTimerRef.current);
        hoverDetectTimerRef.current = null;
      }
      hoverLastDetectedPointRef.current = null;
    }
  }, [detectionMode, showDebug, debugPanelTab]);

  useEffect(() => {
    hoverLastDetectedPointRef.current = null;
  }, [imageId, datasetSelectedName]);

  useEffect(() => {
    if (detectionMode !== "hover" || (showDebug && debugPanelTab !== "last")) return;
    if (!coordDebug?.image || !imageId || !project || !imageSize) return;
    if (busy || autoRunning || isCreatingManualBBox || annotationEditActiveRef.current) return;

    const point = {
      x: clamp(coordDebug.image.x, 0, imageSize.w - 1),
      y: clamp(coordDebug.image.y, 0, imageSize.h - 1),
    };
    const last = hoverLastDetectedPointRef.current;
    const minDist = Math.max(0, hoverRedetectDistancePx);
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx * dx + dy * dy < minDist * minDist) return;
    }
    if (hoverDetectTimerRef.current) {
      window.clearTimeout(hoverDetectTimerRef.current);
      hoverDetectTimerRef.current = null;
    }
    hoverDetectTimerRef.current = window.setTimeout(() => {
      hoverDetectTimerRef.current = null;
      if (busy || autoRunning || isCreatingManualBBox || annotationEditActiveRef.current) return;
      hoverLastDetectedPointRef.current = point;
      void handleClickPoint(point.x, point.y);
    }, Math.max(30, Math.round(hoverDetectIntervalMs)));
    return () => {
      if (hoverDetectTimerRef.current) {
        window.clearTimeout(hoverDetectTimerRef.current);
        hoverDetectTimerRef.current = null;
      }
    };
  }, [
    detectionMode,
    showDebug,
    debugPanelTab,
    coordDebug?.image.x,
    coordDebug?.image.y,
    imageId,
    project,
    imageSize?.w,
    imageSize?.h,
    busy,
    autoRunning,
    isCreatingManualBBox,
    hoverRedetectDistancePx,
    hoverDetectIntervalMs,
  ]);

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
        setAnnotations((prev) => {
          const removed = prev.find((a) => a.id === selectedAnnotationId);
          const next = prev.filter((a) => a.id !== selectedAnnotationId);
          if (removed?.class_name) {
            syncClassScoreVisibilityForClasses(next, [removed.class_name]);
            syncClassScaleVisibilityForClasses(next, [removed.class_name]);
          }
          return next;
        });
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

  useEffect(() => {
    if (!showDebug || busy || autoRunning) return;
    const click = detectDebug?.clicked_image_xy || lastClick;
    if (!click) return;
    const debugKey = JSON.stringify({
      x: Number(click.x.toFixed(2)),
      y: Number(click.y.toFixed(2)),
      roiSize,
      scaleMin,
      scaleMax,
      scaleSteps,
      topk,
      refineContour,
      excludeEnabled,
      excludeMode,
      excludeCenter,
      excludeIouThreshold,
      shapeRatioThreshold,
      classFilter: autoClassFilter.join("|"),
    });
    if (debugParamSyncRef.current === debugKey) return;
    debugParamSyncRef.current = debugKey;
    const timer = window.setTimeout(() => {
      void handleClickPoint(click.x, click.y);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    showDebug,
    busy,
    autoRunning,
    roiSize,
    scaleMin,
    scaleMax,
    scaleSteps,
    topk,
    refineContour,
    excludeEnabled,
    excludeMode,
    excludeCenter,
    excludeIouThreshold,
    shapeRatioThreshold,
    autoClassFilter,
    detectDebug?.clicked_image_xy?.x,
    detectDebug?.clicked_image_xy?.y,
    lastClick?.x,
    lastClick?.y,
  ]);

  useEffect(() => {
    if (!showDebug) {
      debugParamSyncRef.current = "";
    }
  }, [showDebug]);

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
        shapeRatioThreshold?: number;
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
        shapeRatioThreshold,
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
        autoMethod?: AutoMethod;
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
      template_name: ann.template_name,
      scale: ann.scale,
      source:
        ann.source === "template" || ann.source === "manual" || ann.source === "sam"
          ? ann.source
          : "template",
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

  const stopAutoProgressPolling = () => {
    if (autoProgressPollRef.current !== null) {
      window.clearInterval(autoProgressPollRef.current);
      autoProgressPollRef.current = null;
    }
  };

  const startAutoProgressPolling = (progressId: string) => {
    stopAutoProgressPolling();
    let requesting = false;
    autoProgressPollRef.current = window.setInterval(async () => {
      if (requesting) return;
      requesting = true;
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 800);
        const p = await fetchAutoAnnotateProgress(progressId, controller.signal);
        window.clearTimeout(timeout);
        const next = Math.max(0, Math.min(100, Math.round(p.percent)));
        setAutoProgress(next);
        if (Array.isArray(p.class_progress) && p.class_progress.length > 0) {
          setAutoRuntimeClassProgress(
            p.class_progress.map((row) => ({
              className: row.class_name,
              confirmed: row.confirmed_count,
              preDetect: row.pre_detect_count,
            }))
          );
        }
        if (p.status === "done" || p.status === "error") {
          stopAutoProgressPolling();
        }
      } catch {
        // keep polling until main request settles
      } finally {
        requesting = false;
      }
    }, 400);
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
    setAutoRuntimeClassProgress([]);
    const progressId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setAutoProgressId(progressId);
    startAutoProgressPolling(progressId);
    const startedAt = performance.now();
    let completed = false;
    try {
      const clipped = Math.max(0, Math.min(1, autoThreshold));
      const strideValue = autoStride && autoStride > 0 ? autoStride : undefined;
      const res = await autoAnnotate({
        image_id: imageId,
        project,
        threshold: clipped,
        method: autoMethod,
        class_filter: autoClassFilter,
        scale_min: scaleMin,
        scale_max: scaleMax,
        scale_steps: scaleSteps,
        ...(autoUsesRoi ? { roi_size: roiSize } : {}),
        ...(autoUsesStride ? { stride: strideValue } : {}),
        project_name: datasetId,
        image_key: datasetSelectedName,
        progress_id: progressId,
      });
      setAutoResult({
        added: res.added_count,
        rejected: res.rejected_count,
        threshold: res.threshold,
        elapsedMs: Math.max(0, performance.now() - startedAt),
        classProgress: (res.class_progress || []).map((row) => ({
          className: row.class_name,
          confirmed: row.confirmed_count,
          preDetect: row.pre_detect_count,
        })),
      });
      if (res.created_annotations && res.created_annotations.length > 0) {
        const createdAt = new Date().toISOString();
        const appended: Annotation[] = res.created_annotations.map((item, idx) => ({
          id: `${Date.now()}-${Math.random()}-${idx}`,
          class_name: item.class_name,
          bbox: item.bbox,
          template_name: item.template_name,
          scale: item.scale,
          source: "template",
          created_at: createdAt,
          score: item.score,
        }));
        setLastAutoAddedIds(appended.map((item) => item.id));
        setAnnotations((prev) => [...prev, ...appended]);
        setClassScoreVisibility((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const ann of appended) {
            if (typeof ann.score !== "number" || !Number.isFinite(ann.score)) continue;
            const current = next[ann.class_name];
            if (typeof current !== "number") continue;
            const floorScore = Math.floor(ann.score * 100) / 100;
            if (floorScore < current) {
              next[ann.class_name] = floorScore;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
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
      });
      completed = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto annotate failed");
    } finally {
      setAutoRunning(false);
      stopAutoProgressPolling();
      setAutoProgress(completed ? 100 : 0);
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
    allowAnnotationAutoScrollRef.current = true;
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
    if (!project) {
      setTemplatePreviewBase64(null);
      return;
    }
    const candidate = candidates.find((c) => c.id === selectedCandidateId);
    const annotation = annotations.find((a) => a.id === selectedAnnotationId) || null;
    const className = candidate?.class_name || annotation?.class_name;
    const templateName = candidate?.template || annotation?.template_name;
    if (!className || !templateName) {
      setTemplatePreviewBase64(null);
      return;
    }
    const cacheKey = `${project}::${className}::${templateName}`;
    const cached = templatePreviewCacheRef.current.get(cacheKey);
    if (cached) {
      setTemplatePreviewBase64(cached);
      return;
    }
    setTemplatePreviewBase64(null);
    let cancelled = false;
    fetchTemplatePreview(project, className, templateName)
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
  }, [showDebug, selectedCandidateId, selectedAnnotationId, candidates, annotations, project]);

  useEffect(() => {
    if (!project || classOptions.length === 0) {
      setTemplateClassPreviews({});
      return;
    }
    let cancelled = false;
    fetchTemplateClassPreviews(project)
      .then((previews) => {
        if (cancelled) return;
        setTemplateClassPreviews(previews || {});
      })
      .catch(() => {
        if (!cancelled) setTemplateClassPreviews({});
      });
    return () => {
      cancelled = true;
    };
  }, [project, classOptions]);

  useEffect(() => {
    if (!showDebug) return;
    const nextClass =
      debugTemplateClass ||
      selectedCandidate?.class_name ||
      selectedAnnotation?.class_name ||
      classOptions[0] ||
      "";
    if (nextClass && nextClass !== debugTemplateClass) {
      setDebugTemplateClass(nextClass);
    }
  }, [
    showDebug,
    debugTemplateClass,
    selectedCandidate?.class_name,
    selectedAnnotation?.class_name,
    classOptions,
  ]);

  useEffect(() => {
    if (prevDebugTemplateClassRef.current && prevDebugTemplateClassRef.current !== debugTemplateClass) {
      setDebugTemplateScale(1);
    }
    prevDebugTemplateClassRef.current = debugTemplateClass;
  }, [debugTemplateClass]);

  useEffect(() => {
    if (!showDebug || !project || !debugTemplateClass) {
      setDebugTemplateItems([]);
      setDebugTemplateName("");
      return;
    }
    let cancelled = false;
    setDebugTemplateLoading(true);
    fetchTemplateClassItems(project, debugTemplateClass)
      .then((items) => {
        if (cancelled) return;
        setDebugTemplateItems(items);
        if (!items.some((it) => it.name === debugTemplateName)) {
          setDebugTemplateName(items[0]?.name || "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDebugTemplateItems([]);
          setDebugTemplateName("");
        }
      })
      .finally(() => {
        if (!cancelled) setDebugTemplateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showDebug, project, debugTemplateClass, debugTemplateName]);

  const openTemplateGallery = async (className: string) => {
    if (!project) return;
    setTemplateGalleryOpen(true);
    setTemplateGalleryPreviewName(null);
    setTemplateGalleryPreviewNaturalSize(null);
    setTemplateGalleryClassName(className);
    setTemplateGalleryItems([]);
    setTemplateGalleryLoading(true);
    try {
      const items = await fetchTemplateClassItems(project, className);
      setTemplateGalleryItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template list fetch failed");
      setTemplateGalleryOpen(false);
    } finally {
      setTemplateGalleryLoading(false);
    }
  };
  const closeTemplatePreview = () => {
    setTemplateGalleryPreviewName(null);
    setTemplateGalleryPreviewNaturalSize(null);
  };
  const moveTemplatePreview = (delta: 1 | -1) => {
    const currentName = templateGalleryPreviewNameRef.current;
    if (!currentName || templateGalleryItems.length === 0) return;
    const currentIndex = templateGalleryItems.findIndex((item) => item.name === currentName);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + delta + templateGalleryItems.length) % templateGalleryItems.length;
    const next = templateGalleryItems[nextIndex];
    if (!next || next.name === currentName) return;
    setTemplateGalleryPreviewName(next.name);
    setTemplateGalleryPreviewNaturalSize(null);
  };
  const stopTemplatePreviewRepeat = () => {
    if (templatePreviewRepeatTimerRef.current !== null) {
      window.clearInterval(templatePreviewRepeatTimerRef.current);
      templatePreviewRepeatTimerRef.current = null;
    }
  };
  const startTemplatePreviewRepeat = (delta: 1 | -1) => {
    stopTemplatePreviewRepeat();
    moveTemplatePreview(delta);
    templatePreviewRepeatTimerRef.current = window.setInterval(() => {
      moveTemplatePreview(delta);
    }, 70);
  };
  const closeTemplateGallery = () => {
    stopTemplatePreviewRepeat();
    closeTemplatePreview();
    setTemplateGalleryOpen(false);
  };

  useEffect(() => {
    if (!selectedAnnotationId) return;
    if (!allowAnnotationAutoScrollRef.current) return;
    const list = confirmedListRef.current;
    const el = annotationRowRefs.current[selectedAnnotationId];
    if (!list || !el) return;
    const listRect = list.getBoundingClientRect();
    const rowRect = el.getBoundingClientRect();
    const pad = 8;
    if (rowRect.top < listRect.top) {
      list.scrollTop += rowRect.top - listRect.top - pad;
    } else if (rowRect.bottom > listRect.bottom) {
      list.scrollTop += rowRect.bottom - listRect.bottom + pad;
    }
    allowAnnotationAutoScrollRef.current = false;
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
    if (viewState.view !== "home") {
      if (hoverProjectStatsTimerRef.current !== null) {
        window.clearTimeout(hoverProjectStatsTimerRef.current);
        hoverProjectStatsTimerRef.current = null;
      }
      setHoverProjectStatsAnchor(null);
      setProjectStatsPopupPos(null);
    }
  }, [viewState.view]);

  useEffect(() => {
    setProjectStatsPopupPos(null);
  }, [hoverProjectStatsAnchor?.projectName]);

  useEffect(() => {
    templateGalleryPreviewNameRef.current = templateGalleryPreviewName;
  }, [templateGalleryPreviewName]);

  useEffect(() => {
    const onStop = () => stopTemplatePreviewRepeat();
    window.addEventListener("pointerup", onStop);
    window.addEventListener("blur", onStop);
    return () => {
      window.removeEventListener("pointerup", onStop);
      window.removeEventListener("blur", onStop);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopTemplatePreviewRepeat();
      if (hoverProjectStatsTimerRef.current !== null) {
        window.clearTimeout(hoverProjectStatsTimerRef.current);
        hoverProjectStatsTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!datasetId || !datasetInfo) return;
    if (viewState.view !== "project" || viewState.projectName !== datasetId) return;
    if (restoredImageRef.current) return;
    const key = viewState.lastImageKey;
    if (!key || !key.startsWith(`${datasetId}::`)) {
      restoredImageRef.current = true;
      return;
    }
    const filename = key.slice(`${datasetId}::`.length);
    const exists = datasetInfo.images?.some(
      (img) => (img.original_filename || img.filename) === filename
    );
    restoredImageRef.current = true;
    if (!exists) return;
    if (datasetSelectedName === filename) return;
    void loadDatasetImage(datasetId, filename);
  }, [datasetId, datasetInfo, viewState, datasetSelectedName]);

  useEffect(() => {
    if (!notice) return;
    setNoticeVisible(true);
    const timer = window.setTimeout(() => {
      setNoticeVisible(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    try {
      localStorage.setItem("draftseeker:leftFilter:v1", leftFilter);
    } catch {
      // ignore
    }
  }, [leftFilter]);

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
      shapeRatioThreshold:
        typeof saved?.shapeRatioThreshold === "number"
          ? saved.shapeRatioThreshold
          : DEFAULT_SHAPE_RATIO_THRESHOLD,
      scaleMin: typeof saved?.scaleMin === "number" ? saved.scaleMin : DEFAULT_SCALE_MIN,
      scaleMax:
        typeof saved?.scaleMax === "number"
          ? Math.min(saved.scaleMax, DEFAULT_SCALE_MAX)
          : DEFAULT_SCALE_MAX,
      scaleSteps:
        typeof saved?.scaleSteps === "number" ? saved.scaleSteps : DEFAULT_SCALE_STEPS,
      excludeEnabled:
        typeof saved?.excludeEnabled === "boolean"
          ? saved.excludeEnabled
          : DEFAULT_EXCLUDE_ENABLED,
      excludeMode:
        saved?.excludeMode === "same_class" || saved?.excludeMode === "any_class"
          ? saved.excludeMode
          : DEFAULT_EXCLUDE_MODE,
      excludeCenter:
        typeof saved?.excludeCenter === "boolean"
          ? saved.excludeCenter
          : DEFAULT_EXCLUDE_CENTER,
      excludeIouThreshold:
        typeof saved?.excludeIouThreshold === "number"
          ? saved.excludeIouThreshold
          : DEFAULT_EXCLUDE_IOU_THRESHOLD,
      refineContour:
        typeof saved?.refineContour === "boolean" ? saved.refineContour : DEFAULT_REFINE_CONTOUR,
    };
    setAdvancedBaseline(baseline);
    setRoiSize(baseline.roiSize);
    setTopk(baseline.topk);
    setShapeRatioThreshold(baseline.shapeRatioThreshold);
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
    const hasSavedClassFilter = Array.isArray(saved?.autoClassFilter);
    const savedMethod: AutoMethod =
      saved?.autoMethod === "combined" ||
      saved?.autoMethod === "scaled_templates" ||
      saved?.autoMethod === "scaled_templates_beta"
        ? saved.autoMethod
        : DEFAULT_AUTO_METHOD;
    const baseline = {
      autoThreshold:
        typeof saved?.autoThreshold === "number"
          ? saved.autoThreshold
          : DEFAULT_AUTO_THRESHOLD_BY_METHOD[savedMethod],
      autoMethod: savedMethod,
      autoClassFilter: hasSavedClassFilter ? (saved?.autoClassFilter ?? []) : classOptions,
      autoStride: null,
    };
    setAutoBaseline(baseline);
    setAutoThreshold(baseline.autoThreshold);
    setAutoMethod(baseline.autoMethod);
    setAutoClassFilter(baseline.autoClassFilter);
    setAutoStride(baseline.autoStride);
  }, [datasetId, classOptions]);

  useEffect(() => {
    if (!datasetId) return;
    saveAdvancedSettingsForProject(datasetId);
  }, [
    datasetId,
    roiSize,
    topk,
    shapeRatioThreshold,
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
      stopAutoProgressPolling();
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

  useEffect(() => {
    if (viewState.view !== "home") return;
    try {
      const raw = localStorage.getItem(HOME_PREREQ_SHOW_ON_STARTUP_KEY);
      let enabled = true;
      if (raw === "0" || raw === "1") {
        enabled = raw === "1";
      } else {
        // Backward compatibility: old key "seen=1" meant disabled.
        const seen = localStorage.getItem(HOME_PREREQ_SEEN_KEY) === "1";
        enabled = !seen;
      }
      setShowHomePrereqOnStartup(enabled);
      const autoShownInSession = sessionStorage.getItem(HOME_PREREQ_AUTO_SHOWN_SESSION_KEY) === "1";
      if (enabled && !autoShownInSession) {
        setShowHomePrereqModal(true);
        sessionStorage.setItem(HOME_PREREQ_AUTO_SHOWN_SESSION_KEY, "1");
      }
    } catch {
      setShowHomePrereqOnStartup(true);
      const autoShownInSession = sessionStorage.getItem(HOME_PREREQ_AUTO_SHOWN_SESSION_KEY) === "1";
      if (!autoShownInSession) {
        setShowHomePrereqModal(true);
        sessionStorage.setItem(HOME_PREREQ_AUTO_SHOWN_SESSION_KEY, "1");
      }
    }
  }, [viewState.view]);

  const closeHomePrereqModal = () => {
    setShowHomePrereqModal(false);
  };

  const autoProgressClamped = Math.max(0, Math.min(100, autoProgress));
  const templateClassCountMap = useMemo(() => {
    const selected = templateProjects.find((p) => p.name === project);
    const map: Record<string, number> = {};
    if (!selected) return map;
    for (const row of selected.classes || []) {
      map[row.class_name] = Math.max(0, Number(row.count) || 0);
    }
    return map;
  }, [templateProjects, project]);
  const autoOverlaySeriesRows = useMemo(() => {
    if (autoRunning) {
      if (autoRuntimeClassProgress.length > 0) {
        const activeRows = autoRuntimeClassProgress
          .filter((row) => row.preDetect > 0 || row.confirmed > 0)
          .sort(
            (a, b) =>
              b.preDetect - a.preDetect ||
              b.confirmed - a.confirmed ||
              a.className.localeCompare(b.className)
          );
        if (activeRows.length > 0) return activeRows.slice(0, 3);
        return autoRuntimeClassProgress.slice(0, 3);
      }
      return detectionTargetClasses.slice(0, 3).map((className) => ({
        className,
        confirmed: 0,
        preDetect: 0,
      }));
    }
    if (autoResult?.classProgress && autoResult.classProgress.length > 0) {
      return [...autoResult.classProgress]
        .sort(
          (a, b) =>
            b.preDetect - a.preDetect ||
            b.confirmed - a.confirmed ||
            a.className.localeCompare(b.className)
        )
        .slice(0, 3);
    }
    const ratio = autoProgressClamped / 100;
    return detectionTargetClasses.slice(0, 3).map((className) => {
      const total = Math.max(0, templateClassCountMap[className] || 0);
      const estimated = Math.min(total, Math.floor(total * ratio));
      return {
        className,
        confirmed: estimated,
        preDetect: total,
      };
    });
  }, [autoRunning, autoRuntimeClassProgress, autoResult, detectionTargetClasses, autoProgressClamped, templateClassCountMap]);

  return (
    <div
      className="appRoot"
      style={{
        fontFamily: "\"IBM Plex Sans\", system-ui, sans-serif",
        minHeight: "100vh",
        height: "100dvh",
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
        @keyframes autoCloudSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes autoCloudDotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-1px); }
        }
        @keyframes autoCloudStripeMove {
          from { background-position: 0 0; }
          to { background-position: 28px 0; }
        }
        .autoCloudCard {
          width: min(100%, 380px);
          min-width: 0;
          max-width: calc(100% - 16px);
          border-radius: 14px;
          border: 1px solid rgba(16, 45, 86, 0.22);
          background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(240,246,255,0.95) 100%);
          box-shadow: 0 10px 24px rgba(6, 23, 52, 0.16);
          padding: 10px 11px;
          display: grid;
          gap: 8px;
          align-content: start;
          font-family: "IBM Plex Sans", system-ui, sans-serif;
          color: #0b1f3a;
          box-sizing: border-box;
          overflow: hidden;
        }
        .autoCloudLayout {
          display: grid;
          grid-template-columns: 138px minmax(0, 1fr);
          align-items: start;
          gap: 10px;
          min-width: 0;
        }
        .autoCloudDonutWrap {
          position: relative;
          width: 138px;
          height: 138px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }
        .autoCloudDonutCenter {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          pointer-events: none;
        }
        .autoCloudDonutLabel {
          text-align: center;
          color: #102d56;
          white-space: nowrap;
        }
        .autoCloudDonutLabelSmall {
          font-size: 10px;
          font-weight: 700;
          line-height: 1.1;
          opacity: 0.85;
        }
        .autoCloudDonutLabelBig {
          margin-top: 1px;
          font-size: 28px;
          line-height: 1;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .autoCloudMain {
          min-width: 0;
          display: grid;
          gap: 5px;
        }
        .autoCloudHead {
          display: flex;
          align-items: baseline;
          justify-content: flex-start;
          gap: 6px;
        }
        .autoCloudTitle {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.1px;
          color: #102d56;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .autoCloudRing {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(34, 105, 198, 0.25);
          border-top-color: #1f66d1;
          border-radius: 50%;
          animation: autoCloudSpin 1s linear infinite;
        }
        .autoCloudMode {
          font-size: 11px;
          font-weight: 700;
          color: #2457a6;
          background: rgba(36, 87, 166, 0.1);
          border: 1px solid rgba(36, 87, 166, 0.22);
          border-radius: 999px;
          padding: 2px 8px;
          white-space: nowrap;
          width: fit-content;
        }
        .autoCloudStatus {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #395d89;
          font-weight: 600;
          white-space: nowrap;
        }
        .autoCloudDots span {
          display: inline-block;
          animation: autoCloudDotPulse 1s ease-in-out infinite;
        }
        .autoCloudDots span:nth-child(2) { animation-delay: 0.15s; }
        .autoCloudDots span:nth-child(3) { animation-delay: 0.3s; }
        .autoCloudSeries {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .autoCloudProgressId {
          font-size: 10px;
          color: #46658f;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .autoCloudSeriesRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: baseline;
          gap: 8px;
          color: #183863;
        }
        .autoCloudSeriesName {
          font-size: 15px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .autoCloudSeriesCount {
          font-size: 15px;
          font-weight: 700;
          color: #0f2d58;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 108px;
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
          scrollbar-gutter: stable both-edges;
          overscroll-behavior: contain;
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
          max-height: none;
          padding-right: 4px;
          padding: 8px;
          border-radius: 10px;
          background: #f4f8ff;
          border: 1px solid #dbe6f7;
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
          flex-wrap: nowrap;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          width: 100%;
          min-width: 0;
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
        .dualRangeInput {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 100%;
          margin: 0;
          background: transparent;
          pointer-events: none;
          position: absolute;
          inset: 0;
        }
        .dualRangeInput::-webkit-slider-runnable-track {
          height: 3px;
          background: transparent;
        }
        .dualRangeInput::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 5px;
          background:
            radial-gradient(circle at center, #ffffff 0 2px, transparent 2px),
            linear-gradient(180deg, #dbe2ea 0%, #8f99a6 100%);
          border: 1px solid #ffffff;
          box-shadow: 0 1px 4px rgba(48, 56, 68, 0.28), 0 0 0 1px rgba(118, 129, 146, 0.35);
          margin-top: -10px;
          pointer-events: auto;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .dualRangeInput::-moz-range-track {
          height: 3px;
          background: transparent;
        }
        .dualRangeInput::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 5px;
          background:
            radial-gradient(circle at center, #ffffff 0 2px, transparent 2px),
            linear-gradient(180deg, #dbe2ea 0%, #8f99a6 100%);
          border: 1px solid #ffffff;
          box-shadow: 0 1px 4px rgba(48, 56, 68, 0.28), 0 0 0 1px rgba(118, 129, 146, 0.35);
          transform: translateY(-4px);
          pointer-events: auto;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .dualRangeInput:active::-webkit-slider-thumb {
          transform: scale(1.06);
          box-shadow: 0 2px 6px rgba(48, 56, 68, 0.36), 0 0 0 2px rgba(118, 129, 146, 0.38);
        }
        .dualRangeInput:active::-moz-range-thumb {
          transform: scale(1.06);
          box-shadow: 0 2px 6px rgba(48, 56, 68, 0.36), 0 0 0 2px rgba(118, 129, 146, 0.38);
        }
        .paramSlider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(238,241,245,0.95));
          border: 1px solid rgba(183, 191, 202, 0.55);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(120,130,145,0.14);
        }
        .paramSlider::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(176, 183, 194, 0.65), rgba(129, 139, 153, 0.82));
        }
        .paramSlider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          margin-top: -5px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.95);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0 20%, rgba(255,255,255,0) 45%),
            linear-gradient(180deg, #d9e0e8 0%, #8f98a5 100%);
          box-shadow: 0 2px 6px rgba(57, 66, 79, 0.28), 0 0 0 1px rgba(132, 141, 154, 0.24);
          cursor: pointer;
        }
        .paramSlider::-moz-range-track {
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(176, 183, 194, 0.65), rgba(129, 139, 153, 0.82));
          border: 1px solid rgba(183, 191, 202, 0.55);
        }
        .paramSlider::-moz-range-progress {
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(152, 161, 174, 0.75), rgba(116, 126, 140, 0.9));
        }
        .paramSlider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.95);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0 20%, rgba(255,255,255,0) 45%),
            linear-gradient(180deg, #d9e0e8 0%, #8f98a5 100%);
          box-shadow: 0 2px 6px rgba(57, 66, 79, 0.28), 0 0 0 1px rgba(132, 141, 154, 0.24);
          cursor: pointer;
        }
        .classScoreSlider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(235,244,255,0.9));
          border: 1px solid rgba(153, 183, 227, 0.6);
          box-shadow:
            inset 0 1px 2px rgba(255,255,255,0.85),
            inset 0 -1px 2px rgba(84,126,201,0.15),
            0 1px 2px rgba(41, 78, 146, 0.12);
        }
        .classScoreSlider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(80,140,255,0.25), rgba(80,140,255,0.72));
        }
        .classScoreSlider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          margin-top: -6px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.95);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0 20%, rgba(255,255,255,0) 45%),
            linear-gradient(180deg, #7fb5ff 0%, #2b74ff 100%);
          box-shadow: 0 3px 8px rgba(32, 67, 140, 0.35), 0 0 0 1px rgba(43,116,255,0.2);
          cursor: pointer;
        }
        .classScoreSlider::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(80,140,255,0.25), rgba(80,140,255,0.72));
          border: 1px solid rgba(153, 183, 227, 0.6);
        }
        .classScoreSlider::-moz-range-progress {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(80,140,255,0.45), rgba(80,140,255,0.85));
        }
        .classScoreSlider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.95);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0 20%, rgba(255,255,255,0) 45%),
            linear-gradient(180deg, #7fb5ff 0%, #2b74ff 100%);
          box-shadow: 0 3px 8px rgba(32, 67, 140, 0.35), 0 0 0 1px rgba(43,116,255,0.2);
          cursor: pointer;
        }
        .classScaleSlider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(237,250,248,0.92));
          border: 1px solid rgba(132, 188, 176, 0.62);
          box-shadow:
            inset 0 1px 2px rgba(255,255,255,0.86),
            inset 0 -1px 2px rgba(44, 122, 108, 0.15),
            0 1px 2px rgba(27, 92, 82, 0.12);
        }
        .classScaleSlider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(38, 166, 154, 0.28), rgba(38, 166, 154, 0.75));
        }
        .classScaleSlider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          margin-top: -6px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.95);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0 20%, rgba(255,255,255,0) 45%),
            linear-gradient(180deg, #64d8cb 0%, #26a69a 100%);
          box-shadow: 0 3px 8px rgba(17, 86, 76, 0.32), 0 0 0 1px rgba(38,166,154,0.2);
          cursor: pointer;
        }
        .classScaleSlider::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(38, 166, 154, 0.28), rgba(38, 166, 154, 0.75));
          border: 1px solid rgba(132, 188, 176, 0.62);
        }
        .classScaleSlider::-moz-range-progress {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(38, 166, 154, 0.45), rgba(38, 166, 154, 0.9));
        }
        .classScaleSlider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.95);
          background:
            radial-gradient(circle at 34% 30%, rgba(255,255,255,0.95) 0 20%, rgba(255,255,255,0) 45%),
            linear-gradient(180deg, #64d8cb 0%, #26a69a 100%);
          box-shadow: 0 3px 8px rgba(17, 86, 76, 0.32), 0 0 0 1px rgba(38,166,154,0.2);
          cursor: pointer;
        }
        .rightPanel .numInput {
          text-align: center;
        }
        .rightPanel .midInput {
          width: 120px !important;
          max-width: 120px !important;
          text-align: center;
        }
        .rightPanel .stepBtn {
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
          position: relative;
        }
        .rightPanel .autoAdvanced .autoMethodHelp {
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .rightPanel .autoAdvanced .autoMethodTooltip {
          position: absolute;
          left: 12px;
          right: 12px;
          top: calc(100% + 6px);
          z-index: 30;
          display: none;
          pointer-events: none;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #c6d6ef;
          background: rgba(255, 255, 255, 0.98);
          color: #243f63;
          font-size: 11px;
          line-height: 1.4;
          white-space: normal;
          overflow-wrap: anywhere;
          box-shadow: 0 8px 18px rgba(18, 35, 61, 0.16);
        }
        .rightPanel .autoAdvanced .autoMethodCard:hover .autoMethodTooltip,
        .rightPanel .autoAdvanced .autoMethodCard:focus-within .autoMethodTooltip {
          display: block;
        }
        .noWrapRow {
          flex-wrap: nowrap !important;
          gap: 6px;
        }
      `}</style>
      <div
        className="topBar"
        style={{
          padding: "4px 20px",
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
              style={{ height: 52, width: "auto", display: "block" }}
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
              <div ref={headerSettingsRef} style={{ position: "relative" }}>
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
                  onClick={() => setShowHeaderSettings((prev) => !prev)}
                  style={{
                    width: 44,
                    height: 44,
                    padding: 0,
                    fontSize: 31,
                    lineHeight: 1,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#35506b",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="総合設定"
                  title="総合設定"
                >
                  ⚙
                </button>
                {showHeaderSettings && (
                  <div
                    style={{
                      position: "absolute",
                      top: 36,
                      right: 0,
                      width: 280,
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--panel)",
                      boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
                      padding: 10,
                      display: "grid",
                      gap: 10,
                      zIndex: 40,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!exportOutputDir.trim()) {
                          setExportOutputDir("");
                        }
                        setExportResult(null);
                        setShowExportDrawer(true);
                        setShowHeaderSettings(false);
                      }}
                      className="btn btnSecondary"
                      style={{ height: 30, padding: "0 10px", justifyContent: "flex-start" }}
                    >
                      Export dataset
                    </button>

                    <div
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 8,
                        display: "grid",
                        gap: 6,
                        background: "var(--panel2)",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#566" }}>テンプレート</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <select
                          value={project}
                          onChange={(e) => handleProjectTemplateChange(e.target.value)}
                          disabled={!projectChangeUnlocked}
                          style={{
                            minWidth: 0,
                            flex: 1,
                            height: 28,
                            fontSize: 11,
                            opacity: projectChangeUnlocked ? 1 : 0.6,
                            cursor: projectChangeUnlocked ? "pointer" : "not-allowed",
                          }}
                        >
                          {showUnsetTemplateOption && (
                            <option key="project-unset" value="">
                              未設定
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
                          title={projectChangeUnlocked ? "開錠中: クリックで施錠" : "施錠中: クリックで開錠"}
                          style={{
                            height: 30,
                            minWidth: 64,
                            padding: "0 8px",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: 0.4,
                            color: "#0c2205",
                            borderColor: projectChangeUnlocked ? "#39ff14" : "#7ea76f",
                            background: projectChangeUnlocked ? "#eaffea" : "#f6fbf4",
                            boxShadow: projectChangeUnlocked
                              ? "inset 0 0 0 1px rgba(57,255,20,0.45), 0 0 10px rgba(57,255,20,0.35)"
                              : "inset 0 0 0 1px rgba(0,0,0,0.2)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                          }}
                          onClick={() => {
                            if (projects.length === 0) {
                              setNotice("テンプレートがありません");
                              return;
                            }
                            setProjectChangeUnlocked((prev) => !prev);
                          }}
                        >
                          <TemplateLockIcon unlocked={projectChangeUnlocked} />
                          <span>{projectChangeUnlocked ? "OPEN" : "LOCK"}</span>
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #e3e3e3",
                        borderRadius: 8,
                        padding: 8,
                        display: "grid",
                        gap: 6,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => folderInputRef.current?.click()}
                          disabled={!datasetId}
                          className="btn btnSecondary"
                          style={{
                            height: 28,
                            padding: "0 8px",
                            fontSize: 11,
                            cursor: datasetId ? "pointer" : "not-allowed",
                            opacity: datasetId ? 1 : 0.6,
                          }}
                        >
                          画像取り込み
                        </button>
                        <span style={{ fontSize: 11, color: "#666" }}>{importStatusText}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "#8a8a8a" }}>
                        取込元ディレクトリ: {lastImportPath || "-"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {viewState.view === "home" && (
              <button
                type="button"
                onClick={handleShutdownApp}
                className="btn btnDanger"
                style={{ height: 32, padding: "0 12px", fontSize: 12 }}
              >
                アプリ終了
              </button>
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
      {viewState.view === "home" && (
        <button
          type="button"
          onClick={() => setShowHomePrereqModal(true)}
          title="図面探索の前提条件を表示"
          aria-label="図面探索の前提条件を表示"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "1px solid rgba(53,116,255,0.5)",
            background: "linear-gradient(180deg, #f4f8ff 0%, #dfe9ff 100%)",
            color: "#1f4fbf",
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1,
            cursor: "pointer",
            zIndex: 35,
            boxShadow: "0 8px 22px rgba(31, 79, 191, 0.26)",
          }}
        >
          i
        </button>
      )}
      {showHomePrereqModal && viewState.view === "home" && (
        <>
          <div
            onClick={closeHomePrereqModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(8, 17, 31, 0.34)",
              zIndex: 60,
            }}
          />
          <div
            className="panelShell"
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(760px, calc(100vw - 24px))",
              maxHeight: "min(80vh, calc(100vh - 40px))",
              zIndex: 61,
              overflow: "auto",
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#12385f" }}>図面探索の前提条件（最低条件）</div>
              <button
                type="button"
                onClick={closeHomePrereqModal}
                className="btn btnGhost"
                style={{ width: 30, height: 30, padding: 0, fontSize: 18, boxShadow: "none" }}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#2f4668", lineHeight: 1.55, display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: "#12385f" }}>1. 画像条件</div>
                <div>線品質: 主線が連続し、欠け・かすれが少ないこと。</div>
                <div>解像度: 対象の最細線が最低1.5px程度は確保されること。</div>
                <div>2値特性: 白背景/黒線に近い分布で、濃淡むらやJPEGブロックノイズが強すぎないこと。</div>
                <div>幾何差: 回転・せん断・透視歪みが小さいこと（本実装は主に平行移動+スケール前提）。</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#12385f" }}>2. テンプレ条件</div>
                <div>切り出し: 対象形状を過不足なく含み、余白は最小限。</div>
                <div>識別性: クラス間で似すぎたテンプレートを増やしすぎないこと。</div>
                <div>一貫性: 同クラス内で線種・太さ・記法のばらつきが極端でないこと。</div>
                <div>サイズ帯: 実画像での出現倍率が scale_min～scale_max に収まること。</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#12385f" }}>3. パラメータ条件</div>
                <div>scale_min / scale_max / scale_steps は出現倍率帯を過不足なくカバーすること。</div>
                <div>閾値はモード別に管理（Fusion: 再現率寄り / Expand: バランス / Global Precision: 高閾値寄り）。</div>
                <div>Global Precision は 0.8 以上を推奨。Fusion/Expand では ROI が対象を十分含むサイズであること。</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#12385f" }}>4. データ分布条件</div>
                <div>余白量の一貫性: 特に Global Precision は余白面積の影響を強く受けます。</div>
                <div>ノイズ環境の一貫性: 影・汚れ・罫線密度が急変すると閾値最適点がずれます。</div>
                <div>クラス頻度の偏り: 極端な不均衡は誤検出・見逃しの偏りを増やします。</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#12385f" }}>5. 運用条件</div>
                <div>モード運用: 初期探索=Fusion / 通常運用=Expand / 最終高精度=Global Precision。</div>
                <div>代表セット評価: 本番前に precision / recall / 処理時間を固定計測すること。</div>
                <div>閾値管理: 図面タイプ単位でプリセット化（全案件一律閾値は非推奨）。</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#12385f" }}>6. 余白で性能が落ちる理由（本件）</div>
                <div>全域探索では画素数に比例して偶然一致候補が増え、誤検出が増加します。</div>
                <div>候補競合が増えると NMS で真候補が落ちることがあり、検出漏れにつながります。</div>
                <div>つまり余白あり画像はスコア分布が変わるため、同一閾値でも性能が崩れやすくなります。</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#12385f" }}>7. 最低限の改善策（優先順）</div>
                <div>1) 前処理で有効領域クロップ（白余白除去）</div>
                <div>2) 余白率に応じた閾値補正</div>
                <div>3) クラス別上位候補数制限 + 後段再評価</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2f4668" }}>
                <input
                  type="checkbox"
                  checked={showHomePrereqOnStartup}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setShowHomePrereqOnStartup(next);
                    try {
                      localStorage.setItem(HOME_PREREQ_SHOW_ON_STARTUP_KEY, next ? "1" : "0");
                    } catch {
                      // ignore storage errors
                    }
                  }}
                />
                次回起動時に表示する
              </label>
              <button
                type="button"
                onClick={closeHomePrereqModal}
                className="btn btnPrimary"
                style={{ height: 34, padding: "0 14px" }}
              >
                閉じる
              </button>
            </div>
          </div>
        </>
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
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 50px)",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <label style={{ display: "grid", gap: 4, width: 50 }}>
                        <span style={{ fontSize: 13, color: "#666", textAlign: "center" }}>Train</span>
                        <input
                          type="number"
                          min={0}
                          value={splitTrain}
                          onChange={(e) => setSplitTrain(Number(e.target.value))}
                          className="inputCompact"
                          style={{ width: 50, height: 30, padding: "0 6px", borderRadius: 8, border: "1px solid var(--border)", textAlign: "right", background: "#fff", fontSize: 15 }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 4, width: 50 }}>
                        <span style={{ fontSize: 13, color: "#666", textAlign: "center" }}>Val</span>
                        <input
                          type="number"
                          min={0}
                          value={splitVal}
                          onChange={(e) => setSplitVal(Number(e.target.value))}
                          className="inputCompact"
                          style={{ width: 50, height: 30, padding: "0 6px", borderRadius: 8, border: "1px solid var(--border)", textAlign: "right", background: "#fff", fontSize: 15 }}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 4, width: 50 }}>
                        <span style={{ fontSize: 13, color: "#666", textAlign: "center" }}>Test</span>
                        <input
                          type="number"
                          min={0}
                          value={splitTest}
                          onChange={(e) => setSplitTest(Number(e.target.value))}
                          className="inputCompact"
                          style={{ width: 50, height: 30, padding: "0 6px", borderRadius: 8, border: "1px solid var(--border)", textAlign: "right", background: "#fff", fontSize: 15 }}
                        />
                      </label>
                    </div>
                    {splitValidationMessage && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#c62828", fontWeight: 600 }}>
                        {splitValidationMessage}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                      <span style={{ fontSize: 11, color: "#666" }}>Seed</span>
                      <input
                        type="number"
                        value={splitSeed}
                        onChange={(e) => setSplitSeed(Number(e.target.value))}
                        className="inputMid"
                        style={{ width: 70, height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--border)", textAlign: "right", fontSize: 15 }}
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

      {templateGalleryOpen && (
        <>
          <div
            onClick={closeTemplateGallery}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(18, 28, 45, 0.28)",
              backdropFilter: "blur(8px)",
              zIndex: 70,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "8vh",
              left: "6vw",
              width: "88vw",
              height: "84vh",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.22)",
              boxShadow: "0 18px 48px rgba(9, 18, 34, 0.30)",
              backdropFilter: "blur(14px) saturate(120%)",
              zIndex: 80,
              display: "grid",
              gridTemplateRows: "auto 1fr",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.18)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: templateGalleryTextColor }}>
                テンプレート一覧: {templateGalleryClassName}
              </div>
              <button
                type="button"
                onClick={closeTemplateGallery}
                className="btn btnGhost"
                style={{
                  height: 30,
                  padding: "0 10px",
                  color: templateGalleryTextColor,
                  borderColor: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.12)",
                }}
              >
                閉じる
              </button>
            </div>
            <div style={{ padding: 14, overflowY: "auto" }}>
              {templateGalleryLoading ? (
                <div style={{ color: templateGalleryTextColor, fontSize: 13 }}>読み込み中...</div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: 10,
                  }}
                >
                  {templateGalleryItems.map((item, idx) => (
                    <div
                      key={`${item.name}-${idx}`}
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.42)",
                        background: "rgba(255,255,255,0.16)",
                        backdropFilter: "blur(8px)",
                        padding: 8,
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.5)",
                          background: "rgba(255,255,255,0.14)",
                        }}
                      >
                        <img
                          src={buildTemplateImageUrl(project, templateGalleryClassName, item.name)}
                          alt={item.name}
                          onClick={() => {
                            setTemplateGalleryPreviewName(item.name);
                            setTemplateGalleryPreviewNaturalSize(null);
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            opacity: 0.82,
                            filter: "contrast(1.05)",
                            cursor: "zoom-in",
                          }}
                        />
                      </div>
                      <div style={{ display: "grid", gap: 2, color: templateGalleryTextColor }}>
                        <div
                          title={item.name}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {item.width > 0 && item.height > 0
                            ? `W x H : ${item.width}px X ${item.height}px`
                            : "W x H : -"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!templateGalleryLoading && templateGalleryItems.length === 0 && (
                    <div style={{ color: templateGalleryTextColor, fontSize: 12 }}>
                      テンプレートがありません。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {templateGalleryPreviewName && (
            <>
              <div
                onClick={closeTemplatePreview}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(8, 14, 26, 0.48)",
                  backdropFilter: "blur(4px)",
                  zIndex: 90,
                }}
              />
              <div
                style={{
                  position: "fixed",
                  inset: "8vh 8vw",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.14)",
                  boxShadow: "0 16px 36px rgba(8, 18, 32, 0.4)",
                  backdropFilter: "blur(10px)",
                  zIndex: 91,
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "10px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.35)",
                    color: templateGalleryPreviewTextColor,
                  }}
                >
                  <span
                    title={templateGalleryPreviewName}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {templateGalleryPreviewName}
                  </span>
                  <button
                    type="button"
                    className="btn btnGhost"
                    onClick={closeTemplatePreview}
                    style={{
                      height: 28,
                      padding: "0 10px",
                      color: templateGalleryPreviewTextColor,
                      borderColor: "rgba(255,255,255,0.5)",
                      background: "rgba(255,255,255,0.12)",
                      boxShadow: "none",
                    }}
                  >
                    閉じる
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 14,
                    minHeight: 0,
                    position: "relative",
                  }}
                >
                  <img
                    src={buildTemplateBinaryImageUrl(project, templateGalleryClassName, templateGalleryPreviewName)}
                    alt={templateGalleryPreviewName}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setTemplateGalleryPreviewNaturalSize({
                        w: img.naturalWidth || 0,
                        h: img.naturalHeight || 0,
                      });
                    }}
                    style={{
                      width: previewImageBoostStyle.width,
                      height: previewImageBoostStyle.height,
                      maxWidth: "100%",
                      maxHeight: "100%",
                      opacity: 0.92,
                      filter: "contrast(1.06)",
                      imageRendering: "pixelated",
                    }}
                  />
                  <button
                    type="button"
                    className="btn btnGhost"
                    onPointerDown={() => startTemplatePreviewRepeat(-1)}
                    onPointerUp={stopTemplatePreviewRepeat}
                    onPointerCancel={stopTemplatePreviewRepeat}
                    onPointerLeave={stopTemplatePreviewRepeat}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        moveTemplatePreview(-1);
                      }
                    }}
                    style={{
                      position: "absolute",
                      left: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 34,
                      height: 34,
                      padding: 0,
                      borderRadius: 999,
                      borderColor: "rgba(255,255,255,0.62)",
                      color: templateGalleryPreviewTextColor,
                      background: "rgba(10, 18, 32, 0.35)",
                      boxShadow: "none",
                      fontSize: 20,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    aria-label="前のテンプレート"
                    title="前へ"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="btn btnGhost"
                    onPointerDown={() => startTemplatePreviewRepeat(1)}
                    onPointerUp={stopTemplatePreviewRepeat}
                    onPointerCancel={stopTemplatePreviewRepeat}
                    onPointerLeave={stopTemplatePreviewRepeat}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        moveTemplatePreview(1);
                      }
                    }}
                    style={{
                      position: "absolute",
                      right: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 34,
                      height: 34,
                      padding: 0,
                      borderRadius: 999,
                      borderColor: "rgba(255,255,255,0.62)",
                      color: templateGalleryPreviewTextColor,
                      background: "rgba(10, 18, 32, 0.35)",
                      boxShadow: "none",
                      fontSize: 20,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    aria-label="次のテンプレート"
                    title="次へ"
                  >
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {datasetId ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr 400px",
            gap: 16,
            padding: 16,
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "hidden",
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>
                Dataset
                {datasetInfo?.project_name ? `: ${datasetInfo.project_name}` : ""}
              </div>
              <select
                value={leftFilter}
                onChange={(e) =>
                  setLeftFilter(e.target.value as "all" | "annotated" | "unannotated")
                }
                style={{
                  height: 26,
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  padding: "0 8px",
                  background: "var(--panel)",
                  color:
                    leftFilter === "annotated"
                      ? "#2e7d32"
                      : leftFilter === "unannotated"
                        ? "#c62828"
                        : "inherit",
                }}
              >
                <option value="all">全表示</option>
                <option value="annotated" style={{ color: "#2e7d32" }}>
                  アノテ済
                </option>
                <option value="unannotated" style={{ color: "#c62828" }}>
                  未アノテ
                </option>
              </select>
            </div>
            {!datasetInfo && (
              <div style={{ fontSize: 12, color: "#666" }}>
                親フォルダを読み込むとサムネ一覧が表示されます。
              </div>
            )}
            {datasetInfo && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {datasetSelectedName &&
                  !filteredImages.some(
                    (entry) => (entry.original_filename || entry.filename || "") === datasetSelectedName
                  ) && (
                    <div style={{ fontSize: 11, color: "#a56900", marginBottom: 4 }}>
                      現在選択中の画像はフィルタ条件により一覧に非表示です。
                    </div>
                  )}
                {asChildren(filteredImages.map((entry: DatasetImageEntry, idx: number) => {
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
                                background: isDone ? "#e8f5e9" : "#fdeaea",
                                color: isDone ? "#2e7d32" : "#c62828",
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
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: "100%",
                  minHeight: 0,
                  width: "100%",
                  border: "none",
                  borderRadius: 0,
                  boxSizing: "border-box",
                }}
              >
                <ImageCanvas
                  ref={canvasRef}
                  imageUrl={imageUrl}
                  candidates={candidates}
                  selectedCandidateId={selectedCandidateId}
                  annotations={canvasAnnotations}
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
                  onClickPoint={(x, y) => {
                    if (detectionMode === "hover") return;
                    if (showDebug && debugPanelTab !== "last") return;
                    void handleClickPoint(x, y);
                  }}
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
                  onResizePendingManualBBox={(bbox) => {
                    setPendingManualBBox((prev) => {
                      if (!prev) return prev;
                      return clampBBoxToImage(bbox);
                    });
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
                  onClearSelectedAnnotation={() => setSelectedAnnotationId(null)}
                  pendingManualBBox={pendingManualBBox}
                  shouldIgnoreCanvasClick={() => isCreatingManualBBox || !!pendingManualBBox}
                onDebugCoords={setCoordDebug}
                debugOverlay={showDebug ? detectDebug || null : null}
                debugOverlayMode={showDebug && debugPanelTab === "last" ? "template" : "bbox"}
                debugRoiSize={showDebug && showRoiArea ? roiSize : undefined}
                debugFollowTemplateUrl={showDebug && debugPanelTab === "follow" ? debugTemplateImageUrl : null}
                debugFollowTemplateScale={showDebug && debugPanelTab === "follow" ? debugTemplateScale : 1}
                debugFollowTemplateLabel={
                  showDebug && debugPanelTab === "follow" && debugTemplateClass && debugTemplateName
                    ? `${debugTemplateClass} x ${debugTemplateScale.toFixed(2)}`
                    : ""
                }
                roiOverlayPoint={showDebug ? null : lastClick}
                roiOverlaySize={showDebug ? undefined : roiSize}
                roiOverlayConfidence={roiOverlayConfidence}
                showRoiArea={showRoiArea}
              />
                {showHints && imageUrl && (
                  <div
                    style={{
                      position: "absolute",
                      left: 12,
                      bottom: 12,
                      background: "rgba(255,255,255,0.94)",
                      border: "1px solid #d4ddec",
                      borderRadius: 10,
                      padding: "8px 10px",
                      fontSize: 11,
                      color: "#2b3b52",
                      zIndex: 22,
                      boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                      maxWidth: 250,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>キー操作</div>
                      <button
                        type="button"
                        onClick={dismissHints}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontSize: 12,
                          color: "#5f6f84",
                          padding: 0,
                          lineHeight: 1,
                        }}
                        aria-label="Close key help"
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ marginTop: 6, lineHeight: 1.45 }}>
      <div>↑ / ↓ : ROIサイズ + / -</div>
      <div>← / → : 候補切替 / Enter : 確定</div>
      <div>Del or Esc : 候補クリア</div>
      <div>Shift+Drag : 手動BBox</div>
                    </div>
                  </div>
                )}
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
                    <div style={{ marginTop: 4, fontSize: 10, opacity: 0.85 }}>
                      内側: 移動 / 辺: リサイズ
                    </div>
                    <div style={{ marginTop: 2, fontSize: 10, opacity: 0.85 }}>
                      編集完了はEsc
                    </div>
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
          </div>

          <div
            className="rightPanel panelShell"
            style={{
              padding: "16px 16px 6px",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarGutter: "stable both-edges",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              opacity: isCanvasInteracting ? 0.6 : 1,
              filter: autoRunning ? "saturate(0.8)" : "none",
              transition: "opacity 160ms ease, filter 160ms ease",
              position: "relative",
            }}
          >
            {autoRunning && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(230,236,245,0.46) 0%, rgba(207,218,232,0.52) 100%)",
                  backdropFilter: "blur(2px)",
                  zIndex: 50,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                  padding: "10px 8px",
                  pointerEvents: "auto",
                }}
              >
                <div className="autoCloudCard">
                  <div className="autoCloudLayout">
                    <div className="autoCloudDonutWrap">
                      <svg width="138" height="138" viewBox="0 0 150 150" aria-hidden="true">
                        <circle
                          cx="75"
                          cy="75"
                          r="50"
                          fill="none"
                          stroke="rgba(20, 45, 86, 0.12)"
                          strokeWidth="18"
                        />
                        <circle
                          cx="75"
                          cy="75"
                          r="50"
                          fill="none"
                          stroke="#103261"
                          strokeWidth="18"
                          strokeLinecap="round"
                          strokeDasharray={String(2 * Math.PI * 50)}
                          strokeDashoffset={String((2 * Math.PI * 50) * (1 - autoProgressClamped / 100))}
                          transform="rotate(-90 75 75)"
                          style={{ transition: "stroke-dashoffset 120ms linear" }}
                        />
                      </svg>
                      <div className="autoCloudDonutCenter">
                        <div className="autoCloudDonutLabel">
                          <div className="autoCloudDonutLabelSmall">Progress</div>
                          <div className="autoCloudDonutLabelBig">{autoProgressClamped}%</div>
                        </div>
                      </div>
                    </div>
                    <div className="autoCloudMain">
                      <div className="autoCloudHead">
                        <div className="autoCloudTitle">
                          <span className="autoCloudRing" />
                          全自動アノテーション
                        </div>
                      </div>
                      <span className="autoCloudMode">
                        {autoMethod === "combined"
                          ? "Fusion Mode"
                          : autoMethod === "scaled_templates"
                            ? "Equal Scale Expand Mode"
                            : "Global Precision Mode"}
                      </span>
                      <div className="autoCloudStatus">
                        実行中
                        <span className="autoCloudDots" aria-hidden="true">
                          <span>•</span>
                          <span>•</span>
                          <span>•</span>
                        </span>
                      </div>
                      {autoProgressId ? (
                        <div className="autoCloudProgressId">id: {autoProgressId}</div>
                      ) : null}
                      <div className="autoCloudSeries">
                        {asChildren(
                          autoOverlaySeriesRows.map((row) => (
                            <div key={`auto-cloud-series-${row.className}`} className="autoCloudSeriesRow">
                              <div className="autoCloudSeriesName">{row.className}</div>
                              <div className="autoCloudSeriesCount">
                                {autoRunning
                                  ? "検出中"
                                  : row.confirmed > 0
                                    ? `${row.confirmed}/${row.preDetect}`
                                    : `${row.preDetect}`}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                      const nextAnnotation: Annotation = {
                        id: `${Date.now()}-${Math.random()}`,
                        class_name: nextClass,
                        bbox: clampBBoxToImage(pendingManualBBox),
                        source: "manual",
                        created_at: createdAt,
                      };
                      setAnnotations((prev) => [...prev, nextAnnotation]);
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
              <div
                style={{
                  marginBottom: 2,
                  padding: "4px 10px 0",
                  borderRadius: 10,
                  background: "transparent",
                  display: "grid",
                  gap: 2,
                }}
              >
                <div style={{ display: "grid", gap: 2 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                      background: "#dfe8ff",
                      borderRadius: 8,
                      padding: 4,
                      marginBottom: 2,
                    }}
                  >
                    <button
                      type="button"
                      className="btn"
                      style={{
                        height: 30,
                        fontSize: 13,
                        boxShadow: "none",
                        borderRadius: 6,
                        background: detectionMode === "click" ? "#fff" : "transparent",
                        borderColor: detectionMode === "click" ? "#a9c3ff" : "transparent",
                        color: detectionMode === "click" ? "#1f4fbf" : "#546e7a",
                      }}
                      onClick={() => setDetectionMode("click")}
                    >
                      Click Detection
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        height: 30,
                        fontSize: 13,
                        boxShadow: "none",
                        borderRadius: 6,
                        background: detectionMode === "hover" ? "#fff" : "transparent",
                        borderColor: detectionMode === "hover" ? "#a9c3ff" : "transparent",
                        color: detectionMode === "hover" ? "#1f4fbf" : "#546e7a",
                      }}
                      onClick={() => setDetectionMode("hover")}
                    >
                      Hover Detect
                    </button>
                  </div>
                  {detectionMode === "click" ? (
                    <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr",
                          gap: 8,
                        }}
                      >
                        <span
                          title={activeDetectedCandidate?.class_name || "なし"}
                          style={{
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 6,
                            border: "1px solid #d9e2ec",
                            background: "#f3f8ff",
                            color: activeDetectedCandidate?.class_name ? "#16324f" : "#8aa0b5",
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: "28px",
                            boxSizing: "border-box",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {activeDetectedCandidate?.class_name || "Class"}
                        </span>
                        <span
                          style={{
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 6,
                            border: "1px solid #d9e2ec",
                            background: "#f3f8ff",
                            color:
                              activeDetectedCandidate && typeof activeDetectedCandidate.score === "number"
                                ? "#16324f"
                                : "#8aa0b5",
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: "28px",
                            boxSizing: "border-box",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {activeDetectedCandidate && typeof activeDetectedCandidate.score === "number"
                            ? activeDetectedCandidate.score.toFixed(3)
                            : "Conf"}
                        </span>
                        <span
                          style={{
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 6,
                            border: "1px solid #d9e2ec",
                            background: "#f3f8ff",
                            color:
                              activeDetectedCandidate && typeof activeDetectedCandidate.scale === "number"
                                ? "#16324f"
                                : "#8aa0b5",
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: "28px",
                            boxSizing: "border-box",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {activeDetectedCandidate && typeof activeDetectedCandidate.scale === "number"
                            ? activeDetectedCandidate.scale.toFixed(2)
                            : "Scale"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr",
                          gap: 8,
                        }}
                      >
                        <span
                          title={activeDetectedCandidate?.class_name || "なし"}
                          style={{
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 6,
                            border: "1px solid #d9e2ec",
                            background: "#f3f8ff",
                            color: activeDetectedCandidate?.class_name ? "#16324f" : "#8aa0b5",
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: "28px",
                            boxSizing: "border-box",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {activeDetectedCandidate?.class_name || "Class"}
                        </span>
                        <span
                          style={{
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 6,
                            border: "1px solid #d9e2ec",
                            background: "#f3f8ff",
                            color:
                              activeDetectedCandidate && typeof activeDetectedCandidate.score === "number"
                                ? "#16324f"
                                : "#8aa0b5",
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: "28px",
                            boxSizing: "border-box",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {activeDetectedCandidate && typeof activeDetectedCandidate.score === "number"
                            ? activeDetectedCandidate.score.toFixed(3)
                            : "Conf"}
                        </span>
                        <span
                          style={{
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 6,
                            border: "1px solid #d9e2ec",
                            background: "#f3f8ff",
                            color:
                              activeDetectedCandidate && typeof activeDetectedCandidate.scale === "number"
                                ? "#16324f"
                                : "#8aa0b5",
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: "28px",
                            boxSizing: "border-box",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {activeDetectedCandidate && typeof activeDetectedCandidate.scale === "number"
                            ? activeDetectedCandidate.scale.toFixed(2)
                            : "Scale"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "104px 1fr",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#455a64" }}>処理間隔</span>
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                          <NumericInputWithButtons
                            value={hoverDetectIntervalMs}
                            onChange={(v) =>
                              typeof v === "number" &&
                              setHoverDetectIntervalMs(Math.max(30, Math.min(3000, Math.round(v))))
                            }
                            min={30}
                            max={3000}
                            step={10}
                            height={26}
                            inputWidth={44}
                            ariaLabel="hover detect interval"
                            stylePreset="joined"
                            className="controlWrap"
                            inputClassName="numInput"
                            buttonClassName="stepBtn"
                          />
                          <span style={{ fontSize: 12, color: "#607d8b", minWidth: 18 }}>ms</span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "104px 1fr",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#455a64" }}>再検出抑制距離</span>
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                          <NumericInputWithButtons
                            value={hoverRedetectDistancePx}
                            onChange={(v) =>
                              typeof v === "number" &&
                              setHoverRedetectDistancePx(Math.max(0, Math.min(500, Math.round(v))))
                            }
                            min={0}
                            max={500}
                            step={1}
                            height={26}
                            inputWidth={44}
                            ariaLabel="hover redetect distance"
                            stylePreset="joined"
                            className="controlWrap"
                            inputClassName="numInput"
                            buttonClassName="stepBtn"
                          />
                          <span style={{ fontSize: 12, color: "#607d8b", minWidth: 18 }}>px</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    marginBottom: 0,
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
                      <span>候補</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>(←/→)</span>
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
              </div>
            </div>
            <div className="sectionCard">
              <button
                type="button"
                onClick={() => setShowCommonSettings((prev) => !prev)}
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
                  justifyContent: "flex-start",
                  gap: 6,
                  padding: 0,
                }}
              >
                <span style={{ fontSize: 12, color: "#546e7a" }}>
                  {showCommonSettings ? "▼" : "▶"}
                </span>
                <span style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>検出 共通設定</span>
              </button>
              {showCommonSettings && (
              <>
              <div className="sectionBody" style={{ display: "grid", gap: 6, marginBottom: 10 }} />
                <div
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    background: "#eef3ff",
                    border: "1px solid #c8d6ff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                      background: "#dfe8ff",
                      borderRadius: 8,
                      padding: 4,
                      marginBottom: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="btn"
                      style={{
                        height: 30,
                        boxShadow: "none",
                        borderRadius: 6,
                        background: advancedTab === "params" ? "#fff" : "transparent",
                        borderColor: advancedTab === "params" ? "#a9c3ff" : "transparent",
                        color: advancedTab === "params" ? "#1f4fbf" : "#546e7a",
                      }}
                      onClick={() => setAdvancedTab("params")}
                    >
                      検出パラメータ
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        height: 30,
                        boxShadow: "none",
                        borderRadius: 6,
                        background: advancedTab === "classes" ? "#fff" : "transparent",
                        borderColor: advancedTab === "classes" ? "#a9c3ff" : "transparent",
                        color: advancedTab === "classes" ? "#1f4fbf" : "#546e7a",
                      }}
                      onClick={() => setAdvancedTab("classes")}
                    >
                      クラス別カラー
                    </button>
                  </div>
                  {advancedTab === "params" && (
                  <>
                  <div
                    style={{
                      border: "1px solid #d6e0f3",
                      borderRadius: 10,
                      background: "#ffffff",
                      padding: "10px 10px 8px",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                  <div
                    style={{
                      marginBottom: 10,
                      paddingBottom: 10,
                      borderBottom: "1px dashed #e0e0e0",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "104px 1fr",
                          alignItems: "center",
                          gap: 8,
                          opacity: autoDisablesRoiUi ? 0.45 : 1,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600 }}>ROIサイズ</span>
                        <div className="controlWrap" style={{ justifyContent: "flex-end" }}>
                          <NumericInputWithButtons
                            value={roiSize}
                            onChange={(v) => {
                              if (autoDisablesRoiUi) return;
                              if (typeof v === "number") setRoiSize(v);
                            }}
                            min={10}
                            step={10}
                            height={32}
                            inputWidth={84}
                            ariaLabel="roi size"
                            className="controlWrap"
                            inputClassName="numInput"
                            buttonClassName="stepBtn"
                            disabled={autoDisablesRoiUi}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "104px 1fr",
                          alignItems: "center",
                          gap: 8,
                          opacity: autoDisablesRoiUi ? 0.45 : 1,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#666" }}>
                          {autoDisablesRoiUi ? "Global Precisionでは未使用" : "手動/自動で共通"}
                        </span>
                        <div className="hintText" style={{ justifyContent: "flex-end" }}>
                          <span className="badge">推奨 200–600</span>
                          {roiWarn && !roiDanger && <span className="badge badgeDanger">注意</span>}
                          {roiDanger && <span className="badge badgeDanger">Danger</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 4, marginTop: 6, marginBottom: 2 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "104px 1fr",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600 }}>形状一致率</span>
                        <div className="controlWrap" title="±0.05" style={{ justifyContent: "flex-end" }}>
                          <NumericInputWithButtons
                            value={shapeRatioThreshold}
                            onChange={(v) =>
                              typeof v === "number" && setShapeRatioThreshold(v)
                            }
                            min={0}
                            max={1}
                            step={0.05}
                            height={32}
                            inputWidth={84}
                            ariaLabel="shape ratio threshold"
                            placeholder="推奨 0.5–0.7"
                            className="controlWrap"
                            inputClassName="numInput"
                            buttonClassName="stepBtn"
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "104px 1fr",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span />
                        <div className="hintText" style={{ justifyContent: "flex-end" }}>
                          <span className="badge">推奨 0.5–0.7</span>
                          {shapeRatioDanger && <span className="badge badgeDanger">危険</span>}
                        </div>
                      </div>
                    </div>
                  <div style={{ display: "grid", gap: 4, marginTop: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>スケール</div>
                    <div style={{ position: "relative", width: "100%", maxWidth: 320, height: 46, marginTop: 2 }}>
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          left: `${((scaleMin - SCALE_RANGE_MIN) / (SCALE_RANGE_MAX - SCALE_RANGE_MIN)) * 100}%`,
                          transform: "translateX(calc(-100% - 6px))",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#35506b",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {scaleMinLabel}
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          left: `${((scaleMax - SCALE_RANGE_MIN) / (SCALE_RANGE_MAX - SCALE_RANGE_MIN)) * 100}%`,
                          transform: "translateX(6px)",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#35506b",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {scaleMaxLabel}
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: 36,
                          height: 3,
                          borderRadius: 999,
                          background: "#cfd4dc",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${((scaleMin - SCALE_RANGE_MIN) / (SCALE_RANGE_MAX - SCALE_RANGE_MIN)) * 100}%`,
                          width: `${Math.max(0, ((scaleMax - scaleMin) / (SCALE_RANGE_MAX - SCALE_RANGE_MIN)) * 100)}%`,
                          top: 36,
                          height: 3,
                          borderRadius: 999,
                          background: "#6b7280",
                        }}
                      />
                      <input
                        className="dualRangeInput"
                        type="range"
                        min={SCALE_RANGE_MIN}
                        max={SCALE_RANGE_MAX}
                        step={0.05}
                        value={scaleMin}
                        onChange={(e) => {
                          const next = Math.round(Number(e.target.value) * 20) / 20;
                          setScaleMin(Math.min(next, scaleMax - 0.1));
                        }}
                        aria-label="scale min"
                        style={{ zIndex: scaleMin > 1.6 ? 5 : 3, inset: "20px 0 0 0" }}
                      />
                      <input
                        className="dualRangeInput"
                        type="range"
                        min={SCALE_RANGE_MIN}
                        max={SCALE_RANGE_MAX}
                        step={0.05}
                        value={scaleMax}
                        onChange={(e) => {
                          const next = Math.round(Number(e.target.value) * 20) / 20;
                          setScaleMax(Math.max(next, scaleMin + 0.1));
                        }}
                        aria-label="scale max"
                        style={{ zIndex: 4, inset: "20px 0 0 0" }}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          (scaleMinWarn || scaleMaxWarn) && !scaleMinDanger && !scaleMaxDanger
                            ? "1fr auto auto"
                            : (scaleMinDanger || scaleMaxDanger)
                              ? "1fr auto auto"
                              : "1fr auto",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <span />
                      <span
                        className="badge"
                        style={{
                          justifySelf: "end",
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                        }}
                      >
                        推奨 min 0.4–0.8 / max 1.2–2.0
                      </span>
                      {((scaleMinWarn || scaleMaxWarn) && !scaleMinDanger && !scaleMaxDanger) ||
                      (scaleMinDanger || scaleMaxDanger) ? (
                        <div style={{ display: "flex", justifyContent: "flex-end", minWidth: 56 }}>
                          {(scaleMinWarn || scaleMaxWarn) && !scaleMinDanger && !scaleMaxDanger && (
                            <span className="badge badgeDanger">注意</span>
                          )}
                          {(scaleMinDanger || scaleMaxDanger) && (
                            <span className="badge badgeDanger">Danger</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  </div>
                  <div className="formRow" style={{ marginBottom: 8, alignItems: "start" }}>
                    <span style={{ fontSize: 12, height: 26, lineHeight: "26px" }}>分割</span>
                    <div style={{ width: "100%", display: "grid", gap: 6 }}>
                      <div className="controlWrap" style={{ justifyContent: "flex-start" }}>
                        <input
                          className="paramSlider"
                          type="range"
                          min={1}
                          max={20}
                          step={1}
                          value={scaleSteps}
                          onChange={(e) => setScaleSteps(Number(e.target.value))}
                          style={{ flex: "1 1 120px", width: "100%", maxWidth: 180 }}
                          aria-label="scale steps"
                        />
                        <span
                          className={`badge ${scaleStepsDanger ? "badgeDanger" : scaleStepsWarn ? "badgeWarn" : ""}`}
                          style={{ minWidth: 36, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
                        >
                          {scaleSteps}
                        </span>
                      </div>
                      <div className="hintText" style={{ justifyContent: "flex-end" }}>
                        <span className="badge">推奨 6–12</span>
                        {scaleStepsWarn && !scaleStepsDanger && <span className="badge badgeDanger">注意</span>}
                        {scaleStepsDanger && <span className="badge badgeDanger">Danger</span>}
                      </div>
                    </div>
                  </div>
                  <div className="formRow" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 12 }}>上位件数</span>
                    <div className="controlWrap" style={{ justifyContent: "flex-start" }}>
                      <input
                        className="paramSlider"
                        type="range"
                        min={1}
                        max={3}
                        step={1}
                        value={topk}
                        onChange={(e) => setTopk(Number(e.target.value))}
                        style={{ flex: "1 1 120px", width: "100%", maxWidth: 180 }}
                        aria-label="topk"
                      />
                      <span
                        className={`badge ${topkDanger ? "badgeDanger" : topkWarn ? "badgeWarn" : ""}`}
                        style={{ minWidth: 36, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
                      >
                        {topk}
                      </span>
                    </div>
                  </div>
                  <div
                    role="button"
                    aria-pressed={excludeEnabled}
                    onClick={() => setExcludeEnabled((prev) => !prev)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      alignItems: "center",
                      gap: 10,
                      height: 28,
                      cursor: "pointer",
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#455a64" }}>確定BBoxを除外</span>
                    <span
                      style={{
                        width: 34,
                        height: 18,
                        borderRadius: 999,
                        background: excludeEnabled ? "#1a73e8" : "#cfd8dc",
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
                          left: excludeEnabled ? 18 : 2,
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
                        color: excludeEnabled ? "#455a64" : "#90a4ae",
                        fontWeight: 600,
                      }}
                    >
                      {excludeEnabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  <div
                    role="button"
                    aria-pressed={excludeCenter}
                    onClick={() => {
                      if (!excludeEnabled) return;
                      setExcludeCenter((prev) => !prev);
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      alignItems: "center",
                      gap: 10,
                      height: 28,
                      cursor: excludeEnabled ? "pointer" : "not-allowed",
                      marginBottom: 6,
                      opacity: excludeEnabled ? 1 : 0.55,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#455a64" }}>中心点で除外</span>
                    <span
                      style={{
                        width: 34,
                        height: 18,
                        borderRadius: 999,
                        background: excludeCenter ? "#1a73e8" : "#cfd8dc",
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
                          left: excludeCenter ? 18 : 2,
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
                        color: excludeCenter ? "#455a64" : "#90a4ae",
                        fontWeight: 600,
                      }}
                    >
                      {excludeCenter ? "ON" : "OFF"}
                    </span>
                  </div>
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
                  <div className="formRow" style={{ marginBottom: 8, alignItems: "start" }}>
                    <span style={{ fontSize: 12, height: 26, lineHeight: "26px" }}>IoU</span>
                    <div style={{ width: "100%", display: "grid", gap: 6 }}>
                      <div className="controlWrap" style={{ justifyContent: "flex-start" }}>
                        <input
                          className="paramSlider"
                          type="range"
                          min={0.4}
                          max={0.8}
                          step={0.05}
                          value={excludeIouThreshold}
                          onChange={(e) => setExcludeIouThreshold(Number(e.target.value))}
                          disabled={!excludeEnabled}
                          style={{ flex: "1 1 120px", width: "100%", maxWidth: 180 }}
                          aria-label="exclude iou"
                        />
                        <span style={{ minWidth: 36, textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                          {excludeIouThreshold.toFixed(2)}
                        </span>
                      </div>
                      <div className="hintText" style={{ justifyContent: "flex-end" }}>
                        <span className="badge">推奨 0.4–0.8</span>
                      </div>
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
                  <div style={{ height: 1, background: "#eee", margin: "4px 0 8px" }} />
                  <div
                    role="button"
                    aria-pressed={showRoiArea}
                    onClick={() => setShowRoiArea((prev) => !prev)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      alignItems: "center",
                      gap: 10,
                      height: 28,
                      cursor: "pointer",
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#455a64" }}>ROI AAREA を表示</span>
                    <span
                      style={{
                        width: 34,
                        height: 18,
                        borderRadius: 999,
                        background: showRoiArea ? "#e53935" : "#cfd8dc",
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
                          left: showRoiArea ? 18 : 2,
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
                        color: showRoiArea ? "#455a64" : "#90a4ae",
                        fontWeight: 600,
                      }}
                    >
                      {showRoiArea ? "ON" : "OFF"}
                    </span>
                  </div>
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
                      marginBottom: 2,
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
                      marginBottom: 6,
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
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    {detectionDefaultDirty && (
                      <button
                        type="button"
                        className="btn btnGhost"
                        style={{ height: 24, padding: "0 8px", fontSize: 10 }}
                        onClick={() => {
                          setRoiSize(DEFAULT_ROI_SIZE);
                          setTopk(DEFAULT_TOPK);
                          setShapeRatioThreshold(DEFAULT_SHAPE_RATIO_THRESHOLD);
                          setScaleMin(DEFAULT_SCALE_MIN);
                          setScaleMax(DEFAULT_SCALE_MAX);
                          setScaleSteps(DEFAULT_SCALE_STEPS);
                          setExcludeEnabled(DEFAULT_EXCLUDE_ENABLED);
                          setExcludeMode(DEFAULT_EXCLUDE_MODE);
                          setExcludeCenter(DEFAULT_EXCLUDE_CENTER);
                          setExcludeIouThreshold(DEFAULT_EXCLUDE_IOU_THRESHOLD);
                          setRefineContour(DEFAULT_REFINE_CONTOUR);
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  </>
                  )}
                  {advancedTab === "classes" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="btn btnGhost"
                              style={{ height: 28, padding: "0 10px", boxShadow: "none" }}
                              onClick={() => {
                                const allEnabled =
                                  classOptions.length > 0 &&
                                  classOptions.every((name) => autoClassFilter.includes(name));
                                setAutoClassFilter(allEnabled ? [] : [...classOptions]);
                              }}
                            >
                              全検出{" "}
                              {classOptions.length > 0 &&
                              classOptions.every((name) => autoClassFilter.includes(name))
                                ? "OFF"
                                : "ON"}
                            </button>
                            <button
                              type="button"
                              className="btn btnGhost"
                              style={{ height: 28, padding: "0 10px", boxShadow: "none" }}
                              onClick={() =>
                                setClassCardFilter((prev) => (prev === "all" ? "enabled" : "all"))
                              }
                            >
                              表示 {classCardFilter === "all" ? "全件" : "検出のみ"}
                            </button>
                          </div>
                          <div style={{ display: "grid", gap: 8, maxHeight: 440, overflowY: "auto", paddingRight: 2 }}>
                            {asChildren(
                              classOptions
                                .filter((name) =>
                                  classCardFilter === "enabled"
                                    ? autoClassFilter.includes(name)
                                    : true
                                )
                                .map((className) => {
                                  const enabled = autoClassFilter.includes(className);
                                  const stats = classAnnotationStats[className];
                                  const hasScoreRange =
                                    (stats?.count || 0) > 1 &&
                                    typeof stats?.minScore === "number" &&
                                    typeof stats?.maxScore === "number" &&
                                    Number.isFinite(stats.minScore) &&
                                    Number.isFinite(stats.maxScore);
                                  const minScoreTrunc = hasScoreRange
                                    ? Math.floor((stats?.minScore || 0) * 100) / 100
                                    : null;
                                  const maxScoreTrunc = hasScoreRange
                                    ? Math.floor((stats?.maxScore || 0) * 100) / 100
                                    : null;
                                  const hasSlider =
                                    hasScoreRange &&
                                    minScoreTrunc !== null &&
                                    maxScoreTrunc !== null &&
                                    maxScoreTrunc > minScoreTrunc;
                                  const sliderValue = hasSlider
                                    ? classScoreVisibility[className] ?? minScoreTrunc
                                    : null;
                                  const scoreText =
                                    typeof stats?.minScore === "number" &&
                                    typeof stats?.maxScore === "number"
                                      ? `${stats.minScore.toFixed(3)} ~ ${stats.maxScore.toFixed(3)}`
                                      : "-";
                                  const hasScaleRange =
                                    (stats?.count || 0) > 1 &&
                                    typeof stats?.minScale === "number" &&
                                    typeof stats?.maxScale === "number" &&
                                    Number.isFinite(stats.minScale) &&
                                    Number.isFinite(stats.maxScale);
                                  const minScaleTrunc = hasScaleRange
                                    ? Math.floor((stats?.minScale || 0) * 100) / 100
                                    : null;
                                  const maxScaleTrunc = hasScaleRange
                                    ? Math.floor((stats?.maxScale || 0) * 100) / 100
                                    : null;
                                  const hasScaleSlider =
                                    hasScaleRange &&
                                    minScaleTrunc !== null &&
                                    maxScaleTrunc !== null &&
                                    maxScaleTrunc > minScaleTrunc;
                                  const scaleSliderValue = hasScaleSlider
                                    ? classScaleVisibility[className] ?? minScaleTrunc
                                    : null;
                                  const scaleText =
                                    typeof stats?.minScale === "number" &&
                                    typeof stats?.maxScale === "number"
                                      ? `${stats.minScale.toFixed(2)} ~ ${stats.maxScale.toFixed(2)}`
                                      : "-";
                                  return (
                                    <div
                                      key={`class-card-${className}`}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "18px 52px 1fr 34px",
                                        alignItems: "center",
                                        gap: 8,
                                        border: "1px solid #d7e1f3",
                                        borderRadius: 10,
                                        background: enabled ? "#f7fbff" : "#ffffff",
                                        padding: "8px 10px",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={enabled}
                                        style={{ width: 16, height: 16 }}
                                        onChange={(e) => {
                                          const next = e.target.checked
                                            ? [...autoClassFilter, className]
                                            : autoClassFilter.filter((name) => name !== className);
                                          setAutoClassFilter(next);
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => openTemplateGallery(className)}
                                        title={`${className} のテンプレート一覧`}
                                        style={{
                                          width: 52,
                                          height: 52,
                                          borderRadius: 8,
                                          border: "1px solid #d7deea",
                                          background: "#fff",
                                          padding: 0,
                                          overflow: "hidden",
                                          cursor: "pointer",
                                        }}
                                      >
                                        {templateClassPreviews[className] ? (
                                          <img
                                            src={`data:image/png;base64,${templateClassPreviews[className]}`}
                                            alt={`${className} preview`}
                                            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                                          />
                                        ) : (
                                          <div style={{ fontSize: 9, color: "#90a4ae" }}>no preview</div>
                                        )}
                                      </button>
                                      <div style={{ display: "grid", gap: 3 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d3557", lineHeight: 1.2 }}>
                                          {className} ({stats?.count || 0})
                                        </div>
                                        <div style={{ fontSize: 12, color: "#546e7a" }}>
                                          確信度: {scoreText}
                                        </div>
                                        {hasSlider && sliderValue !== null && minScoreTrunc !== null && maxScoreTrunc !== null && (
                                          <div style={{ display: "grid", gap: 4, marginTop: 2 }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                                              <input
                                                className="classScoreSlider"
                                                type="range"
                                                min={minScoreTrunc}
                                                max={maxScoreTrunc}
                                                step={0.01}
                                                value={sliderValue}
                                                onChange={(e) => {
                                                  const raw = Number(e.target.value);
                                                  const next = Math.floor(raw * 100) / 100;
                                                  setClassScoreVisibility((prev) => ({
                                                    ...prev,
                                                    [className]: Math.min(maxScoreTrunc, Math.max(minScoreTrunc, next)),
                                                  }));
                                                }}
                                                style={{ width: "100%" }}
                                              />
                                              <span
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: 700,
                                                  color: "#385672",
                                                  minWidth: 38,
                                                  textAlign: "right",
                                                  fontVariantNumeric: "tabular-nums",
                                                }}
                                              >
                                                {sliderValue.toFixed(2)}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                        <div style={{ fontSize: 12, color: "#546e7a", marginTop: hasSlider ? 2 : 0 }}>
                                          スケール: {scaleText}
                                        </div>
                                        {hasScaleSlider &&
                                          scaleSliderValue !== null &&
                                          minScaleTrunc !== null &&
                                          maxScaleTrunc !== null && (
                                            <div style={{ display: "grid", gap: 4, marginTop: 2 }}>
                                              <div
                                                style={{
                                                  display: "grid",
                                                  gridTemplateColumns: "1fr auto",
                                                  alignItems: "center",
                                                  gap: 8,
                                                }}
                                              >
                                                <input
                                                  className="classScaleSlider"
                                                  type="range"
                                                  min={minScaleTrunc}
                                                  max={maxScaleTrunc}
                                                  step={0.01}
                                                  value={scaleSliderValue}
                                                  onChange={(e) => {
                                                    const raw = Number(e.target.value);
                                                    const next = Math.floor(raw * 100) / 100;
                                                    setClassScaleVisibility((prev) => ({
                                                      ...prev,
                                                      [className]: Math.min(
                                                        maxScaleTrunc,
                                                        Math.max(minScaleTrunc, next)
                                                      ),
                                                    }));
                                                  }}
                                                  style={{ width: "100%" }}
                                                />
                                                <span
                                                  style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: "#385672",
                                                    minWidth: 38,
                                                    textAlign: "right",
                                                    fontVariantNumeric: "tabular-nums",
                                                  }}
                                                >
                                                  {scaleSliderValue.toFixed(2)}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                      <input
                                        type="color"
                                        value={colorMap[className] || "#7aa2ff"}
                                        onChange={(e) => {
                                          const next = normalizeToHex(e.target.value);
                                          setColorMap((prev) => ({ ...prev, [className]: next }));
                                        }}
                                        style={{
                                          width: 28,
                                          height: 28,
                                          padding: 0,
                                          border: "1px solid #d0d7e6",
                                          borderRadius: 6,
                                          background: "#fff",
                                        }}
                                      />
                                    </div>
                                  );
                                })
                            )}
                          </div>
                      </>
                    </div>
                  )}
                </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #e3e3e3" }}>
                <button
                  type="button"
                  onClick={() => setShowDebug((prev) => !prev)}
                  className={`btn btnDebug ${showDebug ? "isOpen" : ""}`}
                  style={{
                    width: "auto",
                    height: 32,
                  }}
                >
                  {showDebug ? "▼ Debug" : "▶︎ Debug"}
                </button>
                {showDebug && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "#fff7ed",
                      border: "1px solid #fdba74",
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                        background: "#ffe9d2",
                        borderRadius: 8,
                        padding: 4,
                        marginBottom: 8,
                      }}
                    >
                      <button
                        type="button"
                        className="btn"
                        style={{
                          height: 28,
                          boxShadow: "none",
                          borderRadius: 6,
                          background: debugPanelTab === "follow" ? "#fff" : "transparent",
                          borderColor: debugPanelTab === "follow" ? "#fdba74" : "transparent",
                          color: debugPanelTab === "follow" ? "#9a4b00" : "#866f5d",
                        }}
                        onClick={() => setDebugPanelTab("follow")}
                      >
                        Template Follow
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          height: 28,
                          boxShadow: "none",
                          borderRadius: 6,
                          background: debugPanelTab === "last" ? "#fff" : "transparent",
                          borderColor: debugPanelTab === "last" ? "#fdba74" : "transparent",
                          color: debugPanelTab === "last" ? "#9a4b00" : "#866f5d",
                        }}
                        onClick={() => setDebugPanelTab("last")}
                      >
                        Last Detection
                      </button>
                    </div>
                    {debugPanelTab === "follow" && (
                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#666" }}>シリーズ</span>
                          <select
                            value={debugTemplateClass}
                            onChange={(e) => setDebugTemplateClass(e.target.value)}
                            style={{ height: 28, fontSize: 12 }}
                          >
                            <option value="">選択</option>
                            {asChildren(
                              classOptions.map((name, idx) => (
                                <option key={`debug-class-${name}-${idx}`} value={name}>
                                  {name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#666" }}>テンプレ</span>
                          <select
                            value={debugTemplateName}
                            onChange={(e) => setDebugTemplateName(e.target.value)}
                            disabled={!debugTemplateClass || debugTemplateLoading}
                            style={{ height: 28, fontSize: 12 }}
                          >
                            <option value="">
                              {debugTemplateLoading ? "読み込み中..." : "選択"}
                            </option>
                            {asChildren(
                              debugTemplateItems.map((item, idx) => (
                                <option key={`debug-template-${item.name}-${idx}`} value={item.name}>
                                  {item.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        <div style={{ fontSize: 11, color: "#555", display: "grid", gap: 2 }}>
                          <div>I: テンプレート表示を拡大 (+0.01)</div>
                          <div>O: テンプレート表示を縮小 (-0.01)</div>
                          <div>↑: シリーズ切り替え (前)</div>
                          <div>↓: シリーズ切り替え (次)</div>
                          <div>←: 同シリーズ内のテンプレート画像を戻る</div>
                          <div>→: 同シリーズ内のテンプレート画像を進む</div>
                        </div>
                      </div>
                    )}
                    {debugPanelTab === "last" && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#7a3e00" }}>
                          Last Detection
                        </div>
                        {!lastDetectionSnapshot && (
                          <div style={{ fontSize: 11, color: "#666" }}>まだ検出履歴がありません。</div>
                        )}
                        {lastDetectionSnapshot && (
                          <>
                            {(() => {
                              const viewClass =
                                activeDetectedCandidate?.class_name || lastDetectionSnapshot.bestClass || "-";
                              const viewScore =
                                typeof activeDetectedCandidate?.score === "number" &&
                                Number.isFinite(activeDetectedCandidate.score)
                                  ? activeDetectedCandidate.score
                                  : lastDetectionSnapshot.bestScore;
                              const viewScale =
                                typeof activeDetectedCandidate?.scale === "number" &&
                                Number.isFinite(activeDetectedCandidate.scale)
                                  ? activeDetectedCandidate.scale
                                  : lastDetectionSnapshot.bestScale;
                              const viewTemplate =
                                activeDetectedCandidate?.template || lastDetectionSnapshot.bestTemplate || "-";
                              const viewMatchMode =
                                activeDetectedCandidate?.match_mode ||
                                lastDetectionSnapshot.bestMatchMode ||
                                "-";
                              return (
                                <>
                            <div style={{ fontSize: 11, color: "#666" }}>
                              mode: {lastDetectionSnapshot.mode === "hover" ? "Hover Detect" : "Click Detection"}
                            </div>
                            <div style={{ fontSize: 11, color: "#666" }}>
                              point: {lastDetectionSnapshot.point.x.toFixed(2)}, {lastDetectionSnapshot.point.y.toFixed(2)}
                            </div>
                            <div style={{ fontSize: 11, color: "#666" }}>
                              class: {viewClass} / conf:{" "}
                              {typeof viewScore === "number"
                                ? viewScore.toFixed(4)
                                : "-"}{" "}
                              / scale:{" "}
                              {typeof viewScale === "number"
                                ? viewScale.toFixed(3)
                                : "-"}
                            </div>
                            <div style={{ fontSize: 11, color: "#666" }}>
                              template: {viewTemplate} / match: {viewMatchMode}
                            </div>
                            <div
                              style={{
                                marginTop: 2,
                                display: "grid",
                                gap: 4,
                                border: "1px solid #f5cda0",
                                borderRadius: 6,
                                background: "rgba(255,255,255,0.6)",
                                padding: "6px 8px",
                              }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#7a3e00" }}>Detection Params</div>
                              <div style={{ fontSize: 11, color: "#666" }}>
                                roi_size: {lastDetectionSnapshot.roiSize} / topk: {lastDetectionSnapshot.topk}
                              </div>
                              <div style={{ fontSize: 11, color: "#666" }}>
                                scale_min: {lastDetectionSnapshot.scaleMin.toFixed(2)} / scale_max:{" "}
                                {lastDetectionSnapshot.scaleMax.toFixed(2)} / scale_steps:{" "}
                                {lastDetectionSnapshot.scaleSteps}
                              </div>
                              <div style={{ fontSize: 11, color: "#666" }}>
                                shape_ratio_threshold: {lastDetectionSnapshot.shapeRatioThreshold.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 11, color: "#666" }}>
                                exclude_mode: {lastDetectionSnapshot.excludeMode} / exclude_center:{" "}
                                {lastDetectionSnapshot.excludeCenter ? "on" : "off"} / exclude_iou_threshold:{" "}
                                {lastDetectionSnapshot.excludeIouThreshold.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 11, color: "#666" }}>
                                class_filter:{" "}
                                {lastDetectionSnapshot.classFilter.length > 0
                                  ? lastDetectionSnapshot.classFilter.join(", ")
                                  : "(all)"}
                              </div>
                            </div>
                            {detectDebug?.roi_bbox && (
                              <div style={{ fontSize: 11, color: "#666" }}>
                                roi bbox: ({detectDebug.roi_bbox.x1}, {detectDebug.roi_bbox.y1}) - (
                                {detectDebug.roi_bbox.x2}, {detectDebug.roi_bbox.y2})
                              </div>
                            )}
                            {detectDebug?.roi_click_xy && (
                              <div style={{ fontSize: 11, color: "#666" }}>
                                roi click: {detectDebug.roi_click_xy.x.toFixed(2)}, {detectDebug.roi_click_xy.y.toFixed(2)}
                              </div>
                            )}
                            {typeof detectDebug?.match_score === "number" && (
                              <div style={{ fontSize: 11, color: "#666" }}>
                                match_score: {detectDebug.match_score.toFixed(4)} / shape_ratio:{" "}
                                {typeof detectDebug?.shape_ratio === "number"
                                  ? detectDebug.shape_ratio.toFixed(4)
                                  : "-"}
                              </div>
                            )}
                            {detectDebug?.match_offset_in_roi && (
                              <div style={{ fontSize: 11, color: "#666" }}>
                                match_offset_in_roi: {detectDebug.match_offset_in_roi.x.toFixed(1)},{" "}
                                {detectDebug.match_offset_in_roi.y.toFixed(1)}
                              </div>
                            )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              </>
              )}
            </div>

            <div className="sectionCard muted">
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
                  justifyContent: "flex-start",
                  gap: 6,
                  padding: 0,
                }}
              >
                  <span style={{ fontSize: 12, color: "#546e7a" }}>
                    {autoPanelOpen ? "▼" : "▶"}
                  </span>
                  <span style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>
                    全自動アノテーション
                  </span>
                </button>
                {autoPanelOpen && (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <div className="formRow" style={{ gridTemplateColumns: "152px 1fr", order: 2 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>確信度 閾値</div>
                        <div style={{ fontSize: 10, color: "#607d8b", marginTop: 2 }}>
                          高いほど誤検出が減ります。低いほど拾いやすくなります。
                        </div>
                      </div>
                      <div className="controlWrap" title="±0.01">
                        <NumericInputWithButtons
                          value={autoThreshold}
                          onChange={(v) => typeof v === "number" && setAutoThreshold(v)}
                          min={0.1}
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
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#607d8b", order: 3 }}>
                      対象クラスは「検出 共通設定 ＞ クラス別カラー」で設定します。
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoAnnotate}
                      disabled={autoRunning}
                      style={{
                        order: 4,
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
                      <div style={{ fontSize: 12, color: "#0b3954", order: 5 }}>
                        <div>追加されたアノテーション数: {autoResult.added}</div>
                        <div>除外された候補数: {autoResult.rejected}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                          <span>使用した閾値: {autoResult.threshold.toFixed(2)}</span>
                          <span>処理時間: {(autoResult.elapsedMs / 1000).toFixed(2)}s</span>
                        </div>
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
                    <div
                      className="autoAdvanced"
                      style={{
                        order: 1,
                        display: "grid",
                        gap: 10,
                        marginTop: 2,
                        padding: 12,
                        borderRadius: 12,
                        background: "linear-gradient(180deg, #f7faff 0%, #eef4ff 100%)",
                        border: "1px solid #d3e1fb",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                      }}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>検出方式</div>
                          {autoDirty && autoBaseline && (
                            <button
                              type="button"
                              className="btn btnDanger"
                              style={{ height: 26, padding: "0 10px", fontSize: 10 }}
                              onClick={() => {
                                setAutoThreshold(autoBaseline.autoThreshold);
                                setAutoMethod(autoBaseline.autoMethod);
                                setAutoClassFilter(autoBaseline.autoClassFilter);
                                setAutoStride(autoBaseline.autoStride);
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {[
                            {
                              key: "combined",
                              label: "Fusion Mode",
                              help: "二値化 + match + 黒線一致率 + NMS で判定。",
                              detail:
                                "Fusion Mode（画像解析型）: 画像全体を二値化してスケールドテンプレートを正規化相関（TM_CCORR_NORMED）で走査し、match_score に黒画素一致率（match_ratio >= 0.69）を掛け合わせて候補化。候補は IoU=0.8 の NMS で統合され、再現率寄りの検出挙動になります。",
                              recommend: "推奨 0.6~0.7",
                              accent: "#1976d2",
                              bg: "#e3f2fd",
                            },
                            {
                              key: "scaled_templates",
                              label: "Equal Scale Expand Mode",
                              help: "1.0x中心→外側拡張でタイル探索判定。",
                              detail:
                                "Equal Scale Expand Mode（等倍外側探索型）: 画像をタイル走査（tile=roi_size、strideは指定値またはroi_size×0.5）し、各タイル中心ROIでテンプレート照合を実行。倍率探索は 1.0x を中心に外側へ拡張（例: 1.0→0.9→1.1→0.8→1.2...）。edge前処理で TM_CCOEFF_NORMED を評価し、候補ゼロ時のみ二値反転へフォールバック。score と shape_ratio から final_score（0.6*score+0.4*shape_ratio）を作って閾値選別し、最後に重なりクラスタを1件へ統合します。",
                              recommend: "推奨 0.7~0.8",
                              accent: "#546e7a",
                              bg: "#eceff1",
                            },
                            {
                              key: "scaled_templates_beta",
                              label: "Global Precision Mode",
                              help: "ROIなし全画面テンプレ探索で精度優先。",
                              detail:
                                "Global Precision Mode（精度最優先型）: ROIを使わず画像全域でテンプレート探索を行います。スケールは1.0x中心の外側拡張順（例: 1.0→0.9→1.1...）で全探索し、クリック検出と同じ重み（raw/shape）で確信度を算出します。処理は重いですが精度を優先します。",
                              recommend: "推奨 0.8以上",
                              accent: "#00897b",
                              bg: "#e0f2f1",
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
                                  padding: "8px 10px",
                                  borderRadius: 10,
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
                                  onChange={() =>
                                    applyAutoMethodDefaults(item.key as AutoMethod)
                                  }
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "minmax(0, 1fr) auto",
                                      alignItems: "center",
                                      columnGap: 6,
                                      width: "100%",
                                    }}
                                  >
                                    <span style={{ fontWeight: 700, color: item.accent, minWidth: 0 }}>
                                      {item.label}
                                    </span>
                                    <span
                                      className="badge"
                                      style={{
                                        justifySelf: "end",
                                        whiteSpace: "nowrap",
                                        borderColor: "#a5d6a7",
                                        background: "#e8f5e9",
                                        color: "#2e7d32",
                                      }}
                                    >
                                      {item.recommend}
                                    </span>
                                  </div>
                                  <span className="autoMethodHelp" style={{ color: "#666" }}>
                                    {item.help}
                                  </span>
                                </div>
                                <div className="autoMethodTooltip">{item.detail}</div>
                              </label>
                            );
                          })}
                        </div>
                        {autoUsesStride ? (
                          <div className="formRow" style={{ alignItems: "start" }}>
                            <div style={{ display: "grid", gap: 2 }}>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  height: 32,
                                  lineHeight: "32px",
                                }}
                              >
                                探索間隔
                              </span>
                              <span style={{ fontSize: 10, color: "#d32f2f", lineHeight: 1.2 }}>
                                推奨：auto (未入力)
                              </span>
                            </div>
                            <div className="controlWrap" title="±1" style={{ display: "grid", justifyItems: "end", gap: 4 }}>
                              <NumericInputWithButtons
                                value={autoStride ?? ""}
                                onChange={(v) => setAutoStride(v === "" ? null : v)}
                                min={1}
                                step={1}
                                height={32}
                                inputWidth={120}
                                ariaLabel="auto stride"
                                placeholder="Auto / 32"
                                className="noWrapRow"
                                inputClassName={`midInput ${strideDanger ? "dangerInput" : strideWarn ? "warnInput" : ""}`}
                                buttonClassName="stepBtn"
                              />
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                                <span className="badge">推奨 auto / 32–128</span>
                                {strideWarn && !strideDanger && <span className="badge badgeDanger">注意</span>}
                                {strideDanger && <span className="badge badgeDanger">Danger</span>}
                                {typeof autoStride === "number" && autoStride <= 0 && (
                                  <span className="badge badgeDanger">入力が不正です</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div style={{ fontSize: 11, color: "#607d8b" }}>
                          使用パラメータ:
                          {" "}
                          {autoMethod === "combined"
                            ? "確信度閾値 / ROIサイズ / スケール"
                            : autoMethod === "scaled_templates"
                              ? "確信度閾値 / ROIサイズ / スケール / 探索間隔"
                              : "確信度閾値 / スケール"}
                          {!autoUsesRoi ? "（ROI関連は未使用）" : ""}
                        </div>
                    </div>
                  </div>
                )}
            </div>
            <div className="sectionCard confirmedSection" style={{ paddingTop: 4 }}>
              <div className="sectionTitle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0b3954",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  確定アノテーション
                </span>
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
                    confirmedSeriesOptions.map((name, idx) => (
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
                    setAnnotations((prev) => {
                      const removedClasses = new Set(
                        prev
                          .filter((a) => checkedAnnotationIds.includes(a.id))
                          .map((a) => a.class_name)
                      );
                      const next = prev.filter((a) => !checkedAnnotationIds.includes(a.id));
                      syncClassScoreVisibilityForClasses(next, Array.from(removedClasses));
                      syncClassScaleVisibilityForClasses(next, Array.from(removedClasses));
                      return next;
                    });
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
              <div className="confirmedList" ref={confirmedListRef}>
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
                      alignItems: "flex-start",
                      gap: 10,
                      minHeight: 76,
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
                    <div style={{ display: "grid", gap: 4, gridTemplateRows: "auto auto auto" }}>
                      <div
                        style={{
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          minWidth: 0,
                          flexWrap: "nowrap",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 2,
                            background: colorMap[a.class_name] || "#333",
                            display: "inline-block",
                          }}
                        />
                        {editingAnnotationClassId === a.id ? (
                          <select
                            autoFocus
                            value={a.class_name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              changeAnnotationClass(a.id, e.target.value);
                            }}
                            onBlur={() => setEditingAnnotationClassId(null)}
                            style={{
                              height: 24,
                              minWidth: 88,
                              maxWidth: 180,
                              fontSize: 12,
                              flex: "1 1 auto",
                            }}
                          >
                            {asChildren(
                              Array.from(new Set([a.class_name, ...detectionTargetClasses]))
                                .map((name, oidx) => (
                                  <option key={`ann-class-${a.id}-${name}-${oidx}`} value={name}>
                                    {name}
                                  </option>
                                ))
                            )}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAnnotationClassId(a.id);
                            }}
                            title="クリックでシリーズ変更"
                            style={{
                              color: "#0b1f3a",
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              flex: "1 1 auto",
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              margin: 0,
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {a.class_name}
                          </button>
                        )}
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
                        BBox: ({Math.round(a.bbox.x)}, {Math.round(a.bbox.y)}, {Math.round(a.bbox.w)}, {Math.round(a.bbox.h)})
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "nowrap",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10.5,
                          lineHeight: 1.15,
                          color: "var(--muted)",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        <span style={{ flex: "0 0 auto" }}>
                          CONF: {typeof a.score === "number" ? a.score.toFixed(3) : "-"}
                        </span>
                        <span
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            flex: "1 1 auto",
                          }}
                        >
                          , Tpl: {a.template_name || "-"}, Scale:{" "}
                          {typeof a.scale === "number" && Number.isFinite(a.scale)
                            ? a.scale.toFixed(2)
                            : "-"}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", justifySelf: "end" }} />
                    <button
                      type="button"
                      aria-label="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnnotations((prev) => {
                          const next = prev.filter((item) => item.id !== a.id);
                          syncClassScoreVisibilityForClasses(next, [a.class_name]);
                          syncClassScaleVisibilityForClasses(next, [a.class_name]);
                          return next;
                        });
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
                    className="paramSlider"
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
        <div style={{ padding: 16, flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
          <div
            style={{
              position: "relative",
              minHeight: "calc(100vh - 120px)",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.45)",
              boxShadow: "0 14px 38px rgba(17, 33, 51, 0.22)",
              background: "#e8eef6",
            }}
          >
            <div
              style={{
                position: "relative",
                zIndex: 1,
                padding: 22,
              }}
            >
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: "#12385f" }}>Project Home</div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              alignItems: "center",
              padding: 12,
              borderRadius: 12,
              background: "rgba(255,255,255,0.42)",
              border: "1px solid rgba(255,255,255,0.6)",
              backdropFilter: "blur(8px)",
            }}
          >
            <input
              type="text"
              id="project-name-input"
              name="project_name"
              placeholder="project_name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              style={{
                height: 36,
                padding: "0 10px",
                minWidth: 240,
                fontSize: 16,
                borderRadius: 8,
                border: "1px solid rgba(72, 114, 162, 0.42)",
                background: "rgba(255,255,255,0.9)",
              }}
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
                boxShadow: "0 6px 18px rgba(26,115,232,0.24)",
              }}
            >
              新規プロジェクト作成
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {asChildren(projectList.map((p, idx) => (
              <div
                key={`${p.project_name || "project"}-${idx}`}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  void handleProjectCardHoverEnter(p.project_name, {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                  });
                }}
                onMouseLeave={() => {
                  if (hoverProjectStatsTimerRef.current !== null) {
                    window.clearTimeout(hoverProjectStatsTimerRef.current);
                    hoverProjectStatsTimerRef.current = null;
                  }
                }}
                style={{
                  border: "1px solid rgba(255,255,255,0.62)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.48)",
                  backdropFilter: "blur(9px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  boxShadow: "0 8px 22px rgba(21, 40, 64, 0.14)",
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
                      border: "1px solid #d32f2f",
                      background: "#ffebee",
                      color: "#b71c1c",
                      fontWeight: 700,
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
          {hoverProjectStatsAnchor && (
            <div
              style={{
                position: "fixed",
                left:
                  projectStatsPopupPos?.left ??
                  getProjectStatsPopupDefaultPos(hoverProjectStatsAnchor).left,
                top:
                  projectStatsPopupPos?.top ??
                  getProjectStatsPopupDefaultPos(hoverProjectStatsAnchor).top,
                width: "min(760px, calc(100vw - 32px))",
                maxHeight: "min(380px, calc(100vh - 32px))",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.38)",
                background:
                  "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(238,247,255,0.10) 52%, rgba(228,242,255,0.08) 100%)",
                boxShadow:
                  "0 24px 60px rgba(9, 18, 34, 0.30), inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -1px 0 rgba(255,255,255,0.14)",
                backdropFilter: "blur(22px) saturate(145%)",
                zIndex: 20,
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: "auto 1fr",
                pointerEvents: "auto",
              }}
            >
              <div
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  const base =
                    projectStatsPopupPos ?? getProjectStatsPopupDefaultPos(hoverProjectStatsAnchor);
                  projectStatsDragRef.current = {
                    active: true,
                    dx: e.clientX - base.left,
                    dy: e.clientY - base.top,
                  };
                  const onMove = (ev: MouseEvent) => {
                    if (!projectStatsDragRef.current.active) return;
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const nextLeft = Math.max(
                      16,
                      Math.min(vw - PROJECT_STATS_POPUP_W - 16, ev.clientX - projectStatsDragRef.current.dx)
                    );
                    const nextTop = Math.max(
                      16,
                      Math.min(vh - PROJECT_STATS_POPUP_H - 16, ev.clientY - projectStatsDragRef.current.dy)
                    );
                    setProjectStatsPopupPos({ left: nextLeft, top: nextTop });
                  };
                  const onUp = () => {
                    projectStatsDragRef.current.active = false;
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.30)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  color: "#111",
                  cursor: "move",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  確定アノテーション統計: {hoverProjectStatsAnchor.projectName}
                </span>
                <span style={{ fontSize: 11 }}>
                  合計: {projectStatsByName[hoverProjectStatsAnchor.projectName]?.total_confirmed ?? 0}
                </span>
                <button
                  type="button"
                  className="btn btnGhost"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setHoverProjectStatsAnchor(null)}
                  style={{
                    height: 24,
                    padding: "0 8px",
                    color: "#111",
                    borderColor: "rgba(0,0,0,0.18)",
                    background: "rgba(255,255,255,0.24)",
                    boxShadow: "none",
                    fontSize: 11,
                  }}
                >
                  閉じる
                </button>
              </div>
              <div
                style={{
                  padding: 10,
                  overflow: "auto",
                  color: "#111",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(235,245,255,0.06) 100%)",
                }}
              >
                {projectStatsLoadingName === hoverProjectStatsAnchor.projectName &&
                !projectStatsByName[hoverProjectStatsAnchor.projectName] ? (
                  <div style={{ fontSize: 12 }}>読み込み中...</div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 11,
                      background: "rgba(255,255,255,0.18)",
                      border: "1px solid rgba(255,255,255,0.28)",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <thead>
                      <tr>
                        {["シリーズ", "確定総数", "BBoxサイズ (W x H)", "確信度", "スケール", "最頻テンプレ"].map((h) => (
                          <th
                            key={`stat-header-${h}`}
                            style={{
                              textAlign: "left",
                              padding: "6px 8px",
                              borderBottom: "1px solid rgba(20,20,20,0.12)",
                              background: "rgba(255,255,255,0.16)",
                              color: "#111",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(projectStatsByName[hoverProjectStatsAnchor.projectName]?.rows || []).map((row) => (
                        <tr key={`stat-row-${hoverProjectStatsAnchor.projectName}-${row.class_name}`}>
                          <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(20,20,20,0.10)" }}>
                            {row.class_name}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid rgba(20,20,20,0.10)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {row.confirmed_count}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid rgba(20,20,20,0.10)",
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {typeof row.bbox_min_w === "number" &&
                            typeof row.bbox_min_h === "number" &&
                            typeof row.bbox_max_w === "number" &&
                            typeof row.bbox_max_h === "number"
                              ? row.confirmed_count <= 1
                                ? `${row.bbox_min_w} × ${row.bbox_min_h}`
                                : `${row.bbox_min_w} × ${row.bbox_min_h} ~ ${row.bbox_max_w} × ${row.bbox_max_h}`
                              : "-"}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid rgba(20,20,20,0.10)",
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {typeof row.score_min === "number" && typeof row.score_max === "number"
                              ? `${row.score_min.toFixed(3)} - ${row.score_max.toFixed(3)}`
                              : "-"}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid rgba(20,20,20,0.10)",
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {typeof row.scale_min === "number" && typeof row.scale_max === "number"
                              ? `${row.scale_min.toFixed(2)} - ${row.scale_max.toFixed(2)}`
                              : "-"}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              borderBottom: "1px solid rgba(20,20,20,0.10)",
                              whiteSpace: "nowrap",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={row.top_template_name || "-"}
                          >
                            {row.top_template_name || "-"}
                          </td>
                        </tr>
                      ))}
                      {(projectStatsByName[hoverProjectStatsAnchor.projectName]?.rows || []).length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: "10px 8px", color: "#333" }}>
                            確定アノテーションがありません。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
            </div>
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
