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

  const style = getComputedStyle(ctx.editor);
  const lineHeight = Number.parseFloat(style.lineHeight) || 22;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const cursor = ctx.editor.selectionEnd;
  const lineIndex = (ctx.editor.value.slice(0, cursor).match(/\n/g) ?? []).length;
  const caretY = paddingTop + lineIndex * lineHeight;
  const viewportHeight = ctx.editor.clientHeight;

  let target = 0;
  let mode: "center" | "top" | "bottom" = "center";
  if (next === 0) {
    target = caretY - viewportHeight / 2 + lineHeight / 2;
    mode = "center";
  } else if (next === 1) {
    target = caretY - paddingTop;
    mode = "top";
  } else {
    target = caretY - viewportHeight + lineHeight + paddingTop;
    mode = "bottom";
  }

  const maxScroll = Math.max(0, ctx.editor.scrollHeight - viewportHeight);
  ctx.editor.scrollTop = Math.max(0, Math.min(maxScroll, target));
  syncOverlayScroll(ctx);
  updateCursorBlock(ctx);
  return mode;
}

function ensureCursorVisible(ctx: EditorUiContext, line: number): void {
  const style = getComputedStyle(ctx.editor);
  const lineHeight = Number.parseFloat(style.lineHeight) || 22;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const lineIndex = Math.max(0, line - 1);
  const caretTop = paddingTop + lineIndex * lineHeight;
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

function updateCurrentLine(ctx: EditorUiContext, cursorIndex: number): void {
  const enabled = document.documentElement.getAttribute("data-current-line") !== "off";
  if (!enabled) {
    ctx.currentLine.style.display = "none";
    return;
  }

  const style = getComputedStyle(ctx.editor);
  const lineHeight = Number.parseFloat(style.lineHeight) || 22;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const text = ctx.editor.value;
  const cursor = Math.min(Math.max(0, cursorIndex), text.length);
  const lineIndex = (text.slice(0, cursor).match(/\n/g) ?? []).length;
  const top = paddingTop + lineIndex * lineHeight - ctx.editor.scrollTop;

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
  const style = getComputedStyle(editor);
  const mirror = document.createElement("div");
  const rect = editor.getBoundingClientRect();

  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre";
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

  const cursor = editor.selectionEnd;
  mirror.textContent = editor.value.slice(0, cursor);

  const span = document.createElement("span");
  span.textContent = "\u200b";
  mirror.appendChild(span);
  document.body.appendChild(mirror);

  const spanRect = span.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || 22;
  const top = spanRect.top - rect.top - editor.scrollTop;
  const left = spanRect.left - rect.left - editor.scrollLeft;

  mirror.remove();
  return { top, left, lineHeight };
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
