export type UploadResponse = {
  image_id: string;
  width: number;
  height: number;
  filename?: string;
};

export type DetectResult = {
  class_name: string;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };
  template_name: string;
  scale: number;
  contour?: { x: number; y: number }[];
};

export type DetectPointResponse = {
  results: DetectResult[];
  debug?: {
    clicked_image_xy?: { x: number; y: number };
    roi_click_xy?: { x: number; y: number };
    roi_bbox?: { x1: number; y1: number; x2: number; y2: number };
    roi_preview_base64?: string;
    roi_preview_marked_base64?: string;
    roi_edge_preview_base64?: string;
    template_edge_preview_base64?: string;
    match_score?: number;
    match_offset_in_roi?: { x: number; y: number };
    match_mode?: string;
    roi_match_preview_base64?: string;
    outer_bbox?: { x: number; y: number; w: number; h: number };
    tight_bbox?: { x: number; y: number; w: number; h: number };
  };
};

export type Candidate = {
  id: string;
  class_name: string;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };
  template: string;
  scale: number;
  segPolygon?: { x: number; y: number }[];
  segMethod?: "sam" | "fallback";
  source?: "template" | "manual";
};

export type Annotation = {
  id: string;
  class_name: string;
  bbox: { x: number; y: number; w: number; h: number };
  source: "template" | "manual" | "sam";
  created_at: string;
  score?: number;
  segPolygon?: { x: number; y: number }[];
  originalSegPolygon?: { x: number; y: number }[];
  segMethod?: "sam" | "fallback";
};

export function toCandidates(res: DetectPointResponse): Candidate[] {
  const now = Date.now();
  return (res.results || []).map((r, idx) => ({
    id: `${now}-${Math.random()}-${idx}`,
    class_name: r.class_name,
    score: r.score,
    bbox: r.bbox,
    template: r.template_name,
    scale: r.scale,
  }));
}

export type SegmentCandidateRequest = {
  image_id: string;
  bbox: { x: number; y: number; w: number; h: number };
  click?: { x: number; y: number } | null;
  expand?: number;
  simplify_eps?: number;
};

export type SegmentCandidateResponse = {
  ok: boolean;
  polygon?: { x: number; y: number }[];
  bbox?: { x: number; y: number; w: number; h: number };
  meta?: { device: "mps" | "cpu"; method: "sam" | "fallback"; area: number };
  error?: string;
};

export async function segmentCandidate(
  params: SegmentCandidateRequest
): Promise<SegmentCandidateResponse> {
  const res = await fetch(`${API_BASE}/segment/candidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Segment failed");
  }

  return (await res.json()) as SegmentCandidateResponse;
}

export type ExportAnnotation = {
  class_name: string;
  bbox: { x: number; y: number; w: number; h: number };
  segPolygon?: { x: number; y: number }[];
};

export type ExportYoloResponse = {
  ok: boolean;
  saved_path?: string;
  text_preview?: string;
  error?: string;
};

export async function exportYolo(params: {
  project: string;
  image_id: string;
  annotations: ExportAnnotation[];
}): Promise<ExportYoloResponse> {
  const res = await fetch(`${API_BASE}/export/yolo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Export failed");
  }

  return (await res.json()) as ExportYoloResponse;
}

export const API_BASE = "http://127.0.0.1:8000";

export async function uploadImage(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }

  return (await res.json()) as UploadResponse;
}

export async function fetchProjects(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Projects fetch failed");
  }
  return (await res.json()) as string[];
}

export type ProjectTemplates = {
  name: string;
  classes: { class_name: string; count: number }[];
};

export type DatasetImportResponse = {
  project_name: string;
  count: number;
};

export type DatasetInfo = {
  project_name: string;
  images: DatasetImageEntry[];
  total_images: number;
  annotated_images: number;
  bbox_count: number;
  seg_count: number;
  updated_at?: string | null;
};

export type DatasetImageEntry = {
  original_filename: string;
  filename?: string;
  internal_id: string;
  import_order: number;
  width?: number | null;
  height?: number | null;
};

export type AutoAnnotateRequest = {
  image_id: string;
  project: string;
  threshold: number;
  method?: "combined" | "scaled_templates";
  roi_size?: number;
  class_filter?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_steps?: number;
  stride?: number;
  project_name?: string;
  image_key?: string;
};

export type AutoAnnotateResponse = {
  added_count: number;
  rejected_count: number;
  threshold: number;
  created_annotations?: {
    class_name: string;
    bbox: { x: number; y: number; w: number; h: number };
    score: number;
  }[];
  preview_image_url?: string | null;
};

export async function autoAnnotate(
  params: AutoAnnotateRequest
): Promise<AutoAnnotateResponse> {
  const res = await fetch(`${API_BASE}/annotate/auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Auto annotate failed");
  }

  return (await res.json()) as AutoAnnotateResponse;
}

export async function fetchTemplates(): Promise<ProjectTemplates[]> {
  const res = await fetch(`${API_BASE}/templates`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Templates fetch failed");
  }
  return (await res.json()) as ProjectTemplates[];
}

export async function fetchTemplatePreview(
  project: string,
  className: string,
  templateName: string
): Promise<{ base64: string | null }> {
  const res = await fetch(
    `${API_BASE}/templates/${encodeURIComponent(project)}/${encodeURIComponent(
      className
    )}/${encodeURIComponent(templateName)}/preview`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Template preview fetch failed");
  }
  return (await res.json()) as { base64: string | null };
}

export async function clearProjectAnnotations(project_name: string): Promise<{ ok: boolean; deleted: number }> {
  const res = await fetch(`${API_BASE}/annotations/clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Clear annotations failed");
  }
  return (await res.json()) as { ok: boolean; deleted: number };
}

