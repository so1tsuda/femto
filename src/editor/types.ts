export interface EditorSnapshot {
  text: string;
  cursor: number;
  line: number;
  col: number;
  chars: number;
  modified: boolean;
  encoding: string;
  lineEnding: string;
  filePath: string | null;
  statusMessage: string | null;
}

export interface EditorUiContext {
  editor: HTMLTextAreaElement;
  highlight: HTMLElement;
  currentLine: HTMLElement;
  cursorBlock: HTMLElement;
  status: HTMLElement;
  minibuffer: HTMLElement;
  minibufferPrompt: HTMLElement;
  minibufferInput: HTMLTextAreaElement;
  minibufferCandidates: HTMLElement;
}
