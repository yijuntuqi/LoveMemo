import Database from "@tauri-apps/plugin-sql";
import type {
  MemoryEvent,
  MediaItem,
  Anniversary,
  AppSettings,
  SyncChange,
} from "../types";

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

const DB_PATH = "sqlite:lovememo.db";
const SETTINGS_UPDATED_AT_KEY = "_settingsUpdatedAt";

async function addColumnIfMissing(
  database: Database,
  table: string,
  column: string,
  def: string,
) {
  try {
    await database.execute(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${def}`,
    );
  } catch {
    // 列已存在或表不存在时忽略
  }
}

async function migrateToV2(database: Database) {
  // SQLite 不允许 ALTER TABLE ADD COLUMN 带 UNIQUE 约束，所以用 TEXT + 后续建索引
  await addColumnIfMissing(database, "events", "sync_id", "TEXT");
  await addColumnIfMissing(database, "events", "deleted", "INTEGER DEFAULT 0");

  await addColumnIfMissing(database, "media", "sync_id", "TEXT");
  await addColumnIfMissing(
    database,
    "media",
    "updated_at",
    "TEXT DEFAULT CURRENT_TIMESTAMP",
  );
  await addColumnIfMissing(database, "media", "deleted", "INTEGER DEFAULT 0");

  await addColumnIfMissing(
    database,
    "anniversaries",
    "sync_id",
    "TEXT",
  );
  await addColumnIfMissing(
    database,
    "anniversaries",
    "updated_at",
    "TEXT DEFAULT CURRENT_TIMESTAMP",
  );
  await addColumnIfMissing(
    database,
    "anniversaries",
    "deleted",
    "INTEGER DEFAULT 0",
  );

  // 为旧记录生成 sync_id
  try {
    await database.execute(
      `UPDATE events SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL`,
    );
  } catch {}
  try {
    await database.execute(
      `UPDATE media SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL`,
    );
  } catch {}
  try {
    await database.execute(
      `UPDATE anniversaries SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL`,
    );
  } catch {}

  // 为旧记录填充 updated_at
  try {
    await database.execute(
      `UPDATE media SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`,
    );
  } catch {}
  try {
    await database.execute(
      `UPDATE anniversaries SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`,
    );
  } catch {}
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = await Database.load(DB_PATH);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_id TEXT UNIQUE,
        title TEXT NOT NULL,
        content TEXT,
        date TEXT NOT NULL,
        location TEXT,
        latitude REAL,
        longitude REAL,
        tags TEXT,
        cover_image TEXT,
        show_on_map INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 兼容旧版：events 曾用 show_on_map
    try {
      await database.execute(`ALTER TABLE events ADD COLUMN show_on_map INTEGER DEFAULT 1`);
    } catch {}

    await database.execute(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_id TEXT UNIQUE,
        event_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        thumbnail TEXT,
        caption TEXT,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS anniversaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_id TEXT UNIQUE,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        repeat_yearly INTEGER DEFAULT 1,
        repeat_type TEXT DEFAULT 'yearly',
        category TEXT DEFAULT 'gift',
        icon TEXT,
        deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 兼容旧版：anniversaries 曾用 repeat_type / category
    try {
      await database.execute(`ALTER TABLE anniversaries ADD COLUMN repeat_type TEXT DEFAULT 'yearly'`);
    } catch {}
    try {
      await database.execute(`ALTER TABLE anniversaries ADD COLUMN category TEXT DEFAULT 'gift'`);
    } catch {}

    await database.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // 版本化迁移：v2 增加同步相关列
    // 注意：不管 user_version，总是确保关键列存在（防止之前迁移中途失败）
    await migrateToV2(database);

    const versionResult = await database.select<{ user_version: number }[]>(
      "PRAGMA user_version",
    );
    const version = versionResult[0]?.user_version ?? 0;

    if (version < 2) {
      await database.execute("PRAGMA user_version = 2");
    }

    db = database;
    return database;
  })().catch((err) => {
    initPromise = null; // 允许下次重试
    throw err;
  });

  return initPromise;
}

export async function getDb(): Promise<Database> {
  if (!db) await initDatabase();
  return db!;
}

function mapEventRow(row: {
  id: number;
  sync_id: string;
  title: string;
  content: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  tags: string;
  cover_image: string;
  show_on_map: number;
  deleted: number;
  created_at: string;
  updated_at: string;
}): MemoryEvent {
  return {
    id: row.id,
    sync_id: row.sync_id,
    title: row.title,
    content: row.content,
    date: row.date,
    location: row.location,
    latitude: row.latitude,
    longitude: row.longitude,
    tags: row.tags,
    coverImage: row.cover_image,
    showOnMap: row.show_on_map === 1,
    deleted: row.deleted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  };
}

function mapMediaRow(row: {
  id: number;
  sync_id: string;
  event_id: number;
  type: "image" | "video" | "audio";
  path: string;
  thumbnail: string;
  caption: string;
  deleted: number;
  created_at: string;
  updated_at: string;
}): MediaItem {
  return {
    id: row.id,
    sync_id: row.sync_id,
    eventId: row.event_id,
    type: row.type,
    path: row.path,
    thumbnail: row.thumbnail,
    caption: row.caption,
    deleted: row.deleted === 1,
    createdAt: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapAnniversaryRow(row: {
  id: number;
  sync_id: string;
  title: string;
  date: string;
  repeat_yearly: number;
  repeat_type: string;
  category: string;
  icon: string;
  deleted: number;
  created_at: string;
  updated_at: string;
}): Anniversary {
  const repeatType = (row.repeat_type || "yearly") as Anniversary["repeatType"];
  return {
    id: row.id,
    sync_id: row.sync_id,
    title: row.title,
    date: row.date,
    repeatYearly: repeatType === "yearly" || Boolean(row.repeat_yearly),
    repeatType,
    category: (row.category || "gift") as Anniversary["category"],
    icon: row.icon,
    deleted: row.deleted === 1,
    createdAt: row.created_at,
    updated_at: row.updated_at,
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
  const syncId = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await database.execute(
    `INSERT INTO events (sync_id, title, content, date, location, latitude, longitude, tags, cover_image, show_on_map, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      syncId,
      input.title,
      input.content || null,
      input.date,
      input.location || null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.tags || null,
      input.coverImage || null,
      input.showOnMap === false ? 0 : 1,
      now,
    ],
  );
  return result.lastInsertId;
}

export async function updateEvent(id: number, input: EventInput) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    `UPDATE events SET
      title = ?, content = ?, date = ?, location = ?,
      latitude = ?, longitude = ?, tags = ?, cover_image = ?, show_on_map = ?, updated_at = ?
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
      now,
      id,
    ],
  );
}

export async function deleteEvent(id: number) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    "UPDATE events SET deleted = 1, updated_at = ? WHERE id = ?",
    [now, id],
  );
}

export async function getEventById(id: number): Promise<MemoryEvent | null> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      sync_id: string;
      title: string;
      content: string;
      date: string;
      location: string;
      latitude: number;
      longitude: number;
      tags: string;
      cover_image: string;
      show_on_map: number;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >("SELECT * FROM events WHERE id = ? AND deleted = 0", [id]);
  return rows[0] ? mapEventRow(rows[0]) : null;
}

export async function getEvents(): Promise<MemoryEvent[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      sync_id: string;
      title: string;
      content: string;
      date: string;
      location: string;
      latitude: number;
      longitude: number;
      tags: string;
      cover_image: string;
      show_on_map: number;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >("SELECT * FROM events WHERE deleted = 0 ORDER BY date DESC");

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
  const syncId = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await database.execute(
    `INSERT INTO media (sync_id, event_id, type, path, caption, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [syncId, input.eventId, input.type, input.path, input.caption || null, now],
  );
  return result.lastInsertId;
}

