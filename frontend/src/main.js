import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
const rootEl = document.getElementById("root");
if (rootEl) {
    createRoot(rootEl).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
}
