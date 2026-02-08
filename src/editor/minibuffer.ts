import type { EditorUiContext } from "./types";

interface MinibufferOptions {
  trim?: boolean;
  completer?: (value: string) => Promise<string[]>;
}

function moveCursor(input: HTMLTextAreaElement, delta: number): void {
  const start = input.selectionStart;
  const next = Math.max(0, Math.min(input.value.length, start + delta));
  input.selectionStart = next;
  input.selectionEnd = next;
}

function moveByWord(input: HTMLTextAreaElement, direction: -1 | 1): void {
  const value = input.value;
  let pos = input.selectionStart;

  if (direction > 0) {
    while (pos < value.length && /\w/.test(value[pos])) pos += 1;
    while (pos < value.length && /\W/.test(value[pos])) pos += 1;
  } else {
    pos = Math.max(0, pos - 1);
    while (pos > 0 && /\W/.test(value[pos])) pos -= 1;
    while (pos > 0 && /\w/.test(value[pos - 1])) pos -= 1;
  }

  input.selectionStart = pos;
  input.selectionEnd = pos;
}

function deleteForwardChar(input: HTMLTextAreaElement): void {
  const start = input.selectionStart;
  const end = input.selectionEnd;

  if (start !== end) {
    input.setRangeText("", start, end, "start");
    return;
  }

  if (start >= input.value.length) {
    return;
  }

  input.setRangeText("", start, start + 1, "start");
}

function killToLineEnd(input: HTMLTextAreaElement): void {
  const start = input.selectionStart;
  const value = input.value;
  let end = start;

  while (end < value.length && value[end] !== "\n") {
    end += 1;
  }

  input.setRangeText("", start, end, "start");
}

export function promptMinibuffer(
  ctx: EditorUiContext,
  prompt: string,
  initialValue = "",
  options: MinibufferOptions = {},
): Promise<string | null> {
  const trim = options.trim ?? true;
  const completer = options.completer;

  ctx.minibufferPrompt.textContent = prompt;
  ctx.minibufferInput.value = initialValue;
  ctx.minibufferCandidates.innerHTML = "";
  ctx.minibufferCandidates.classList.add("hidden");
  ctx.minibuffer.classList.remove("hidden");
  ctx.minibufferInput.focus();
  ctx.minibufferInput.selectionStart = ctx.minibufferInput.value.length;
  ctx.minibufferInput.selectionEnd = ctx.minibufferInput.value.length;

  return new Promise((resolve) => {
    let quoteNext = false;
    let lastCompletionBase = "";
    let completionCandidates: string[] = [];
    let completionIndex = -1;
    let completionPanelVisible = false;
    let tabPrimed = false;

    const cleanup = (): void => {
      ctx.minibuffer.classList.add("hidden");
      ctx.minibufferCandidates.classList.add("hidden");
      ctx.minibufferCandidates.innerHTML = "";
      ctx.minibufferInput.removeEventListener("keydown", onKeyDown);
      ctx.editor.focus();
    };

    const renderCandidates = (): void => {
      if (!completionPanelVisible || completionCandidates.length <= 1) {
        ctx.minibufferCandidates.classList.add("hidden");
        ctx.minibufferCandidates.innerHTML = "";
        return;
      }

      ctx.minibufferCandidates.classList.remove("hidden");
      ctx.minibufferCandidates.innerHTML = completionCandidates
        .map((candidate, index) => {
          const active = index === completionIndex ? "minibuffer-candidate active" : "minibuffer-candidate";
          return `<span class="${active}">${escapeHtml(candidate)}</span>`;
        })
        .join("");
      const active = ctx.minibufferCandidates.querySelector<HTMLElement>(".minibuffer-candidate.active");
      if (active) {
        active.scrollIntoView({ block: "nearest" });
      }
    };

    const commit = (): void => {
      const raw = ctx.minibufferInput.value;
      const value = trim ? raw.trim() : raw;
      cleanup();
      resolve(value.length > 0 ? value : null);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation();

      const key = event.key.toLowerCase();

      if (quoteNext) {
        quoteNext = false;
        if (event.ctrlKey && key === "j") {
          event.preventDefault();
          const pos = ctx.minibufferInput.selectionStart;
          ctx.minibufferInput.setRangeText("\n", pos, ctx.minibufferInput.selectionEnd, "end");
          return;
        }
      }

      if (event.key === "Tab" && completer) {
        event.preventDefault();

        void (async () => {
          const current = ctx.minibufferInput.value;
          if (current !== lastCompletionBase) {
            completionCandidates = await completer(current);
            completionIndex = -1;
            lastCompletionBase = current;
            completionPanelVisible = false;
            tabPrimed = true;
            renderCandidates();
            return;
          }

          if (completionCandidates.length === 0) {
            completionPanelVisible = false;
            tabPrimed = false;
            renderCandidates();
            return;
          }

          if (tabPrimed) {
            completionPanelVisible = !completionPanelVisible;
            tabPrimed = false;
            renderCandidates();
            return;
          }

          completionPanelVisible = !completionPanelVisible;
          renderCandidates();
        })();
        return;
      }

      if (completionPanelVisible && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        if (completionCandidates.length === 0) {
          return;
        }

        if (event.key === "ArrowDown") {
          if (completionIndex < 0) {
            completionIndex = 0;
          } else {
            completionIndex = (completionIndex + 1) % completionCandidates.length;
          }
        } else if (completionIndex < 0) {
          completionIndex = completionCandidates.length - 1;
        } else {
          completionIndex = (completionIndex - 1 + completionCandidates.length) % completionCandidates.length;
        }

        const selected = completionCandidates[completionIndex];
        ctx.minibufferInput.value = selected;
        ctx.minibufferInput.selectionStart = selected.length;
        ctx.minibufferInput.selectionEnd = selected.length;
        renderCandidates();
        return;
      }

      if (event.ctrlKey && key === "q") {
        event.preventDefault();
        quoteNext = true;
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        commit();
        return;
      }

      if (event.key === "Escape" || (event.ctrlKey && key === "g")) {
        event.preventDefault();
        cleanup();
        resolve(null);
        return;
      }

      if (event.ctrlKey && !event.altKey) {
        if (key === "a") {
          event.preventDefault();
          ctx.minibufferInput.selectionStart = 0;
          ctx.minibufferInput.selectionEnd = 0;
          return;
        }

        if (key === "e") {
          event.preventDefault();
          const len = ctx.minibufferInput.value.length;
          ctx.minibufferInput.selectionStart = len;
          ctx.minibufferInput.selectionEnd = len;
          return;
        }

        if (key === "b") {
          event.preventDefault();
          moveCursor(ctx.minibufferInput, -1);
          return;
        }

        if (key === "f") {
          event.preventDefault();
          moveCursor(ctx.minibufferInput, 1);
          return;
        }

        if (key === "d") {
          event.preventDefault();
          deleteForwardChar(ctx.minibufferInput);
          return;
        }

        if (key === "k") {
          event.preventDefault();
          killToLineEnd(ctx.minibufferInput);
          return;
        }
      }

      if (event.altKey && !event.ctrlKey) {
        if (key === "b") {
          event.preventDefault();
          moveByWord(ctx.minibufferInput, -1);
          return;
        }

        if (key === "f") {
          event.preventDefault();
          moveByWord(ctx.minibufferInput, 1);
          return;
        }
      }

      completionCandidates = [];
      completionIndex = -1;
      lastCompletionBase = "";
      completionPanelVisible = false;
      tabPrimed = false;
      renderCandidates();
    };

    ctx.minibufferInput.addEventListener("keydown", onKeyDown);
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
