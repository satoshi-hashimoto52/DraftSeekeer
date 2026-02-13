import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Toggles({ label, checked, onChange }) {
    return (_jsxs("label", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (e) => onChange(e.target.checked) }), _jsx("span", { style: { fontSize: 12 }, children: label })] }));
}
