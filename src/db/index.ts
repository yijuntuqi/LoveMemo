import Database from "@tauri-apps/plugin-sql";
import type { MemoryEvent, MediaItem, Anniversary, AppSettings } from "../types";

let db: Database | null = null;

const DB_PATH = "sqlite:lovememo.db";

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  db = await Database.load(DB_PATH);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      date TEXT NOT NULL,
      location TEXT,
      latitude REAL,
      longitude REAL,
      tags TEXT,
      cover_image TEXT,
      show_on_map INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await db.execute(`ALTER TABLE events ADD COLUMN show_on_map INTEGER DEFAULT 1`);
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      thumbnail TEXT,
      caption TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS anniversaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      repeat_yearly INTEGER DEFAULT 1,
      repeat_type TEXT DEFAULT 'yearly',
      category TEXT DEFAULT 'gift',
      icon TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 兼容旧版：为已存在的表补字段
  try {
    await db.execute(`ALTER TABLE anniversaries ADD COLUMN repeat_type TEXT DEFAULT 'yearly'`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE anniversaries ADD COLUMN category TEXT DEFAULT 'gift'`);
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  return db;
}

export async function getDb(): Promise<Database> {
  if (!db) await initDatabase();
  return db!;
}

function mapEventRow(row: {
  id: number;
  title: string;
  content: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  tags: string;
  cover_image: string;
  show_on_map: number;
  created_at: string;
  updated_at: string;
}): MemoryEvent {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.date,
    location: row.location,
    latitude: row.latitude,
    longitude: row.longitude,
    tags: row.tags,
    coverImage: row.cover_image,
    showOnMap: row.show_on_map === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMediaRow(row: {
  id: number;
  event_id: number;
  type: "image" | "video" | "audio";
  path: string;
  thumbnail: string;
  caption: string;
  created_at: string;
}): MediaItem {
  return {
    id: row.id,
    eventId: row.event_id,
    type: row.type,
    path: row.path,
    thumbnail: row.thumbnail,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

function mapAnniversaryRow(row: {
  id: number;
  title: string;
  date: string;
  repeat_yearly: number;
  repeat_type: string;
  category: string;
  icon: string;
  created_at: string;
}): Anniversary {
  const repeatType = (row.repeat_type || "yearly") as Anniversary["repeatType"];
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    repeatYearly: repeatType === "yearly" || Boolean(row.repeat_yearly),
    repeatType,
    category: (row.category || "gift") as Anniversary["category"],
    icon: row.icon,
  };
}

// Events
export interface EventInput {
  title: string;
  content?: string;
  date: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  tags?: string;
  coverImage?: string;
  showOnMap?: boolean;
}

export async function createEvent(input: EventInput) {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO events (title, content, date, location, latitude, longitude, tags, cover_image, show_on_map)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.content || null,
      input.date,
      input.location || null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.tags || null,
      input.coverImage || null,
      input.showOnMap === false ? 0 : 1,
    ],
  );
  return result.lastInsertId;
}

export async function updateEvent(id: number, input: EventInput) {
  const database = await getDb();
  await database.execute(
    `UPDATE events SET
      title = ?, content = ?, date = ?, location = ?,
      latitude = ?, longitude = ?, tags = ?, cover_image = ?, show_on_map = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      input.title,
      input.content || null,
      input.date,
      input.location || null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.tags || null,
      input.coverImage || null,
      input.showOnMap === false ? 0 : 1,
      id,
    ],
  );
}

export async function deleteEvent(id: number) {
  const database = await getDb();
  await database.execute("DELETE FROM events WHERE id = ?", [id]);
}

export async function getEventById(id: number): Promise<MemoryEvent | null> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      title: string;
      content: string;
      date: string;
      location: string;
      latitude: number;
      longitude: number;
      tags: string;
      cover_image: string;
      show_on_map: number;
      created_at: string;
      updated_at: string;
    }[]
  >("SELECT * FROM events WHERE id = ?", [id]);
  return rows[0] ? mapEventRow(rows[0]) : null;
}

export async function getEvents(): Promise<MemoryEvent[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      title: string;
      content: string;
      date: string;
      location: string;
      latitude: number;
      longitude: number;
      tags: string;
      cover_image: string;
      show_on_map: number;
      created_at: string;
      updated_at: string;
    }[]
  >("SELECT * FROM events ORDER BY date DESC");

  return rows.map(mapEventRow);
}

// Media
export interface MediaInput {
  eventId: number;
  type: "image" | "video" | "audio";
  path: string;
  caption?: string;
}

