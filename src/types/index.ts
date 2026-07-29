export interface MemoryEvent {
  id: number;
  sync_id?: string;
  title: string;
  content: string;
  date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  tags?: string;
  coverImage?: string;
  showOnMap?: boolean;
  createdAt: string;
  updatedAt: string;
  updated_at?: string;
  deleted?: boolean;
}

export interface MediaItem {
  id: number;
  sync_id?: string;
  eventId: number;
  event_sync_id?: string;
  type: "image" | "video" | "audio";
  path: string;
  thumbnail?: string;
  caption?: string;
  createdAt: string;
  updated_at?: string;
  deleted?: boolean;
}

export interface Anniversary {
  id: number;
  sync_id?: string;
  title: string;
  date: string;
  repeatYearly: boolean;
  repeatType: "none" | "weekly" | "monthly" | "yearly";
  category: AnniversaryCategory;
  icon?: string;
  createdAt: string;
  updated_at?: string;
  deleted?: boolean;
}

export interface AnniversaryWithDays extends Anniversary {
  daysUntil: number;
}

export type AnniversaryCategory =
  | "date"
  | "gift"
  | "travel"
  | "kiss"
  | "wedding"
  | "birthday"
  | "custom";

export interface AiConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppSettings {
  coupleName?: string;
  startDate?: string;
  partnerName?: string;
  myName?: string;
  /** 当前默认使用的 AI 配置 ID */
  aiProvider?: string;
  /** 单条 AI 配置（兼容旧版） */
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
  /** 多条 AI 配置 */
  aiConfigs?: string;
  /** 后端服务地址 */
  serverUrl?: string;
  /** 登录 Token */
  authToken?: string;
  /** 本地缓存的用户信息 JSON */
  _userInfo?: string;
  /** 本地媒体文件保存路径 */
  mediaStoragePath?: string;
  /** 允许保存内部使用的设置键 */
  [key: string]: string | undefined;
}

export interface UserInfo {
  id: string;
  phone: string;
  email?: string;
  membership_type: "free" | "premium";
  membership_expires_at?: string;
}

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

export interface SyncChange {
  table_name: "events" | "media" | "anniversaries" | "settings";
  record_id: string;
  updated_at: string;
  deleted: boolean;
  payload: object;
}

export interface SyncPayload {
  last_sync_at?: string;
  changes: SyncChange[];
}

export interface SyncResult {
  server_time: string;
  changes: SyncChange[];
}

