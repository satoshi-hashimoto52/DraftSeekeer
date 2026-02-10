import React from "react";

type NumericValue = number | "";

type Props = {
  value: NumericValue;
  onChange: (value: NumericValue) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  inputWidth?: number | string;
  minWidth?: number;
  height?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
};

const clamp = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
};

export default function NumericInputWithButtons({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  ariaLabel,
  inputWidth = 72,
  minWidth = 0,
  height = 32,
  placeholder,
  className,
  inputClassName,
  buttonClassName,
}: Props) {
  const decimals = (() => {
    const stepStr = String(step);
    if (!stepStr.includes(".")) return 0;
    return stepStr.split(".")[1].length;
  })();
  const factor = decimals > 0 ? 10 ** decimals : 1;

  const normalize = (v: number) => {
    if (decimals === 0) return Math.round(v);
    return Math.round(v * factor) / factor;
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === "") {
      onChange("");
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(normalize(parsed));
  };

  const handleBlur = () => {
    if (value === "") return;
    const clamped = clamp(normalize(value), min, max);
    if (clamped !== value) onChange(clamped);
  };

  const applyDelta = (dir: -1 | 1) => {
    const base = value === "" ? (typeof min === "number" ? min : 0) : value;
    const next = clamp(normalize(base + step * dir), min, max);
    onChange(next);
  };

  return (
    <div className={className} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
        style={{
          width: inputWidth,
          minWidth,
          flex: "1 1 auto",
          height,
          padding: "0 8px",
          borderRadius: 6,
          border: "1px solid #d9e2ec",
          background: disabled ? "#f5f5f5" : "#fff",
          color: disabled ? "#888" : "#111",
          appearance: "textfield",
        }}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => applyDelta(-1)}
        disabled={disabled}
        style={{
          width: height,
          height,
          borderRadius: 8,
          border: "1px solid #d0d7de",
          background: disabled ? "#f5f5f5" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 16,
          lineHeight: 1,
          transition: "background 120ms ease, box-shadow 120ms ease",
        }}
        className={buttonClassName}
        onMouseDown={(e) => {
          if (disabled) return;
          (e.currentTarget.style.background = "#f1f5f9");
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
        }}
      >
        −
      </button>
      <button
        type="button"
        onClick={() => applyDelta(1)}
        disabled={disabled}
        style={{
          width: height,
          height,
          borderRadius: 8,
          border: "1px solid #d0d7de",
          background: disabled ? "#f5f5f5" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 16,
          lineHeight: 1,
          transition: "background 120ms ease, box-shadow 120ms ease",
        }}
        className={buttonClassName}
        onMouseDown={(e) => {
          if (disabled) return;
          (e.currentTarget.style.background = "#f1f5f9");
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
        }}
      >
        +
      </button>
    </div>
  );
}
