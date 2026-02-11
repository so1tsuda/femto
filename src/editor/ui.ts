import type { EditorSnapshot, EditorUiContext } from "./types";
import { highlightText } from "./syntax";

const FONT_SIZE_KEY = "femto.editor.fontSizePx";
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;
const RECENTER_STATE = new WeakMap<HTMLTextAreaElement, number>();

function buildBaseStatus(snapshot: EditorSnapshot): string {
  const modified = snapshot.modified ? "Modified" : "Saved";
  const fileLabel = snapshot.filePath ?? "No File";
  const message = snapshot.statusMessage ? `  |  ${snapshot.statusMessage}` : "";
  return `L:${snapshot.line} C:${snapshot.col}  |  ${snapshot.chars} chars  |  ${snapshot.encoding} (${snapshot.lineEnding})  |  ${modified}  |  ${fileLabel}${message}`;
}

export function renderSnapshot(
  ctx: EditorUiContext,
  snapshot: EditorSnapshot,
  statusOverride?: string,
): void {
  if (ctx.editor.value !== snapshot.text) {
    ctx.editor.value = snapshot.text;
  }
  ctx.editor.selectionStart = snapshot.cursor;
  ctx.editor.selectionEnd = snapshot.cursor;
  ensureCursorVisible(ctx, snapshot.line);
  syncOverlayScroll(ctx);
  updateCurrentLine(ctx, snapshot.cursor);
  updateCursorBlock(ctx);
  ctx.highlight.innerHTML = highlightText(snapshot.text, snapshot.filePath);

  ctx.status.textContent = statusOverride ?? buildBaseStatus(snapshot);
}

export function initializeEditorView(ctx: EditorUiContext): void {
  const saved = Number.parseInt(window.localStorage.getItem(FONT_SIZE_KEY) ?? "", 10);
  const size = Number.isFinite(saved) ? clampFontSize(saved) : DEFAULT_FONT_SIZE;
  applyEditorFontSize(size);

  const refreshCursor = (): void => {
    syncOverlayScroll(ctx);
    updateCurrentLine(ctx, ctx.editor.selectionEnd);
    updateCursorBlock(ctx);
  };

  ctx.editor.addEventListener("scroll", refreshCursor);
  ctx.editor.addEventListener("click", refreshCursor);
  ctx.editor.addEventListener("mouseup", refreshCursor);
  ctx.editor.addEventListener("keyup", refreshCursor);
  ctx.editor.addEventListener("focus", refreshCursor);
  ctx.editor.addEventListener("blur", refreshCursor);
}

export function adjustEditorFontSize(delta: number): number {
  const current = getEditorFontSize();
  const next = clampFontSize(current + delta);
  applyEditorFontSize(next);
  window.localStorage.setItem(FONT_SIZE_KEY, String(next));
  return next;
}

export function recenterTopBottom(ctx: EditorUiContext): "center" | "top" | "bottom" {
  const prev = RECENTER_STATE.get(ctx.editor) ?? 2;
  const next = (prev + 1) % 3;
  RECENTER_STATE.set(ctx.editor, next);

  const { top: caretTopRel, lineHeight } = measureCaretPosition(ctx.editor);
  const caretY = caretTopRel + ctx.editor.scrollTop;
  const viewportHeight = ctx.editor.clientHeight;

  let target = 0;
  let mode: "center" | "top" | "bottom" = "center";
  if (next === 0) {
    target = caretY - viewportHeight / 2 + lineHeight / 2;
    mode = "center";
  } else if (next === 1) {
    target = caretY;
    mode = "top";
  } else {
    target = caretY - viewportHeight + lineHeight;
    mode = "bottom";
  }

  const maxScroll = Math.max(0, ctx.editor.scrollHeight - viewportHeight);
  ctx.editor.scrollTop = Math.max(0, Math.min(maxScroll, target));
  syncOverlayScroll(ctx);
  updateCursorBlock(ctx);
  return mode;
}

export function moveCursorByVisualLine(ctx: EditorUiContext, direction: -1 | 1): number {
  const editor = ctx.editor;
  const textLength = editor.value.length;
  const current = editor.selectionEnd;
  const currentPos = measureCaretPositionAt(editor, current);
  const epsilon = 0.5;

  const measurer = createCaretMeasurer(editor);
  const cache = new Map<number, { top: number; left: number; lineHeight: number }>();
  const measure = (cursor: number): { top: number; left: number; lineHeight: number } => {
    const clamped = Math.max(0, Math.min(textLength, cursor));
    const cached = cache.get(clamped);
    if (cached) {
      return cached;
    }
    const measured = measurer(clamped);
    cache.set(clamped, measured);
    return measured;
  };

  let target = current;

  if (direction > 0) {
    let idx = current + 1;
    while (idx <= textLength && measure(idx).top <= currentPos.top + epsilon) {
      idx += 1;
    }
    if (idx <= textLength) {
      const targetTop = measure(idx).top;
      let best = idx;
      let bestDx = Math.abs(measure(idx).left - currentPos.left);
      idx += 1;
      while (idx <= textLength && Math.abs(measure(idx).top - targetTop) <= epsilon) {
        const dx = Math.abs(measure(idx).left - currentPos.left);
        if (dx < bestDx) {
          bestDx = dx;
          best = idx;
        }
        idx += 1;
      }
      target = best;
    }
  } else {
    let idx = current - 1;
    while (idx >= 0 && measure(idx).top >= currentPos.top - epsilon) {
      idx -= 1;
    }
    if (idx >= 0) {
      const targetTop = measure(idx).top;
      let rowStart = idx;
      while (rowStart - 1 >= 0 && Math.abs(measure(rowStart - 1).top - targetTop) <= epsilon) {
        rowStart -= 1;
      }
      let best = rowStart;
      let bestDx = Math.abs(measure(rowStart).left - currentPos.left);
      let j = rowStart + 1;
      while (j <= idx) {
        const dx = Math.abs(measure(j).left - currentPos.left);
        if (dx < bestDx) {
          bestDx = dx;
          best = j;
        }
        j += 1;
      }
      target = best;
    }
  }

  measurer.dispose();
  return target;
}

