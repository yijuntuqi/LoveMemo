import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export async function pickJsonFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
  });
  return selected || null;
}

export async function pickSaveJsonPath(): Promise<string | null> {
  const path = await save({
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
    defaultPath: "lovememo-backup.json",
  });
  return path || null;
}

export async function saveTextFile(path: string, content: string): Promise<void> {
  await invoke("save_text_file", { path, content });
}

export async function readTextFile(path: string): Promise<string> {
  return await invoke("read_text_file", { path });
}
