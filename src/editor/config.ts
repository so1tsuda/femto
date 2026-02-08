import { loadAppConfig } from "./commands";

function setVar(name: string, value: string | null | undefined): void {
  if (!value || value.trim().length === 0) {
    return;
  }
  document.documentElement.style.setProperty(name, value);
}

function normalizeColor(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^[0-9a-fA-F]{3}$/.test(trimmed) || /^[0-9a-fA-F]{6}$/.test(trimmed) || /^[0-9a-fA-F]{8}$/.test(trimmed)) {
    return `#${trimmed}`;
  }

  return trimmed;
}

function toRgbaWithAlpha(value: string, alpha: number): string | null {
  const normalized = normalizeColor(value);
  if (!normalized) {
    return null;
  }

  if (/^rgba\(/i.test(normalized) || /^hsla\(/i.test(normalized)) {
    return normalized;
  }

  const hex8 = normalized.match(/^#([0-9a-fA-F]{8})$/);
  if (hex8) {
    const raw = hex8[1];
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    const a = Number.parseInt(raw.slice(6, 8), 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  const hex6 = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) {
    const raw = hex6[1];
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const hex3 = normalized.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    const raw = hex3[1];
    const r = Number.parseInt(`${raw[0]}${raw[0]}`, 16);
    const g = Number.parseInt(`${raw[1]}${raw[1]}`, 16);
    const b = Number.parseInt(`${raw[2]}${raw[2]}`, 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const parser = document.createElement("canvas").getContext("2d");
  if (!parser) {
    return normalized;
  }
  parser.fillStyle = "#000000";
  parser.fillStyle = normalized;
  const resolved = parser.fillStyle;
  const rgb = resolved.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (!rgb) {
    return normalized;
  }
  const r = Number.parseInt(rgb[1], 10);
  const g = Number.parseInt(rgb[2], 10);
  const b = Number.parseInt(rgb[3], 10);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeBackgroundImage(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("url(")) {
    return trimmed;
  }

  const windowsPath = trimmed.replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(windowsPath)) {
    return `url("file:///${encodeURI(windowsPath)}")`;
  }
  return `url("${trimmed}")`;
}

export async function loadAndApplyAppConfig(): Promise<void> {
  const config = await loadAppConfig();
  const theme = config.theme;

  const bg = normalizeColor(theme.backgroundColor);
  const fg = normalizeColor(theme.textColor);
  setVar("--bg-color", bg);
  setVar("--text-color", fg);
  setVar("--cursor-color", normalizeColor(theme.cursorColor));
  const selection = theme.selectionBg ?? "#264f78";
  setVar("--selection-bg", toRgbaWithAlpha(selection, 0.45));
  setVar("--statusbar-bg", normalizeColor(theme.statusbarBg) ?? bg);
  setVar("--minibuffer-bg", bg);
  setVar("--minibuffer-input-bg", bg);
  setVar("--editor-font-family", theme.fontFamily);

  if (theme.backgroundImage) {
    document.body.style.backgroundImage = normalizeBackgroundImage(theme.backgroundImage);
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
  }
}
