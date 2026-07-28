import { fetch } from "./http";
import type { AppSettings, UserInfo } from "../types";

function getServerUrl(settings: AppSettings): string {
  return (settings.serverUrl || "http://localhost:3000").replace(/\/$/, "");
}

function getHeaders(settings: AppSettings): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (settings.authToken) {
    headers["Authorization"] = `Bearer ${settings.authToken}`;
  }
  return headers;
}

export function isPremiumUser(settings: AppSettings): boolean {
  // 本地缓存的用户信息以 JSON 字符串存于 settings 中
  const raw = settings._userInfo;
  if (!raw) return false;
  try {
    const user: UserInfo = JSON.parse(raw);
    if (user.membership_type !== "premium") return false;
    if (user.membership_expires_at && new Date(user.membership_expires_at) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function polishText(
  content: string,
  settings: AppSettings,
): Promise<string> {
  const res = await fetch(`${getServerUrl(settings)}/ai/polish`, {
    method: "POST",
    headers: getHeaders(settings),
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI 润色失败");
  return data.result;
}

export async function generateMemoryText(
  prompt: string,
  settings: AppSettings,
): Promise<string> {
  const systemPrompt =
    "你是一位温暖细腻的爱情记录助手，擅长根据情侣的照片、地点和故事，生成浪漫、真挚的回忆文案。请用中文回复，语气温柔自然。";
  const fullContent = `${systemPrompt}\n\n${prompt}`;
  return await polishText(fullContent, settings);
}
