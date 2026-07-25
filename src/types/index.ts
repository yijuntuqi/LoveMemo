export interface MemoryEvent {
  id: number;
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
}

export interface MediaItem {
  id: number;
  eventId: number;
  type: "image" | "video" | "audio";
  path: string;
  thumbnail?: string;
  caption?: string;
  createdAt: string;
}

export interface Anniversary {
  id: number;
  title: string;
  date: string;
  repeatYearly: boolean;
  repeatType: "none" | "weekly" | "monthly" | "yearly";
  category: AnniversaryCategory;
  icon?: string;
}

export type AnniversaryCategory =
  | "date"
  | "gift"
  | "travel"
  | "kiss"
  | "wedding"
  | "birthday"
  | "custom";

export interface AppSettings {
  coupleName?: string;
  startDate?: string;
  partnerName?: string;
  myName?: string;
  aiProvider?: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
}

