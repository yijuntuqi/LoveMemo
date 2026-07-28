import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * Tauri HTTP 插件封装的 fetch，用于绕过 release 版 WebView2 的混合内容限制。
 * 支持 Web 标准 fetch 的绝大部分选项和 AbortController 超时。
 */
export async function fetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return tauriFetch(input, init);
}
