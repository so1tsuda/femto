import "./styles/main.css";
import { listen } from "@tauri-apps/api/event";
import { loadAndApplyAppConfig } from "./editor/config";
import { initializeEditor, openFile } from "./editor/commands";
import { bindEditorKeys } from "./editor/keybindings";
import { initializeEditorView, renderSnapshot } from "./editor/ui";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <main class="layout">
    <div class="editor-stack">
      <pre id="highlight" class="highlight" aria-hidden="true"></pre>
      <div id="cursor-block" class="cursor-block" aria-hidden="true"></div>
      <textarea id="editor" wrap="off" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    </div>
    <div id="minibuffer" class="minibuffer hidden">
      <span id="minibuffer-prompt" class="minibuffer-prompt"></span>
      <textarea id="minibuffer-input" class="minibuffer-input" rows="1"></textarea>
      <div id="minibuffer-candidates" class="minibuffer-candidates hidden"></div>
    </div>
    <div id="status" class="status"></div>
  </main>
`;

const editor = document.querySelector<HTMLTextAreaElement>("#editor");
const highlight = document.querySelector<HTMLPreElement>("#highlight");
const cursorBlock = document.querySelector<HTMLDivElement>("#cursor-block");
const minibuffer = document.querySelector<HTMLDivElement>("#minibuffer");
const minibufferPrompt = document.querySelector<HTMLSpanElement>("#minibuffer-prompt");
const minibufferInput = document.querySelector<HTMLTextAreaElement>("#minibuffer-input");
const minibufferCandidates = document.querySelector<HTMLDivElement>("#minibuffer-candidates");
const status = document.querySelector<HTMLDivElement>("#status");

if (!editor || !highlight || !cursorBlock || !minibuffer || !minibufferPrompt || !minibufferInput || !minibufferCandidates || !status) {
  throw new Error("Missing editor UI");
}

const ctx = { editor, highlight, cursorBlock, minibuffer, minibufferPrompt, minibufferInput, minibufferCandidates, status };
initializeEditorView(ctx);
bindEditorKeys(ctx);

let editorReady = false;
let pendingOpenPath: string | null = null;

listen<string>("open-file", (event) => {
  if (!editorReady) {
    pendingOpenPath = event.payload;
    return;
  }
  openFile(event.payload)
    .then((snapshot) => renderSnapshot(ctx, snapshot))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Open file error: ${message}`;
    });
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  status.textContent = `Event error: ${message}`;
});

loadAndApplyAppConfig()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `Config load error: ${message}`;
  })
  .finally(() => {
    initializeEditor().then((snapshot) => {
      renderSnapshot(ctx, snapshot);
      editorReady = true;
      if (pendingOpenPath) {
        const path = pendingOpenPath;
        pendingOpenPath = null;
        openFile(path)
          .then((opened) => renderSnapshot(ctx, opened))
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            status.textContent = `Open file error: ${message}`;
          });
      }
      editor.focus();
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Init error: ${message}`;
    });
  });
