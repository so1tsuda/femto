import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  defaultSaveDirectory,
  fileExists,
  openFile,
  pathCompletions,
  queryReplaceStep,
  runEditorCommand,
  saveFile,
  saveFileAs,
  saveFileAsWithOverwrite,
  startQueryReplace,
} from "./commands";
import { promptMinibuffer } from "./minibuffer";
import { adjustEditorFontSize, recenterTopBottom, renderSnapshot } from "./ui";
import type { EditorSnapshot, EditorUiContext } from "./types";

interface KeyState {
  ctrlXPrefix: boolean;
}

function eventKey(e: KeyboardEvent): string {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

function isQueryReplaceShortcut(event: KeyboardEvent, key: string): boolean {
  const altShiftPercent = event.altKey && event.shiftKey && !event.ctrlKey && key === "%";
  const ctrlAltFive = event.ctrlKey && event.altKey && (key === "5" || key === "%");
  return altShiftPercent || ctrlAltFive;
}

export function bindEditorKeys(ctx: EditorUiContext): void {
  const keyState: KeyState = { ctrlXPrefix: false };
  let composing = false;
  let pendingCompositionText: string | null = null;
  let currentFilePath: string | null = null;
  let defaultDirCache: string | null = null;
  let lastSearchQuery: string | null = null;
  let lastSearchDirection: "forward" | "backward" | null = null;
  let markPosition: number | null = null;

  const renderAndTrack = (
    snapshot: EditorSnapshot,
    statusOverride?: string,
    preserveMarkSelection = false,
  ): void => {
    currentFilePath = snapshot.filePath;
    renderSnapshot(ctx, snapshot, statusOverride);
    if (preserveMarkSelection && markPosition !== null) {
      if (markPosition <= snapshot.cursor) {
        ctx.editor.setSelectionRange(markPosition, snapshot.cursor, "forward");
      } else {
        ctx.editor.setSelectionRange(snapshot.cursor, markPosition, "backward");
      }
    }
  };

  const clearMark = (): void => {
    markPosition = null;
  };

  const renderWithPrefix = async (): Promise<void> => {
    const snapshot = await runEditorCommand("noop");
    const prefix = keyState.ctrlXPrefix ? "C-x-" : undefined;
    renderAndTrack(snapshot, prefix);
  };

  const syncCursorFromDom = async (): Promise<void> => {
    const cursor = ctx.editor.selectionEnd;
    const snapshot = await runEditorCommand("set_cursor", { cursor });
    currentFilePath = snapshot.filePath;
  };

  const regionFromSelection = (): { start: number; end: number } | null => {
    const start = Math.min(ctx.editor.selectionStart, ctx.editor.selectionEnd);
    const end = Math.max(ctx.editor.selectionStart, ctx.editor.selectionEnd);
    if (start === end) {
      if (markPosition !== null) {
        const regionStart = Math.min(markPosition, ctx.editor.selectionEnd);
        const regionEnd = Math.max(markPosition, ctx.editor.selectionEnd);
        if (regionStart !== regionEnd) {
          return { start: regionStart, end: regionEnd };
        }
      }
      return null;
    }
    return { start, end };
  };

  const getDefaultWritePath = async (): Promise<string> => {
    if (currentFilePath) {
      return currentFilePath;
    }

    if (!defaultDirCache) {
      defaultDirCache = await defaultSaveDirectory();
    }

    return defaultDirCache.endsWith("\\") ? defaultDirCache : `${defaultDirCache}\\`;
  };

  const getDefaultFindPath = async (): Promise<string> => {
    if (currentFilePath) {
      const normalized = currentFilePath.replaceAll("/", "\\");
      const lastSep = normalized.lastIndexOf("\\");
      if (lastSep >= 0) {
        return normalized.slice(0, lastSep + 1);
      }
    }
    return getDefaultWritePath();
  };

  const handleCtrlXCommand = async (key: string): Promise<boolean> => {
    if (!keyState.ctrlXPrefix) {
      return false;
    }

    keyState.ctrlXPrefix = false;

    if (key === "f") {
      const path = await promptMinibuffer(ctx, "Find file:", await getDefaultFindPath(), {
        completer: pathCompletions,
      });
      if (!path) {
        await renderWithPrefix();
        return true;
      }
      const snapshot = await openFile(path);
      renderAndTrack(snapshot);
      return true;
    }

    if (key === "s") {
      try {
        const snapshot = await saveFile();
        renderAndTrack(snapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("No file path")) {
          throw error;
        }

        const path = await promptMinibuffer(ctx, "Write file:", await getDefaultWritePath(), {
          completer: pathCompletions,
        });
        if (!path) {
          await renderWithPrefix();
          return true;
        }

        const exists = await fileExists(path);
        if (exists) {
          const yes = window.confirm(`File already exists. Overwrite?\n${path}`);
          if (!yes) {
            await renderWithPrefix();
            return true;
          }
        }

        const snapshot = await saveFileAsWithOverwrite(path, true);
        renderAndTrack(snapshot);
      }
      return true;
    }

    if (key === "w") {
      const path = await promptMinibuffer(ctx, "Write file:", await getDefaultWritePath(), {
        completer: pathCompletions,
      });
      if (!path) {
        await renderWithPrefix();
        return true;
      }

      const exists = await fileExists(path);
      if (exists) {
        const yes = window.confirm(`File already exists. Overwrite?\n${path}`);
        if (!yes) {
          await renderWithPrefix();
          return true;
        }
      }

      const snapshot = await saveFileAs(path);
      renderAndTrack(snapshot);
      return true;
    }

    if (key === "c") {
      const snapshot = await runEditorCommand("noop");
      if (snapshot.modified) {
        const ok = window.confirm("Buffer is modified. Quit without saving?");
        if (!ok) {
          await renderWithPrefix();
          return true;
        }
      }
      await getCurrentWindow().close();
      return true;
    }

    await renderWithPrefix();
    return true;
  };

  const renderError = async (error: unknown): Promise<void> => {
    const fallback = await runEditorCommand("noop");
    const message = error instanceof Error ? error.message : String(error);
    renderAndTrack(fallback, `Error: ${message}`);
  };

  const insertTextCommand = async (text: string): Promise<void> => {
    if (!text) {
      return;
    }
    clearMark();
    const snapshot = await runEditorCommand("insert_text", { text });
    renderAndTrack(snapshot);
  };

  const newlineAndMove = async (): Promise<void> => {
    await syncCursorFromDom();
    await insertTextCommand("\n");
  };

  const openLineKeepCursor = async (): Promise<void> => {
    await syncCursorFromDom();
    const originalCursor = ctx.editor.selectionEnd;
    await runEditorCommand("insert_text", { text: "\n" });
    const snapshot = await runEditorCommand("set_cursor", { cursor: originalCursor });
    renderAndTrack(snapshot);
  };

  const setImePreviewMode = (enabled: boolean): void => {
    if (enabled) {
      ctx.editor.classList.add("ime-composing");
      ctx.highlight.style.opacity = "0.45";
    } else {
      ctx.editor.classList.remove("ime-composing");
      ctx.highlight.style.opacity = "1";
    }
  };

  ctx.editor.addEventListener("compositionstart", () => {
    composing = true;
    pendingCompositionText = null;
    setImePreviewMode(true);
  });

  ctx.editor.addEventListener("compositionend", (event) => {
    composing = false;
    pendingCompositionText = event.data || null;

    queueMicrotask(async () => {
      if (!pendingCompositionText) {
        setImePreviewMode(false);
        return;
      }
      try {
        const committed = pendingCompositionText;
        pendingCompositionText = null;
        await insertTextCommand(committed);
      } catch (error) {
        await renderError(error);
      } finally {
        setImePreviewMode(false);
      }
    });
  });

  ctx.editor.addEventListener("keydown", async (event) => {
    if (event.isComposing) {
      return;
    }

    const key = eventKey(event);

    if (keyState.ctrlXPrefix) {
      event.preventDefault();
      try {
        await handleCtrlXCommand(key);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    const isUndoShortcut = event.ctrlKey && !event.altKey && (
      (key === "/" && !event.shiftKey) || key === "_"
    );
    if (isUndoShortcut) {
      event.preventDefault();
      try {
        clearMark();
        await syncCursorFromDom();
        const snapshot = await runEditorCommand("undo");
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && event.shiftKey && (key === "/" || key === "?")) {
      event.preventDefault();
      try {
        clearMark();
        await syncCursorFromDom();
        const snapshot = await runEditorCommand("redo");
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "k") {
      event.preventDefault();
      try {
        clearMark();
        await syncCursorFromDom();
        const snapshot = await runEditorCommand("kill_line");
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "w") {
      event.preventDefault();
      try {
        const region = regionFromSelection();
        if (!region) {
          const snapshot = await runEditorCommand("noop");
          renderAndTrack(snapshot, "No active region");
          return;
        }
        const snapshot = await runEditorCommand("kill_region", region);
        clearMark();
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (!event.ctrlKey && event.altKey && key === "w") {
      event.preventDefault();
      try {
        const region = regionFromSelection();
        if (!region) {
          const snapshot = await runEditorCommand("noop");
          renderAndTrack(snapshot, "No active region");
          return;
        }
        const snapshot = await runEditorCommand("copy_region", region);
        clearMark();
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "y") {
      event.preventDefault();
      try {
        clearMark();
        await syncCursorFromDom();
        const snapshot = await runEditorCommand("yank");
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "s") {
      event.preventDefault();
      try {
        clearMark();
        let query = lastSearchQuery;
        if (!query || lastSearchDirection !== "forward") {
          query = await promptMinibuffer(ctx, "I-Search forward:", query ?? "", { trim: false });
        }
        if (!query) {
          return;
        }
        await syncCursorFromDom();
        const snapshot = await runEditorCommand("isearch_forward", { query });
        lastSearchQuery = query;
        lastSearchDirection = "forward";
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "r") {
      event.preventDefault();
      try {
        clearMark();
        let query = lastSearchQuery;
        if (!query || lastSearchDirection !== "backward") {
          query = await promptMinibuffer(ctx, "I-Search backward:", query ?? "", { trim: false });
        }
        if (!query) {
          return;
        }
        await syncCursorFromDom();
        const snapshot = await runEditorCommand("isearch_backward", { query });
        lastSearchQuery = query;
        lastSearchDirection = "backward";
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "g") {
      event.preventDefault();
      keyState.ctrlXPrefix = false;
      clearMark();
      const snapshot = await runEditorCommand("keyboard_quit");
      renderAndTrack(snapshot);
      return;
    }

    if (event.ctrlKey && !event.altKey && (key === "m" || key === "Enter")) {
      event.preventDefault();
      try {
        clearMark();
        await newlineAndMove();
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "o") {
      event.preventDefault();
      try {
        clearMark();
        await openLineKeepCursor();
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "l") {
      event.preventDefault();
      try {
        const mode = recenterTopBottom(ctx);
        const snapshot = await runEditorCommand("noop");
        renderAndTrack(snapshot, `Recenter: ${mode}`);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "h") {
      event.preventDefault();
      try {
        clearMark();
        await syncCursorFromDom();
        const snapshot = await runEditorCommand("delete_backward_char");
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === " ") {
      event.preventDefault();
      markPosition = ctx.editor.selectionEnd;
      const snapshot = await runEditorCommand("noop");
      renderAndTrack(snapshot, "Mark set");
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "x") {
      event.preventDefault();
      keyState.ctrlXPrefix = true;
      await renderWithPrefix();
      return;
    }

    if (isQueryReplaceShortcut(event, key)) {
      event.preventDefault();
      try {
        clearMark();
        const query = await promptMinibuffer(ctx, "Replace:", "", { trim: false });
        if (!query) {
          return;
        }

        const replaceWith = await promptMinibuffer(ctx, `Replace ${query} with:`, "", { trim: false });
        if (replaceWith === null) {
          return;
        }

        let response = await startQueryReplace(query, replaceWith);
        renderAndTrack(response.snapshot);

        while (!response.status.done) {
          const line = response.status.nextLine ?? 0;
          const col = response.status.nextCol ?? 0;
          const answerRaw = window.prompt(
            `Replace at L:${line} C:${col}? (y/n/!/q)`,
            "y",
          );
          const answer = (answerRaw ?? "q").trim().toLowerCase();
          const action = answer === "!" ? "!" : answer === "y" || answer === "n" ? answer : "q";
          response = await queryReplaceStep(action);
          renderAndTrack(response.snapshot);
        }
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && (key === "=" || key === "+")) {
      event.preventDefault();
      try {
        clearMark();
        const size = adjustEditorFontSize(1);
        const snapshot = await runEditorCommand("noop");
        renderAndTrack(snapshot, `Font size: ${size}px`);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.ctrlKey && !event.altKey && key === "-") {
      event.preventDefault();
      try {
        clearMark();
        const size = adjustEditorFontSize(-1);
        const snapshot = await runEditorCommand("noop");
        renderAndTrack(snapshot, `Font size: ${size}px`);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    let command: string | undefined;
    if (event.ctrlKey && !event.altKey && key === "a") command = "move_to_line_start";
    if (event.ctrlKey && !event.altKey && key === "e") command = "move_to_line_end";
    if (event.ctrlKey && !event.altKey && key === "f") command = "move_forward";
    if (event.ctrlKey && !event.altKey && key === "b") command = "move_backward";
    if (event.ctrlKey && !event.altKey && key === "n") command = "move_next_line";
    if (event.ctrlKey && !event.altKey && key === "p") command = "move_previous_line";
    if (event.ctrlKey && !event.altKey && key === "d") command = "delete_char";
    if (event.altKey && !event.ctrlKey && key === "f") command = "move_forward_word";
    if (event.altKey && !event.ctrlKey && key === "b") command = "move_backward_word";
    if (event.altKey && !event.ctrlKey && key === "<") command = "move_to_buffer_start";
    if (event.altKey && !event.ctrlKey && key === ">") command = "move_to_buffer_end";
    if (!event.ctrlKey && !event.altKey && key === "Backspace") command = "delete_backward_char";

    if (!command) {
      return;
    }

    event.preventDefault();
    keyState.ctrlXPrefix = false;
    try {
      await syncCursorFromDom();
      const snapshot = await runEditorCommand(command);
      const preserveMarkSelection =
        markPosition !== null && (
          command === "move_to_line_start" ||
          command === "move_to_line_end" ||
          command === "move_forward" ||
          command === "move_backward" ||
          command === "move_next_line" ||
          command === "move_previous_line" ||
          command === "move_forward_word" ||
          command === "move_backward_word" ||
          command === "move_to_buffer_start" ||
          command === "move_to_buffer_end"
        );
      renderAndTrack(snapshot, undefined, preserveMarkSelection);
      if (!preserveMarkSelection) {
        clearMark();
      }
    } catch (error) {
      await renderError(error);
    }
  });

  const syncNoRender = async (): Promise<void> => {
    try {
      await syncCursorFromDom();
    } catch {
      // best effort sync
    }
  };

  ctx.editor.addEventListener("click", () => {
    clearMark();
    void syncNoRender();
  });
  ctx.editor.addEventListener("mouseup", () => {
    clearMark();
    void syncNoRender();
  });

  ctx.editor.addEventListener("beforeinput", async (event) => {
    if (event.inputType === "insertFromComposition" && event.data) {
      event.preventDefault();
      pendingCompositionText = null;
      try {
        await insertTextCommand(event.data);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (event.isComposing || composing) {
      return;
    }

    const inputType = event.inputType;
    if (inputType === "insertLineBreak" || inputType === "insertParagraph") {
      event.preventDefault();
      try {
        const snapshot = await runEditorCommand("insert_text", { text: "\n" });
        renderAndTrack(snapshot);
      } catch (error) {
        await renderError(error);
      }
      return;
    }

    if (inputType === "insertText" && event.data) {
      event.preventDefault();
      try {
        await insertTextCommand(event.data);
      } catch (error) {
        await renderError(error);
      }
    }
  });
}
