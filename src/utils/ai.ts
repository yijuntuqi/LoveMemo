import type { AppSettings } from "../types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function generateMemoryText(
  prompt: string,
  settings: AppSettings,
): Promise<string> {
  const provider = settings.aiProvider || "moonshot";
  const apiKey = settings.aiApiKey;
  const model =
    settings.aiModel ||
    (provider === "moonshot" ? "moonshot-v1-8k" : "gpt-3.5-turbo");
  const baseUrl =
    settings.aiBaseUrl ||
    (provider === "moonshot"
      ? "https://api.moonshot.cn/v1"
      : "https://api.chatanywhere.tech/v1");

  if (!apiKey) {
    throw new Error("请先设置 AI API Key");
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "你是一位温暖细腻的爱情记录助手，擅长根据情侣的照片、地点和故事，生成浪漫、真挚的回忆文案。请用中文回复，语气温柔自然。",
    },
    { role: "user", content: prompt },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI 请求失败: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "生成失败，请重试";
}
