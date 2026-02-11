import { invoke } from "@tauri-apps/api/core";
import type { EditorSnapshot } from "./types";

export interface QueryReplaceStatus {
  done: boolean;
  replacedCount: number;
  nextLine: number | null;
  nextCol: number | null;
  message: string;
}

export interface QueryReplaceResponse {
  snapshot: EditorSnapshot;
  status: QueryReplaceStatus;
}

export interface ThemeConfig {
  backgroundColor: string | null;
  textColor: string | null;
  cursorColor: string | null;
  selectionBg: string | null;
  currentLineBg: string | null;
  currentLineHighlight: boolean | null;
  statusbarBg: string | null;
  minibufferBg: string | null;
  backgroundImage: string | null;
  fontFamily: string | null;
}

export interface AppConfigResponse {
  theme: ThemeConfig;
  sourcePath: string | null;
}

export async function initializeEditor(): Promise<EditorSnapshot> {
  return invoke<EditorSnapshot>("initialize_editor");
}

export async function runEditorCommand(command: string, payload?: unknown): Promise<EditorSnapshot> {
  return invoke<EditorSnapshot>("editor_command", { command, payload });
}

export async function openFile(path: string): Promise<EditorSnapshot> {
  return invoke<EditorSnapshot>("open_file", { path });
}

export async function saveFile(): Promise<EditorSnapshot> {
  return invoke<EditorSnapshot>("save_file");
}

export async function saveFileAs(path: string): Promise<EditorSnapshot> {
  return invoke<EditorSnapshot>("save_file_as", { path, overwrite: true });
}

export async function saveFileAsWithOverwrite(path: string, overwrite: boolean): Promise<EditorSnapshot> {
  return invoke<EditorSnapshot>("save_file_as", { path, overwrite });
}

export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>("file_exists", { path });
}

export async function defaultSaveDirectory(): Promise<string> {
  return invoke<string>("default_save_directory");
}

export async function pathCompletions(input: string): Promise<string[]> {
  return invoke<string[]>("path_completions", { input });
}

export async function loadAppConfig(): Promise<AppConfigResponse> {
  return invoke<AppConfigResponse>("load_app_config");
}

export async function startQueryReplace(query: string, replaceWith: string): Promise<QueryReplaceResponse> {
  return invoke<QueryReplaceResponse>("start_query_replace", { payload: { query, replaceWith } });
}

export async function queryReplaceStep(action: "y" | "n" | "!" | "q"): Promise<QueryReplaceResponse> {
  return invoke<QueryReplaceResponse>("query_replace_step", { payload: { action } });
}

export interface BufferListResponse {
  names: string[];
  current: string;
  defaultSwitch: string;
}

export async function switchBuffer(name: string): Promise<EditorSnapshot> {
  return invoke<EditorSnapshot>("switch_buffer", { name });
}

export async function listBuffers(): Promise<BufferListResponse> {
  return invoke<BufferListResponse>("list_buffers");
}
