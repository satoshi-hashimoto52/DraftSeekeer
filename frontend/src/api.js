export function toCandidates(res) {
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
export async function segmentCandidate(params) {
    const res = await fetch(`${API_BASE}/segment/candidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Segment failed");
    }
    return (await res.json());
}
export async function exportYolo(params) {
    const res = await fetch(`${API_BASE}/export/yolo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Export failed");
    }
    return (await res.json());
}
export const API_BASE = "http://127.0.0.1:8000";
export async function uploadImage(file) {
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
    return (await res.json());
}
export async function fetchProjects() {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Projects fetch failed");
    }
    return (await res.json());
}
export async function autoAnnotate(params) {
    const res = await fetch(`${API_BASE}/annotate/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Auto annotate failed");
    }
    return (await res.json());
}
export async function fetchTemplates() {
    const res = await fetch(`${API_BASE}/templates`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Templates fetch failed");
    }
    return (await res.json());
}
export async function fetchTemplatePreview(project, className, templateName) {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(project)}/${encodeURIComponent(className)}/${encodeURIComponent(templateName)}/preview`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Template preview fetch failed");
    }
    return (await res.json());
}
export async function clearProjectAnnotations(project_name) {
    const res = await fetch(`${API_BASE}/annotations/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Clear annotations failed");
    }
    return (await res.json());
}
export async function detectPoint(params) {
    const res = await fetch(`${API_BASE}/detect/point`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Detect failed");
    }
    return (await res.json());
}
export async function exportYoloWithDir(params) {
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
    return (await res.json());
}
export async function importDataset(params) {
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
    return (await res.json());
}
export async function fetchDataset(projectName) {
    const res = await fetch(`${API_BASE}/dataset/${projectName}`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Dataset fetch failed");
    }
    return (await res.json());
}
export async function selectDatasetImage(params) {
    const res = await fetch(`${API_BASE}/dataset/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Dataset select failed");
    }
    return (await res.json());
}
export async function saveAnnotations(params) {
    const res = await fetch(`${API_BASE}/annotations/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Save annotations failed");
    }
    return (await res.json());
}
export async function loadAnnotations(params) {
    const url = new URL(`${API_BASE}/annotations/load`);
    url.searchParams.set("project_name", params.project_name);
    url.searchParams.set("image_key", params.image_key);
    const res = await fetch(url.toString());
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Load annotations failed");
    }
    return (await res.json());
}
export async function exportDatasetBBox(params) {
    const res = await fetch(`${API_BASE}/export/dataset/bbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Dataset export failed");
    }
    return (await res.json());
}
export async function exportDatasetSeg(params) {
    const res = await fetch(`${API_BASE}/export/dataset/seg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Dataset export failed");
    }
    return (await res.json());
}
export async function listDatasetProjects() {
    const res = await fetch(`${API_BASE}/dataset/projects`);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Project list failed");
    }
    return (await res.json());
}
export async function createDatasetProject(project_name) {
    const res = await fetch(`${API_BASE}/dataset/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Project create failed");
    }
    return (await res.json());
}
export async function deleteDatasetProject(project_name) {
    const res = await fetch(`${API_BASE}/dataset/projects/${encodeURIComponent(project_name)}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Project delete failed");
    }
    return (await res.json());
}
