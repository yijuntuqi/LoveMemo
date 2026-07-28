import { fetch } from "./http";
import type { AppSettings } from "../types";

export interface LocationResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

function getServerUrl(settings: AppSettings): string {
  return (settings.serverUrl || "http://localhost:3000").replace(/\/$/, "");
}

function getHeaders(settings: AppSettings): HeadersInit {
  const headers: HeadersInit = {};
  if (settings.authToken) {
    headers["Authorization"] = `Bearer ${settings.authToken}`;
  }
  return headers;
}

/**
 * 通过后端代理调用高德地图地理编码服务。
 * 高德 Key 由服务端统一管理，前端不暴露密钥。
 */
export async function searchLocation(
  query: string,
  settings: AppSettings,
): Promise<LocationResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({ address: query.trim() });
  const res = await fetch(`${getServerUrl(settings)}/map/geocode?${params.toString()}`, {
    headers: getHeaders(settings),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "地点搜索失败");

  return (data.results || []).map((item: LocationResult) => ({
    name: item.name,
    displayName: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
  }));
}

/**
 * 将十进制度数格式化为带方向的中文坐标字符串。
 * @example 113.5 -> "东经 113.5000°"
 */
export function formatCoordinate(value: string | number | undefined, type: "lat" | "lng"): string {
  if (value === undefined || value === null || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "";
  const direction =
    type === "lat" ? (num >= 0 ? "北纬" : "南纬") : num >= 0 ? "东经" : "西经";
  return `${direction} ${Math.abs(num).toFixed(4)}°`;
}

/**
 * 高德坐标（GCJ-02）转 WGS-84，用于在其他地图（OpenStreetMap/Leaflet）上显示。
 */
export function gcj02ToWgs84(lat: number, lng: number): [number, number] {
  const a = 6378245.0;
  const ee = 0.00669342162296594323;

  function transformLat(lng1: number, lat1: number) {
    let ret =
      -100.0 +
      2.0 * lng1 +
      3.0 * lat1 +
      0.2 * lat1 * lat1 +
      0.1 * lng1 * lat1 +
      0.2 * Math.sqrt(Math.abs(lng1));
    ret +=
      ((20.0 * Math.sin(6.0 * lng1 * Math.PI) +
        20.0 * Math.sin(2.0 * lng1 * Math.PI)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(lat1 * Math.PI) +
        40.0 * Math.sin((lat1 / 3.0) * Math.PI)) *
        2.0) /
      3.0;
    ret +=
      ((160.0 * Math.sin((lat1 / 12.0) * Math.PI) +
        320.0 * Math.sin((lat1 * Math.PI) / 30.0)) *
        2.0) /
      3.0;
    return ret;
  }

  function transformLng(lng1: number, lat1: number) {
    let ret =
      300.0 +
      lng1 +
      2.0 * lat1 +
      0.1 * lng1 * lng1 +
      0.1 * lng1 * lat1 +
      0.1 * Math.sqrt(Math.abs(lng1));
    ret +=
      ((20.0 * Math.sin(6.0 * lng1 * Math.PI) +
        20.0 * Math.sin(2.0 * lng1 * Math.PI)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(lng1 * Math.PI) +
        40.0 * Math.sin((lng1 / 3.0) * Math.PI)) *
        2.0) /
      3.0;
    ret +=
      ((150.0 * Math.sin((lng1 / 12.0) * Math.PI) +
        300.0 * Math.sin((lng1 / 30.0) * Math.PI)) *
        2.0) /
      3.0;
    return ret;
  }

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return [lat - dLat, lng - dLng];
}
