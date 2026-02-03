import React from "react";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function Toggles({ label, checked, onChange }: Props) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontSize: 12 }}>{label}</span>
    </label>
  );
}