export async function detectPoint(params: {
  image_id: string;
  project: string;
  x: number;
  y: number;
  roi_size: number;
  scale_min: number;
  scale_max: number;
  scale_steps: number;
  score_threshold?: number;
  iou_threshold?: number;
  topk: number;
  template_off?: boolean;
  confirmed_boxes?: { x: number; y: number; w: number; h: number }[];
  exclude_same_class_only?: boolean;
  refine_contour?: boolean;
  confirmed_annotations?: { class_name: string; bbox: { x: number; y: number; w: number; h: number } }[];
  exclude_enabled?: boolean;
  exclude_mode?: "same_class" | "any_class";
  exclude_center?: boolean;
  exclude_iou_threshold?: number;
}): Promise<DetectPointResponse> {
  const res = await fetch(`${API_BASE}/detect/point`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Detect failed");
  }

  return (await res.json()) as DetectPointResponse;
}

export async function exportYoloWithDir(params: {
  project: string;
  image_id: string;
  annotations: Annotation[];
  output_dir: string;
  project_name?: string | null;
  image_key?: string | null;
}): Promise<ExportYoloResponse> {
  const payload = {
    project: params.project,
    image_id: params.image_id,
    annotations: params.annotations,
    output_dir: params.output_dir,
    project_name: params.project_name || undefined,
    image_key: params.image_key || undefined,
  };
  const res = await fetch(`${API_BASE}/export/yolo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Export failed");
  }
  return (await res.json()) as ExportYoloResponse;
}

export async function importDataset(params: {
  project_name: string;
  files: File[];
}): Promise<DatasetImportResponse> {
  const form = new FormData();
  form.append("project_name", params.project_name);
  params.files.forEach((file) => {
    form.append("files", file);
  });
  const res = await fetch(`${API_BASE}/dataset/import`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Dataset import failed");
  }
  return (await res.json()) as DatasetImportResponse;
}

export async function fetchDataset(projectName: string): Promise<DatasetInfo> {
  const res = await fetch(`${API_BASE}/dataset/${projectName}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Dataset fetch failed");
  }
  return (await res.json()) as DatasetInfo;
}

export async function selectDatasetImage(params: {
  project_name: string;
  filename: string;
}): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/dataset/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Dataset select failed");
  }
  return (await res.json()) as UploadResponse;
}

export async function saveAnnotations(params: {
  project_name: string;
  image_key: string;
  annotations: Annotation[];
}): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/annotations/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Save annotations failed");
  }
  return (await res.json()) as { ok: boolean };
}

export async function loadAnnotations(params: {
  project_name: string;
  image_key: string;
}): Promise<{ ok: boolean; annotations: Annotation[] }> {
  const url = new URL(`${API_BASE}/annotations/load`);
  url.searchParams.set("project_name", params.project_name);
  url.searchParams.set("image_key", params.image_key);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Load annotations failed");
  }
  return (await res.json()) as { ok: boolean; annotations: Annotation[] };
}

export async function exportDatasetBBox(params: {
  project_name: string;
  project: string;
  split_train: number;
  split_val: number;
  split_test: number;
  seed: number;
  include_negatives: boolean;
  output_dir: string;
}): Promise<{ ok: boolean; output_dir?: string; export_id?: string; counts?: { train: number; val: number; test: number }; error?: string }> {
  const res = await fetch(`${API_BASE}/export/dataset/bbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Dataset export failed");
  }
  return (await res.json()) as { ok: boolean; output_dir?: string; export_id?: string; counts?: { train: number; val: number; test: number }; error?: string };
}

export async function exportDatasetSeg(params: {
  project_name: string;
  project: string;
  split_train: number;
  split_val: number;
  split_test: number;
  seed: number;
  output_dir: string;
}): Promise<{ ok: boolean; output_dir?: string; export_id?: string; counts?: { train: number; val: number; test: number }; error?: string }> {
  const res = await fetch(`${API_BASE}/export/dataset/seg`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Dataset export failed");
  }
  return (await res.json()) as { ok: boolean; output_dir?: string; export_id?: string; counts?: { train: number; val: number; test: number }; error?: string };
}

export async function listDatasetProjects(): Promise<DatasetInfo[]> {
  const res = await fetch(`${API_BASE}/dataset/projects`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Project list failed");
  }
  return (await res.json()) as DatasetInfo[];
}

export async function createDatasetProject(project_name: string): Promise<DatasetInfo> {
  const res = await fetch(`${API_BASE}/dataset/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Project create failed");
  }
  return (await res.json()) as DatasetInfo;
}

export async function deleteDatasetProject(project_name: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/dataset/projects/${encodeURIComponent(project_name)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Project delete failed");
  }
  return (await res.json()) as { ok: boolean };
}
