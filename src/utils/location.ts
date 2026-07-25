export interface LocationResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

/**
 * 使用 Nominatim（OpenStreetMap 免费地理编码服务）搜索地点。
 * 无需 API Key，但有使用限制：每秒 1 次请求，请合理使用。
 */
export async function searchLocation(query: string): Promise<LocationResult[]> {
  if (!query.trim()) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "zh-CN,zh,en");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "LoveMemo/1.0 (lovememo.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`地点搜索失败: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map((item: any) => ({
    name: item.name || item.display_name?.split(",")[0] || query.trim(),
    displayName: item.display_name || item.name || query.trim(),
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
  }));
}