function ensureCursorVisible(ctx: EditorUiContext, _line: number): void {
  const { top: caretTopRel, lineHeight } = measureCaretPosition(ctx.editor);
  const paddingTop = Number.parseFloat(getComputedStyle(ctx.editor).paddingTop) || 0;
  const caretTop = caretTopRel + ctx.editor.scrollTop;
  const caretBottom = caretTop + lineHeight;

  const viewTop = ctx.editor.scrollTop;
  const viewBottom = viewTop + ctx.editor.clientHeight;
  const lowerBound = viewBottom - paddingTop;
  const upperBound = viewTop + paddingTop;

  if (caretBottom > lowerBound) {
    ctx.editor.scrollTop = Math.max(0, caretBottom - ctx.editor.clientHeight + paddingTop);
  } else if (caretTop < upperBound) {
    ctx.editor.scrollTop = Math.max(0, caretTop - paddingTop);
  }
}

function syncOverlayScroll(ctx: EditorUiContext): void {
  ctx.highlight.scrollTop = ctx.editor.scrollTop;
  ctx.highlight.scrollLeft = ctx.editor.scrollLeft;
}

function updateCurrentLine(ctx: EditorUiContext, _cursorIndex: number): void {
  const enabled = document.documentElement.getAttribute("data-current-line") !== "off";
  if (!enabled) {
    ctx.currentLine.style.display = "none";
    return;
  }

  const { top, lineHeight } = measureCaretPosition(ctx.editor);

  ctx.currentLine.style.display = "block";
  ctx.currentLine.style.transform = `translateY(${top}px)`;
  ctx.currentLine.style.height = `${lineHeight}px`;
}

function updateCursorBlock(ctx: EditorUiContext): void {
  const { top, left, lineHeight } = measureCaretPosition(ctx.editor);
  const fontSize = Number.parseFloat(getComputedStyle(ctx.editor).fontSize) || 14;
  const width = Math.max(8, Math.round(fontSize * 0.62));

  ctx.cursorBlock.style.transform = `translate(${left}px, ${top}px)`;
  ctx.cursorBlock.style.width = `${width}px`;
  ctx.cursorBlock.style.height = `${lineHeight}px`;
  ctx.cursorBlock.style.display = document.activeElement === ctx.editor ? "block" : "none";
}

function measureCaretPosition(editor: HTMLTextAreaElement): { top: number; left: number; lineHeight: number } {
  return measureCaretPositionAt(editor, editor.selectionEnd);
}

function measureCaretPositionAt(editor: HTMLTextAreaElement, cursor: number): { top: number; left: number; lineHeight: number } {
  const measurer = createCaretMeasurer(editor);
  const measured = measurer(cursor);
  measurer.dispose();
  return measured;
}

function createCaretMeasurer(editor: HTMLTextAreaElement): ((cursor: number) => { top: number; left: number; lineHeight: number }) & { dispose: () => void } {
  const style = getComputedStyle(editor);
  const mirror = document.createElement("div");
  const rect = editor.getBoundingClientRect();

  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.width = `${editor.clientWidth}px`;
  mirror.style.height = `${editor.clientHeight}px`;
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.tabSize = style.tabSize;

  document.body.appendChild(mirror);
  const lineHeight = Number.parseFloat(style.lineHeight) || 22;
  const value = editor.value;

  const measure = ((cursor: number): { top: number; left: number; lineHeight: number } => {
    const clamped = Math.max(0, Math.min(value.length, cursor));
    mirror.textContent = value.slice(0, clamped);
    const span = document.createElement("span");
    span.textContent = "\u200b";
    mirror.appendChild(span);
    const spanRect = span.getBoundingClientRect();
    const top = spanRect.top - rect.top - editor.scrollTop;
    const left = spanRect.left - rect.left - editor.scrollLeft;
    return { top, left, lineHeight };
  }) as ((cursor: number) => { top: number; left: number; lineHeight: number }) & { dispose: () => void };

  measure.dispose = (): void => {
    mirror.remove();
  };

  return measure;
}

function getEditorFontSize(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--editor-font-size").trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_FONT_SIZE;
}

function clampFontSize(value: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, value));
}

function applyEditorFontSize(value: number): void {
  document.documentElement.style.setProperty("--editor-font-size", `${value}px`);
}
