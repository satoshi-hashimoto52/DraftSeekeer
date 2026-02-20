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
  stylePreset?: "default" | "joined";
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
  stylePreset = "default",
}: Props) {
  const holdTimerRef = React.useRef<number | null>(null);
  const holdIntervalRef = React.useRef<number | null>(null);
  const valueRef = React.useRef<NumericValue>(value);

  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const stopHold = React.useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

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
    const currentValue = valueRef.current;
    const base = currentValue === "" ? (typeof min === "number" ? min : 0) : currentValue;
    const next = clamp(normalize(base + step * dir), min, max);
    onChange(next);
  };

  const startHold = (dir: -1 | 1) => {
    if (disabled) return;
    stopHold();
    applyDelta(dir);
    holdTimerRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        applyDelta(dir);
      }, 70);
    }, 320);
  };

  React.useEffect(() => {
    return () => stopHold();
  }, [stopHold]);
  const normalizedHeight = 26;
  const normalizedInputWidth = 44;
  const normalizedButtonWidth = 26;
  const unifiedFontSize = 13;
  if (stylePreset === "default") {
    return (
      <div
        className={className}
        style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6, maxWidth: "100%", minWidth: 0 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: normalizedHeight,
            maxWidth: "100%",
            border: "1px solid #9fb3c8",
            borderRadius: 0,
            background: disabled ? "#f5f5f5" : "#f1f1f1",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            disabled={disabled}
            style={{
              width: normalizedButtonWidth,
              height: normalizedHeight,
              border: "none",
              borderRight: "1px solid #c6c6c6",
              background: "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
              color: disabled ? "#bdbdbd" : "#9e9e9e",
              fontSize: unifiedFontSize,
              lineHeight: 1,
              paddingBottom: 1,
              transition: "background 120ms ease",
              touchAction: "manipulation",
            }}
            className={buttonClassName}
            onMouseDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              startHold(-1);
              (e.currentTarget.style.background = "#e9edf2");
            }}
            onMouseUp={(e) => {
              stopHold();
              e.currentTarget.style.background = "transparent";
            }}
            onMouseLeave={(e) => {
              stopHold();
              e.currentTarget.style.background = "transparent";
            }}
            onTouchStart={(e) => {
              if (disabled) return;
              startHold(-1);
            }}
            onTouchEnd={() => stopHold()}
            onTouchCancel={() => stopHold()}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyDelta(-1);
              }
            }}
          >
            −
          </button>
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
              width: normalizedInputWidth,
              minWidth,
              height: normalizedHeight,
              padding: "0 8px",
              border: "none",
              borderRight: "1px solid #c6c6c6",
              background: "transparent",
              color: disabled ? "#888" : "#253b80",
              textAlign: "center",
              fontSize: unifiedFontSize,
              fontWeight: 500,
              outline: "none",
              boxSizing: "border-box",
              appearance: "textfield",
            }}
            className={inputClassName}
          />
          <button
            type="button"
            disabled={disabled}
            style={{
              width: normalizedButtonWidth,
              height: normalizedHeight,
              border: "none",
              background: "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
              color: disabled ? "#bdbdbd" : "#9e9e9e",
              fontSize: unifiedFontSize,
              lineHeight: 1,
              paddingBottom: 1,
              transition: "background 120ms ease",
              touchAction: "manipulation",
            }}
            className={buttonClassName}
            onMouseDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              startHold(1);
              (e.currentTarget.style.background = "#e9edf2");
            }}
            onMouseUp={(e) => {
              stopHold();
              e.currentTarget.style.background = "transparent";
            }}
            onMouseLeave={(e) => {
              stopHold();
              e.currentTarget.style.background = "transparent";
            }}
            onTouchStart={(e) => {
              if (disabled) return;
              startHold(1);
            }}
            onTouchEnd={() => stopHold()}
            onTouchCancel={() => stopHold()}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyDelta(1);
              }
            }}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6, maxWidth: "100%", minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: normalizedHeight,
          maxWidth: "100%",
          border: "1px solid #9fb3c8",
          borderRadius: 0,
          background: disabled ? "#f5f5f5" : "#f1f1f1",
          overflow: "hidden",
        }}
      >
      <button
        type="button"
        disabled={disabled}
        style={{
          width: normalizedButtonWidth,
          height: normalizedHeight,
          border: "none",
          borderRight: "1px solid #c6c6c6",
          background: "transparent",
          cursor: disabled ? "not-allowed" : "pointer",
          color: disabled ? "#bdbdbd" : "#9e9e9e",
          fontSize: unifiedFontSize,
          lineHeight: 1,
          paddingBottom: 1,
          transition: "background 120ms ease",
          touchAction: "manipulation",
        }}
        className={buttonClassName}
        onMouseDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          startHold(-1);
          (e.currentTarget.style.background = "#e9edf2");
        }}
        onMouseUp={(e) => {
          stopHold();
          e.currentTarget.style.background = "transparent";
        }}
        onMouseLeave={(e) => {
          stopHold();
          e.currentTarget.style.background = "transparent";
        }}
        onTouchStart={(e) => {
          if (disabled) return;
          startHold(-1);
        }}
        onTouchEnd={() => stopHold()}
        onTouchCancel={() => stopHold()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            applyDelta(-1);
          }
        }}
      >
        −
      </button>
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
          width: normalizedInputWidth,
          minWidth,
          height: normalizedHeight,
          padding: "0 8px",
          border: "none",
          borderRight: "1px solid #c6c6c6",
          background: "transparent",
          color: disabled ? "#888" : "#253b80",
          textAlign: "center",
          fontSize: unifiedFontSize,
          fontWeight: 500,
          outline: "none",
          boxSizing: "border-box",
          appearance: "textfield",
        }}
        className={inputClassName}
      />
      <button
        type="button"
        disabled={disabled}
        style={{
          width: normalizedButtonWidth,
          height: normalizedHeight,
          border: "none",
          background: "transparent",
          cursor: disabled ? "not-allowed" : "pointer",
          color: disabled ? "#bdbdbd" : "#9e9e9e",
          fontSize: unifiedFontSize,
          lineHeight: 1,
          paddingBottom: 1,
          transition: "background 120ms ease",
          touchAction: "manipulation",
        }}
        className={buttonClassName}
        onMouseDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          startHold(1);
          (e.currentTarget.style.background = "#e9edf2");
        }}
        onMouseUp={(e) => {
          stopHold();
          e.currentTarget.style.background = "transparent";
        }}
        onMouseLeave={(e) => {
          stopHold();
          e.currentTarget.style.background = "transparent";
        }}
        onTouchStart={(e) => {
          if (disabled) return;
          startHold(1);
        }}
        onTouchEnd={() => stopHold()}
        onTouchCancel={() => stopHold()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            applyDelta(1);
          }
        }}
      >
        +
      </button>
      </div>
    </div>
  );
}