export async function createMedia(input: MediaInput) {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO media (event_id, type, path, caption)
     VALUES (?, ?, ?, ?)`,
    [input.eventId, input.type, input.path, input.caption || null],
  );
  return result.lastInsertId;
}

export async function getMediaByEventId(eventId: number): Promise<MediaItem[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      event_id: number;
      type: "image" | "video" | "audio";
      path: string;
      thumbnail: string;
      caption: string;
      created_at: string;
    }[]
  >("SELECT * FROM media WHERE event_id = ? ORDER BY created_at", [eventId]);
  return rows.map(mapMediaRow);
}

export async function getAllMedia(): Promise<MediaItem[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      event_id: number;
      type: "image" | "video" | "audio";
      path: string;
      thumbnail: string;
      caption: string;
      created_at: string;
    }[]
  >("SELECT * FROM media ORDER BY created_at DESC");
  return rows.map(mapMediaRow);
}

export async function deleteMedia(id: number) {
  const database = await getDb();
  await database.execute("DELETE FROM media WHERE id = ?", [id]);
}

export async function clearMediaByEventId(eventId: number) {
  const database = await getDb();
  await database.execute("DELETE FROM media WHERE event_id = ?", [eventId]);
}

// Anniversaries
export interface AnniversaryInput {
  title: string;
  date: string;
  repeatType: Anniversary["repeatType"];
  category: Anniversary["category"];
  icon?: string;
}

export async function createAnniversary(input: AnniversaryInput) {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO anniversaries (title, date, repeat_yearly, repeat_type, category, icon)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.date,
      input.repeatType === "yearly" ? 1 : 0,
      input.repeatType,
      input.category,
      input.icon || null,
    ],
  );
  return result.lastInsertId;
}

export async function updateAnniversary(id: number, input: AnniversaryInput) {
  const database = await getDb();
  await database.execute(
    `UPDATE anniversaries SET
      title = ?, date = ?, repeat_yearly = ?, repeat_type = ?, category = ?, icon = ?
     WHERE id = ?`,
    [
      input.title,
      input.date,
      input.repeatType === "yearly" ? 1 : 0,
      input.repeatType,
      input.category,
      input.icon || null,
      id,
    ],
  );
}

export async function deleteAnniversary(id: number) {
  const database = await getDb();
  await database.execute("DELETE FROM anniversaries WHERE id = ?", [id]);
}

export async function getAnniversaries(): Promise<Anniversary[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      title: string;
      date: string;
      repeat_yearly: number;
      repeat_type: string;
      category: string;
      icon: string;
      created_at: string;
    }[]
  >("SELECT * FROM anniversaries ORDER BY date");
  return rows.map(mapAnniversaryRow);
}

// Settings
export async function getSettings(): Promise<Record<string, string>> {
  const database = await getDb();
  const rows = await database.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings",
  );
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function saveSettings(settings: Partial<AppSettings>) {
  const database = await getDb();
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    await database.execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, String(value)],
    );
  }
}

// Backup & Restore
export interface AppBackup {
  version: number;
  exportedAt: string;
  events: MemoryEvent[];
  media: MediaItem[];
  anniversaries: Anniversary[];
  settings: Record<string, string>;
}

export async function exportAllData(): Promise<AppBackup> {
  const database = await getDb();
  const [events, media, anniversaries, settings] = await Promise.all([
    database.select<
      {
        id: number;
        title: string;
        content: string;
        date: string;
        location: string;
        latitude: number;
        longitude: number;
        tags: string;
        cover_image: string;
        show_on_map: number;
        created_at: string;
        updated_at: string;
      }[]
    >("SELECT * FROM events ORDER BY date DESC"),
    database.select<
      {
        id: number;
        event_id: number;
        type: "image" | "video" | "audio";
        path: string;
        thumbnail: string;
        caption: string;
        created_at: string;
      }[]
    >("SELECT * FROM media ORDER BY created_at DESC"),
    database.select<
      {
        id: number;
        title: string;
        date: string;
        repeat_yearly: number;
        repeat_type: string;
        category: string;
        icon: string;
        created_at: string;
      }[]
    >("SELECT * FROM anniversaries ORDER BY date"),
    getSettings(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    events: events.map(mapEventRow),
    media: media.map(mapMediaRow),
    anniversaries: anniversaries.map(mapAnniversaryRow),
    settings,
  };
}

export async function importAllData(data: AppBackup) {
  const database = await getDb();

  await database.execute("DELETE FROM media");
  await database.execute("DELETE FROM events");
  await database.execute("DELETE FROM anniversaries");
  await database.execute("DELETE FROM settings");

  for (const event of data.events) {
    await database.execute(
      `INSERT INTO events (id, title, content, date, location, latitude, longitude, tags, cover_image, show_on_map, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.title,
        event.content || null,
        event.date,
        event.location || null,
        event.latitude ?? null,
        event.longitude ?? null,
        event.tags || null,
        event.coverImage || null,
        event.showOnMap === false ? 0 : 1,
        event.createdAt,
        event.updatedAt,
      ],
    );
  }

  for (const item of data.media) {
    await database.execute(
      `INSERT INTO media (id, event_id, type, path, thumbnail, caption, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.eventId,
        item.type,
        item.path,
        item.thumbnail || null,
        item.caption || null,
        item.createdAt,
      ],
    );
  }

  for (const item of data.anniversaries) {
    await database.execute(
      `INSERT INTO anniversaries (id, title, date, repeat_yearly, repeat_type, category, icon, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        item.date,
        item.repeatType === "yearly" ? 1 : 0,
        item.repeatType || "yearly",
        item.category || "gift",
        item.icon || null,
        new Date().toISOString(),
      ],
    );
  }

  for (const [key, value] of Object.entries(data.settings)) {
    await database.execute("INSERT INTO settings (key, value) VALUES (?, ?)", [
      key,
      value,
    ]);
  }
}
