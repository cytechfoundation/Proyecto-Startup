// Sistema de paletas del panel (Dashboard + Mi cuenta). Se aplican como
// variables CSS (:root) y persisten en localStorage. Sin dependencias.
export const PALETTES = {
  oceano: {
    name: "Océano",
    bg: "#060B1A", surface: "#0A1230", surface2: "#101B45",
    border: "#1E293B", muted: "#94A3B8", text2: "#CBD5E1",
    accent: "#22D3EE", accent2: "#2563EB", soft: "rgba(34,211,238,.15)",
  },
  esmeralda: {
    name: "Esmeralda",
    bg: "#04120C", surface: "#06231A", surface2: "#0B3527",
    border: "#134E3A", muted: "#8FD6B4", text2: "#D3EDE0",
    accent: "#34D399", accent2: "#059669", soft: "rgba(52,211,153,.15)",
  },
  violeta: {
    name: "Violeta",
    bg: "#0D0716", surface: "#1A0F2E", surface2: "#261647",
    border: "#3B2563", muted: "#B9A8E0", text2: "#E2D9F7",
    accent: "#A78BFA", accent2: "#7C3AED", soft: "rgba(167,139,250,.16)",
  },
  grafito: {
    name: "Grafito ámbar",
    bg: "#0C0C0E", surface: "#17171B", surface2: "#232329",
    border: "#33333B", muted: "#A1A1AA", text2: "#E4E4E7",
    accent: "#FBBF24", accent2: "#D97706", soft: "rgba(251,191,36,.14)",
  },
};

const KEY = "cytech_theme";
const MODE_KEY = "cytech_mode";

export function getThemeId() {
  try {
    const id = localStorage.getItem(KEY);
    if (id && PALETTES[id]) return id;
  } catch { /* noop */ }
  return "oceano";
}

export function applyTheme(id) {
  const p = PALETTES[id] || PALETTES.oceano;
  const root = document.documentElement;
  root.style.setProperty("--t-bg", p.bg);
  root.style.setProperty("--t-surface", p.surface);
  root.style.setProperty("--t-surface2", p.surface2);
  root.style.setProperty("--t-border", p.border);
  root.style.setProperty("--t-muted", p.muted);
  root.style.setProperty("--t-text2", p.text2);
  root.style.setProperty("--t-accent", p.accent);
  root.style.setProperty("--t-accent2", p.accent2);
  root.style.setProperty("--t-accent-soft", p.soft);
  root.setAttribute("data-theme", id);
  try {
    localStorage.setItem(KEY, id);
  } catch { /* noop */ }
}

export function initTheme() {
  applyTheme(getThemeId());
  applyMode(getMode());
}

/** Modo claro/oscuro de la página principal (Landing). */
export function getMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "light" || m === "dark") return m;
  } catch { /* noop */ }
  return "dark";
}

export function applyMode(mode) {
  document.documentElement.setAttribute("data-mode", mode === "light" ? "light" : "dark");
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch { /* noop */ }
}

export function initMode() {
  applyMode(getMode());
}