export async function getMediaByEventId(eventId: number): Promise<MediaItem[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      sync_id: string;
      event_id: number;
      type: "image" | "video" | "audio";
      path: string;
      thumbnail: string;
      caption: string;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >(
    "SELECT * FROM media WHERE event_id = ? AND deleted = 0 ORDER BY created_at",
    [eventId],
  );
  return rows.map(mapMediaRow);
}

export async function getAllMedia(): Promise<MediaItem[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      sync_id: string;
      event_id: number;
      type: "image" | "video" | "audio";
      path: string;
      thumbnail: string;
      caption: string;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >(
    `SELECT m.* FROM media m
     JOIN events e ON m.event_id = e.id
     WHERE m.deleted = 0 AND e.deleted = 0
     ORDER BY m.created_at DESC`,
  );
  return rows.map(mapMediaRow);
}

export async function deleteMedia(id: number) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    "UPDATE media SET deleted = 1, updated_at = ? WHERE id = ?",
    [now, id],
  );
}

export async function clearMediaByEventId(eventId: number) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    "UPDATE media SET deleted = 1, updated_at = ? WHERE event_id = ? AND deleted = 0",
    [now, eventId],
  );
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
  const syncId = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await database.execute(
    `INSERT INTO anniversaries (sync_id, title, date, repeat_yearly, repeat_type, category, icon, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      syncId,
      input.title,
      input.date,
      input.repeatType === "yearly" ? 1 : 0,
      input.repeatType,
      input.category,
      input.icon || null,
      now,
    ],
  );
  return result.lastInsertId;
}

export async function updateAnniversary(id: number, input: AnniversaryInput) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    `UPDATE anniversaries SET
      title = ?, date = ?, repeat_yearly = ?, repeat_type = ?, category = ?, icon = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.title,
      input.date,
      input.repeatType === "yearly" ? 1 : 0,
      input.repeatType,
      input.category,
      input.icon || null,
      now,
      id,
    ],
  );
}

