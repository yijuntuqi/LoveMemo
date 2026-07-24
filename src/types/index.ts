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
  icon?: string;
}

export interface AppSettings {
  coupleName?: string;
  startDate?: string;
  partnerName?: string;
  myName?: string;
  aiProvider?: "moonshot" | "chatanywhere";
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
}

