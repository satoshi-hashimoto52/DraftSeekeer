import React from "react";

export type Candidate = {
  class_name: string;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };
  template_name: string;
  scale: number;
};

type Props = {
  candidates: Candidate[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  colorMap: Record<string, string>;
};

export default function CandidateList({ candidates, selectedIndex, onSelect, colorMap }: Props) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>候補 (TopK)</div>
      {candidates.length === 0 && (
        <div style={{ color: "#666" }}>候補はまだありません。</div>
      )}
      {candidates.map((c, idx) => (
        <div
          key={`${c.class_name}-${idx}`}
          style={{
            padding: "8px 10px",
            marginBottom: 8,
            border: "1px solid #e3e3e3",
            borderRadius: 6,
            background: selectedIndex === idx ? "#fff3f3" : "#fff",
            cursor: "pointer",
          }}
          onClick={() => onSelect(idx)}
        >
          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colorMap[c.class_name] || "#999",
              }}
            />
            {idx + 1}. {c.class_name}
          </div>
          <div style={{ fontSize: 12, color: "#444" }}>score: {c.score.toFixed(4)}</div>
          <div style={{ fontSize: 12, color: "#666" }}>template: {c.template_name}</div>
          <div style={{ fontSize: 12, color: "#666" }}>scale: {c.scale.toFixed(3)}</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            bbox: ({c.bbox.x}, {c.bbox.y}, {c.bbox.w}, {c.bbox.h})
          </div>
        </div>
      ))}
    </div>
  );
}
