import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useEffect, useRef } from "react";
const clamp = (value, min, max) => {
    let next = value;
    if (typeof min === "number")
        next = Math.max(min, next);
    if (typeof max === "number")
        next = Math.min(max, next);
    return next;
};
export default function NumericInputWithButtons({ value, onChange, min, max, step = 1, disabled, ariaLabel, inputWidth = 72, minWidth = 0, height = 32, placeholder, className, inputClassName, buttonClassName, }) {
    const holdTimerRef = useRef(null);
    const holdIntervalRef = useRef(null);
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    }, [value]);
    const stopHold = useCallback(() => {
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
        if (!stepStr.includes("."))
            return 0;
        return stepStr.split(".")[1].length;
    })();
    const factor = decimals > 0 ? 10 ** decimals : 1;
    const normalize = (v) => {
        if (decimals === 0)
            return Math.round(v);
        return Math.round(v * factor) / factor;
    };
    const handleInputChange = (event) => {
        const raw = event.target.value;
        if (raw === "") {
            onChange("");
            return;
        }
        const parsed = Number(raw);
        if (Number.isNaN(parsed))
            return;
        onChange(normalize(parsed));
    };
    const handleBlur = () => {
        if (value === "")
            return;
        const clamped = clamp(normalize(value), min, max);
        if (clamped !== value)
            onChange(clamped);
    };
    const applyDelta = (dir) => {
        const currentValue = valueRef.current;
        const base = currentValue === "" ? (typeof min === "number" ? min : 0) : currentValue;
        const next = clamp(normalize(base + step * dir), min, max);
        onChange(next);
    };
    const startHold = (dir) => {
        if (disabled)
            return;
        stopHold();
        applyDelta(dir);
        holdTimerRef.current = window.setTimeout(() => {
            holdIntervalRef.current = window.setInterval(() => {
                applyDelta(dir);
            }, 70);
        }, 320);
    };
    useEffect(() => {
        return () => stopHold();
    }, [stopHold]);
    return (_jsxs("div", { className: className, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }, children: [_jsx("input", { type: "number", value: value, min: min, max: max, step: step, disabled: disabled, "aria-label": ariaLabel, placeholder: placeholder, onChange: handleInputChange, onBlur: handleBlur, onWheel: (e) => e.currentTarget.blur(), style: {
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
                }, className: inputClassName }), _jsx("button", { type: "button", disabled: disabled, style: {
                    width: height,
                    height,
                    borderRadius: 8,
                    border: "1px solid #d0d7de",
                    background: disabled ? "#f5f5f5" : "#fff",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    transition: "background 120ms ease, box-shadow 120ms ease",
                }, className: buttonClassName, onMouseDown: (e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    startHold(-1);
                    (e.currentTarget.style.background = "#f1f5f9");
                }, onMouseUp: (e) => {
                    stopHold();
                    e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
                }, onMouseLeave: (e) => {
                    stopHold();
                    e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
                }, onTouchStart: (e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    startHold(-1);
                }, onTouchEnd: () => stopHold(), onTouchCancel: () => stopHold(), onKeyDown: (e) => {
                    if (disabled)
                        return;
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        applyDelta(-1);
                    }
                }, children: "\u2212" }), _jsx("button", { type: "button", disabled: disabled, style: {
                    width: height,
                    height,
                    borderRadius: 8,
                    border: "1px solid #d0d7de",
                    background: disabled ? "#f5f5f5" : "#fff",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    transition: "background 120ms ease, box-shadow 120ms ease",
                }, className: buttonClassName, onMouseDown: (e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    startHold(1);
                    (e.currentTarget.style.background = "#f1f5f9");
                }, onMouseUp: (e) => {
                    stopHold();
                    e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
                }, onMouseLeave: (e) => {
                    stopHold();
                    e.currentTarget.style.background = disabled ? "#f5f5f5" : "#fff";
                }, onTouchStart: (e) => {
                    if (disabled)
                        return;
                    e.preventDefault();
                    startHold(1);
                }, onTouchEnd: () => stopHold(), onTouchCancel: () => stopHold(), onKeyDown: (e) => {
                    if (disabled)
                        return;
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        applyDelta(1);
                    }
                }, children: "+" })] }));
}
