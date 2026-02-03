export type UploadResponse = {
  image_id: string;
  width: number;
  height: number;
};

export type DetectResult = {
  class_name: string;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };
  template_name: string;
  scale: number;
};

export type DetectPointResponse = {
  results: DetectResult[];
};

const API_BASE = "http://127.0.0.1:8000";

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

export async function detectPoint(params: {
  image_id: string;
  project: string;
  x: number;
  y: number;
  roi_size: number;
  scale_min: number;
  scale_max: number;
  scale_steps: number;
  topk: number;
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
