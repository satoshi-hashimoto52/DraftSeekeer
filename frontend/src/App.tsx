import React, { useEffect, useMemo, useState } from "react";

import { detectPoint, uploadImage, fetchProjects, DetectResult } from "./api";
import ImageCanvas from "./components/ImageCanvas";
import CandidateList from "./components/CandidateList";

const DEFAULT_ROI_SIZE = 200;
const DEFAULT_TOPK = 3;
const DEFAULT_SCALE_MIN = 0.5;
const DEFAULT_SCALE_MAX = 1.5;
const DEFAULT_SCALE_STEPS = 12;

export default function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [project, setProject] = useState<string>("");
  const [roiSize, setRoiSize] = useState<number>(DEFAULT_ROI_SIZE);
  const [topk, setTopk] = useState<number>(DEFAULT_TOPK);
  const [scaleMin, setScaleMin] = useState<number>(DEFAULT_SCALE_MIN);
  const [scaleMax, setScaleMax] = useState<number>(DEFAULT_SCALE_MAX);
  const [scaleSteps, setScaleSteps] = useState<number>(DEFAULT_SCALE_STEPS);
  const [candidates, setCandidates] = useState<DetectResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const bestBBox = useMemo(() => {
    if (!candidates.length) return null;
    const index = selectedIndex ?? 0;
    if (index < 0 || index >= candidates.length) return candidates[0].bbox;
    return candidates[index].bbox;
  }, [candidates, selectedIndex]);

  const activeColor = useMemo(() => {
    if (!candidates.length) return "#ff2b2b";
    const index = selectedIndex ?? 0;
    const target = candidates[index] || candidates[0];
    return colorMap[target.class_name] || "#ff2b2b";
  }, [candidates, selectedIndex, colorMap]);

  useEffect(() => {
    let mounted = true;
    fetchProjects()
      .then((list) => {
        if (!mounted) return;
        setProjects(list);
        if (!project && list.length > 0) {
          setProject(list[0]);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Projects fetch failed");
      });
    return () => {
      mounted = false;
    };
  }, [project]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const res = await uploadImage(file);
      setImageId(res.image_id);
      setImageUrl(URL.createObjectURL(file));
      setCandidates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClickPoint = async (x: number, y: number) => {
    if (!imageId || !project) return;
    setError(null);
    setBusy(true);
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
      });
      setCandidates(res.results || []);
      setSelectedIndex(res.results && res.results.length > 0 ? 0 : null);
      setColorMap((prev) => {
        const next = { ...prev };
        (res.results || []).forEach((r) => {
          if (!next[r.class_name]) {
            next[r.class_name] = randomColor(r.class_name);
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

  return (
    <div style={{ fontFamily: "\"IBM Plex Sans\", system-ui, sans-serif" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Annotator MVP</div>
        <div style={{ fontSize: 12, color: "#666" }}>画像クリックでテンプレ照合</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          padding: 20,
        }}
      >
        <div>
          <div style={{ marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="file" accept="image/*" onChange={handleFileChange} />
              <span style={{ fontSize: 13 }}>画像アップロード</span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>プロジェクト</span>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                style={{ minWidth: 140 }}
              >
                {projects.length === 0 && <option value="">(none)</option>}
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>ROIサイズ</span>
              <input
                type="number"
                min={10}
                value={roiSize}
                step={10}
                onChange={(e) => setRoiSize(Number(e.target.value))}
                style={{ width: 80 }}
              />
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>上位件数</span>
              <input
                type="number"
                min={1}
                value={topk}
                onChange={(e) => setTopk(Number(e.target.value))}
                style={{ width: 60 }}
              />
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>最小スケール</span>
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={scaleMin}
                onChange={(e) => setScaleMin(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>最大スケール</span>
              <input
                type="number"
                step={0.1}
                min={0.1}
                value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>スケール分割数</span>
              <input
                type="number"
                min={1}
                value={scaleSteps}
                onChange={(e) => setScaleSteps(Number(e.target.value))}
                style={{ width: 60 }}
              />
            </label>
          </div>

          {error && (
            <div style={{ marginBottom: 12, color: "#b00020" }}>Error: {error}</div>
          )}

          <ImageCanvas
            imageUrl={imageUrl}
            bbox={bestBBox}
            bboxColor={activeColor}
            onClickPoint={handleClickPoint}
          />
          {busy && <div style={{ marginTop: 10, color: "#666" }}>処理中...</div>}
        </div>

        <div style={{ borderLeft: "1px solid #eee", paddingLeft: 16 }}>
          <CandidateList
            candidates={candidates}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            colorMap={colorMap}
          />
          {Object.keys(colorMap).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>シリーズ配色</div>
              {Object.entries(colorMap).map(([name, color]) => (
                <div
                  key={name}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) =>
                      setColorMap((prev) => ({ ...prev, [name]: e.target.value }))
                    }
                  />
                  <span style={{ fontSize: 12 }}>{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