export async function deleteAnniversary(id: number) {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.execute(
    "UPDATE anniversaries SET deleted = 1, updated_at = ? WHERE id = ?",
    [now, id],
  );
}

export async function getAnniversaries(): Promise<Anniversary[]> {
  const database = await getDb();
  const rows = await database.select<
    {
      id: number;
      sync_id: string;
      title: string;
      date: string;
      repeat_yearly: number;
      repeat_type: string;
      category: string;
      icon: string;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >("SELECT * FROM anniversaries WHERE deleted = 0 ORDER BY date");
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

// Sync helpers
export async function getSettingsForSync(): Promise<AppSettings> {
  const settings = await getSettings();
  const result: AppSettings = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key === SETTINGS_UPDATED_AT_KEY) continue;
    (result as Record<string, string>)[key] = value;
  }
  return result;
}

export async function applySettingsPatch(settings: AppSettings): Promise<void> {
  const now = new Date().toISOString();
  const patch: Partial<AppSettings> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key === SETTINGS_UPDATED_AT_KEY) continue;
    if (value === undefined) continue;
    patch[key as keyof AppSettings] = value as never;
  }
  await saveSettings(patch);
  await saveSettings({ [SETTINGS_UPDATED_AT_KEY]: now });
}

export async function getLocalChanges(since?: string): Promise<SyncChange[]> {
  const database = await getDb();
  const changes: SyncChange[] = [];

  const where = since ? "WHERE updated_at > ?" : "WHERE 1=1";
  const params = since ? [since] : [];

  const eventRows = await database.select<
    {
      id: number;
      sync_id: string;
      title: string;
      content: string;
      date: string;
      location: string;
      latitude: number;
      longitude: number;
      tags: string;
      cover_image: string;
      show_on_map: number;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >(`SELECT * FROM events ${where}`, params);

  for (const row of eventRows) {
    const event = mapEventRow(row);
    const { id: _id, sync_id: _sid, deleted: _del, ...payload } = event;
    changes.push({
      table_name: "events",
      record_id: row.sync_id,
      updated_at: row.updated_at,
      deleted: row.deleted === 1,
      payload,
    });
  }

  const mediaRows = await database.select<
    {
      id: number;
      sync_id: string;
      event_id: number;
      event_sync_id: string;
      type: "image" | "video" | "audio";
      path: string;
      thumbnail: string;
      caption: string;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >(
    `SELECT m.*, e.sync_id AS event_sync_id FROM media m
     LEFT JOIN events e ON m.event_id = e.id
     ${since ? "WHERE m.updated_at > ?" : ""}`,
    since ? [since] : [],
  );

  for (const row of mediaRows) {
    const media = mapMediaRow(row);
    const {
      id: _id,
      eventId: _eid,
      sync_id: _sid,
      deleted: _del,
      ...rest
    } = media;
    changes.push({
      table_name: "media",
      record_id: row.sync_id,
      updated_at: row.updated_at,
      deleted: row.deleted === 1,
      payload: {
        ...rest,
        event_sync_id: row.event_sync_id,
      },
    });
  }

  const anniversaryRows = await database.select<
    {
      id: number;
      sync_id: string;
      title: string;
      date: string;
      repeat_yearly: number;
      repeat_type: string;
      category: string;
      icon: string;
      deleted: number;
      created_at: string;
      updated_at: string;
    }[]
  >(`SELECT * FROM anniversaries ${where}`, params);

  for (const row of anniversaryRows) {
    const item = mapAnniversaryRow(row);
    const { id: _id, sync_id: _sid, deleted: _del, ...payload } = item;
    changes.push({
      table_name: "anniversaries",
      record_id: row.sync_id,
      updated_at: row.updated_at,
      deleted: row.deleted === 1,
      payload,
    });
  }

  const settings = await getSettings();
  const settingsUpdatedAt =
    settings[SETTINGS_UPDATED_AT_KEY] || new Date(0).toISOString();
  if (!since || settingsUpdatedAt > since) {
    const settingsForSync = await getSettingsForSync();
    changes.push({
      table_name: "settings",
      record_id: "settings",
      updated_at: settingsUpdatedAt,
      deleted: false,
      payload: settingsForSync,
    });
  }

  return changes;
}

async function applyEventChange(
  database: Database,
  change: SyncChange,
): Promise<void> {
  const rows = await database.select<
    { id: number; updated_at: string; deleted: number }[]
  >("SELECT id, updated_at, deleted FROM events WHERE sync_id = ?", [
    change.record_id,
  ]);

  if (change.deleted) {
    if (rows.length > 0 && rows[0].deleted !== 1) {
      await database.execute(
        "UPDATE events SET deleted = 1, updated_at = ? WHERE id = ?",
        [change.updated_at, rows[0].id],
      );
    }
    return;
  }

  const payload = change.payload as MemoryEvent;
  if (rows.length === 0) {
    await database.execute(
      `INSERT INTO events (sync_id, title, content, date, location, latitude, longitude, tags, cover_image, show_on_map, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        change.record_id,
        payload.title,
        payload.content || null,
        payload.date,
        payload.location || null,
        payload.latitude ?? null,
        payload.longitude ?? null,
        payload.tags || null,
        payload.coverImage || null,
        payload.showOnMap === false ? 0 : 1,
        payload.createdAt || change.updated_at,
        change.updated_at,
      ],
    );
  } else if (change.updated_at > rows[0].updated_at) {
    await database.execute(
      `UPDATE events SET
        title = ?, content = ?, date = ?, location = ?,
        latitude = ?, longitude = ?, tags = ?, cover_image = ?, show_on_map = ?,
        updated_at = ?, deleted = 0
       WHERE id = ?`,
      [
        payload.title,
        payload.content || null,
        payload.date,
        payload.location || null,
        payload.latitude ?? null,
        payload.longitude ?? null,
        payload.tags || null,
        payload.coverImage || null,
        payload.showOnMap === false ? 0 : 1,
        change.updated_at,
        rows[0].id,
      ],
    );
  }
}

async function applyMediaChange(
  database: Database,
  change: SyncChange,
): Promise<void> {
  const payload = change.payload as MediaItem & { event_sync_id?: string };

  let eventId: number | null = null;
  if (payload.event_sync_id) {
    const eventRows = await database.select<{ id: number }[]>(
      "SELECT id FROM events WHERE sync_id = ? AND deleted = 0",
      [payload.event_sync_id],
    );
    if (eventRows.length > 0) eventId = eventRows[0].id;
  }

  if (!eventId) return;

  const rows = await database.select<
    { id: number; updated_at: string; deleted: number }[]
  >("SELECT id, updated_at, deleted FROM media WHERE sync_id = ?", [
    change.record_id,
  ]);

  if (change.deleted) {
    if (rows.length > 0 && rows[0].deleted !== 1) {
      await database.execute(
        "UPDATE media SET deleted = 1, updated_at = ? WHERE id = ?",
        [change.updated_at, rows[0].id],
      );
    }
    return;
  }

  if (rows.length === 0) {
    await database.execute(
      `INSERT INTO media (sync_id, event_id, type, path, thumbnail, caption, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        change.record_id,
        eventId,
        payload.type,
        payload.path,
        payload.thumbnail || null,
        payload.caption || null,
        payload.createdAt || change.updated_at,
        change.updated_at,
      ],
    );
  } else if (change.updated_at > rows[0].updated_at) {
    await database.execute(
      `UPDATE media SET
        event_id = ?, type = ?, path = ?, thumbnail = ?, caption = ?,
        updated_at = ?, deleted = 0
       WHERE id = ?`,
      [
        eventId,
        payload.type,
        payload.path,
        payload.thumbnail || null,
        payload.caption || null,
        change.updated_at,
        rows[0].id,
      ],
    );
  }
}

async function applyAnniversaryChange(
  database: Database,
  change: SyncChange,
): Promise<void> {
  const rows = await database.select<
    { id: number; updated_at: string; deleted: number }[]
  >("SELECT id, updated_at, deleted FROM anniversaries WHERE sync_id = ?", [
    change.record_id,
  ]);

  if (change.deleted) {
    if (rows.length > 0 && rows[0].deleted !== 1) {
      await database.execute(
        "UPDATE anniversaries SET deleted = 1, updated_at = ? WHERE id = ?",
        [change.updated_at, rows[0].id],
      );
    }
    return;
  }

  const payload = change.payload as Anniversary;
  if (rows.length === 0) {
    await database.execute(
      `INSERT INTO anniversaries (sync_id, title, date, repeat_yearly, repeat_type, category, icon, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        change.record_id,
        payload.title,
        payload.date,
        payload.repeatType === "yearly" ? 1 : 0,
        payload.repeatType || "yearly",
        payload.category || "gift",
        payload.icon || null,
        payload.createdAt || change.updated_at,
        change.updated_at,
      ],
    );
  } else if (change.updated_at > rows[0].updated_at) {
    await database.execute(
      `UPDATE anniversaries SET
        title = ?, date = ?, repeat_yearly = ?, repeat_type = ?, category = ?, icon = ?,
        updated_at = ?, deleted = 0
       WHERE id = ?`,
      [
        payload.title,
        payload.date,
        payload.repeatType === "yearly" ? 1 : 0,
        payload.repeatType || "yearly",
        payload.category || "gift",
        payload.icon || null,
        change.updated_at,
        rows[0].id,
      ],
    );
  }
}

export async function applyServerChanges(changes: SyncChange[]): Promise<void> {
  const database = await getDb();

  for (const change of changes) {
    if (change.table_name === "settings") {
      await applySettingsPatch(change.payload as AppSettings);
      continue;
    }
    if (change.table_name === "events") {
      await applyEventChange(database, change);
    } else if (change.table_name === "media") {
      await applyMediaChange(database, change);
    } else if (change.table_name === "anniversaries") {
      await applyAnniversaryChange(database, change);
    }
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
        sync_id: string;
        title: string;
        content: string;
        date: string;
        location: string;
        latitude: number;
        longitude: number;
        tags: string;
        cover_image: string;
        show_on_map: number;
        deleted: number;
        created_at: string;
        updated_at: string;
      }[]
    >("SELECT * FROM events ORDER BY date DESC"),
    database.select<
      {
        id: number;
        sync_id: string;
        event_id: number;
        type: "image" | "video" | "audio";
        path: string;
        thumbnail: string;
        caption: string;
        deleted: number;
        created_at: string;
        updated_at: string;
      }[]
    >("SELECT * FROM media ORDER BY created_at DESC"),
    database.select<
      {
        id: number;
        sync_id: string;
        title: string;
        date: string;
        repeat_yearly: number;
        repeat_type: string;
        category: string;
        icon: string;
        deleted: number;
        created_at: string;
        updated_at: string;
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
      `INSERT INTO events (id, sync_id, title, content, date, location, latitude, longitude, tags, cover_image, show_on_map, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.sync_id || crypto.randomUUID(),
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
        event.updatedAt || event.updated_at || new Date().toISOString(),
        event.deleted ? 1 : 0,
      ],
    );
  }

  for (const item of data.media) {
    await database.execute(
      `INSERT INTO media (id, sync_id, event_id, type, path, thumbnail, caption, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.sync_id || crypto.randomUUID(),
        item.eventId,
        item.type,
        item.path,
        item.thumbnail || null,
        item.caption || null,
        item.createdAt,
        item.updated_at || new Date().toISOString(),
        item.deleted ? 1 : 0,
      ],
    );
  }

  for (const item of data.anniversaries) {
    await database.execute(
      `INSERT INTO anniversaries (id, sync_id, title, date, repeat_yearly, repeat_type, category, icon, created_at, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.sync_id || crypto.randomUUID(),
        item.title,
        item.date,
        item.repeatType === "yearly" ? 1 : 0,
        item.repeatType || "yearly",
        item.category || "gift",
        item.icon || null,
        item.createdAt,
        item.updated_at || new Date().toISOString(),
        item.deleted ? 1 : 0,
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
