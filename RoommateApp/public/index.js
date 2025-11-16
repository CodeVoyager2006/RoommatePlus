// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container (#root) not found in index.html");
}
const root = createRoot(container);
root.render(<App />);
