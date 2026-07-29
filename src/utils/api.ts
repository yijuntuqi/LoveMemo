import { fetch } from "./http";
import type { AppSettings, AuthResponse, UserInfo } from "../types";

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

export async function register(
  settings: AppSettings,
  phone: string,
  password: string,
  email?: string,
): Promise<AuthResponse> {
  const res = await fetch(`${getServerUrl(settings)}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password, email: email || undefined }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "注册失败");
  return data;
}

export async function login(
  settings: AppSettings,
  phone: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${getServerUrl(settings)}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "登录失败");
  return data;
}

export async function fetchUserInfo(settings: AppSettings): Promise<UserInfo> {
  const res = await fetch(`${getServerUrl(settings)}/auth/me`, {
    headers: getHeaders(settings),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "获取用户信息失败");
  return data;
}

export async function activateMembership(
  settings: AppSettings,
  code: string,
): Promise<UserInfo> {
  const res = await fetch(`${getServerUrl(settings)}/membership/activate`, {
    method: "POST",
    headers: getHeaders(settings),
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "激活失败");
  return data;
}

export interface GeocodeResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
}

export async function searchLocation(
  settings: AppSettings,
  address: string,
): Promise<GeocodeResponse> {
  const res = await fetch(
    `${getServerUrl(settings)}/map/geocode?address=${encodeURIComponent(address)}`,
    {
      headers: getHeaders(settings),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "搜索地点失败");
  return data;
}
