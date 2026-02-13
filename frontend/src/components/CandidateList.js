import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function CandidateList({ candidates, selectedCandidateId, onSelect, colorMap, }) {
    return (_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600, marginBottom: 8 }, children: "\u5019\u88DC (TopK)" }), candidates.length === 0 && (_jsx("div", { style: { color: "#666" }, children: "\u5019\u88DC\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002" })), candidates.map((c, idx) => (_jsxs("div", { style: {
                    padding: "8px 10px",
                    marginBottom: 8,
                    border: "1px solid #e3e3e3",
                    borderRadius: 6,
                    background: selectedCandidateId === c.id ? "#fff3f3" : "#fff",
                    cursor: "pointer",
                }, onClick: () => onSelect(c.id), children: [_jsxs("div", { style: { fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }, children: [_jsx("span", { style: {
                                    display: "inline-block",
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    background: colorMap[c.class_name] || "#999",
                                } }), idx + 1, ". ", c.class_name || "(未選択)", c.source === "manual" && (_jsx("span", { style: {
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 10,
                                    background: "#607d8b",
                                    color: "#fff",
                                }, children: "MANUAL" })), c.segPolygon && (_jsx("span", { style: {
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 10,
                                    background: "#1a73e8",
                                    color: "#fff",
                                }, children: "SEG" }))] }), _jsxs("div", { style: { fontSize: 12, color: "#666", display: "flex", gap: 8 }, children: [_jsxs("span", { children: ["source: ", c.source || "template"] }), _jsxs("span", { children: ["seg: ", c.segPolygon ? "yes" : "no"] })] }), _jsxs("div", { style: { fontSize: 12, color: "#444" }, children: ["score: ", c.score.toFixed(4)] }), _jsxs("div", { style: { fontSize: 12, color: "#666" }, children: ["template: ", c.template] }), _jsxs("div", { style: { fontSize: 12, color: "#666" }, children: ["scale: ", c.scale.toFixed(3)] }), _jsxs("div", { style: { fontSize: 12, color: "#666" }, children: ["bbox: (", c.bbox.x, ", ", c.bbox.y, ", ", c.bbox.w, ", ", c.bbox.h, ")"] })] }, `${c.id || "candidate"}-${idx}`)))] }));
}
