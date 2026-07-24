import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export async function pickMediaFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "媒体文件",
        extensions: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm"],
      },
    ],
  });
  return selected || null;
}

export async function importMedia(sourcePath: string): Promise<string> {
  return await invoke("import_media", { sourcePath });
}

export function getMediaUrl(filePath: string): string {
  return convertFileSrc(filePath);
}

export function isVideo(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  return ["mp4", "mov", "webm"].includes(ext || "");
}
