import type { AppSettings } from "../types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const AI_PRESETS: Record<string, { baseUrl: string; model: string }> = {
  moonshot: { baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  chatanywhere: {
    baseUrl: "https://api.chatanywhere.tech/v1",
    model: "gpt-3.5-turbo",
  },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-3.5-turbo" },
  azure: { baseUrl: "https://<resource>.openai.azure.com/openai/deployments/<deployment>", model: "gpt-4o" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-1.5-flash" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  siliconflow: { baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct" },
  zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
};

export async function generateMemoryText(
  prompt: string,
  settings: AppSettings,
): Promise<string> {
  const provider = settings.aiProvider || "moonshot";
  const apiKey = (settings.aiApiKey || "").trim();
  const preset = AI_PRESETS[provider];
  const model = settings.aiModel || preset?.model || "moonshot-v1-8k";
  const baseUrl =
    (settings.aiBaseUrl || "").trim() || preset?.baseUrl || "https://api.moonshot.cn/v1";

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

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
    if (response.status === 401) {
      throw new Error(
        `AI 认证失败（401）：请检查 API Key 是否正确，以及当前服务商 "${provider}" 与 Key 是否匹配。`,
      );
    }
    throw new Error(`AI 请求失败: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "生成失败，请重试";
}
