import { useEffect, useState } from "react";
import {
  Trash2,
  RotateCcw,
  Calendar,
  Image,
  Gift,
  AlertTriangle,
} from "lucide-react";
import {
  initDatabase,
  getDeletedEvents,
  getDeletedMedia,
  getDeletedAnniversaries,
  restoreEvent,
  restoreMedia,
  restoreAnniversary,
  permanentDeleteEvent,
  permanentDeleteMedia,
  permanentDeleteAnniversary,
} from "../db";
import { getMediaUrl } from "../utils/media";
import type { MemoryEvent, MediaItem, Anniversary } from "../types";

type Tab = "events" | "media" | "anniversaries";

export default function RecycleBin() {
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [e, m, a] = await Promise.all([
      getDeletedEvents(),
      getDeletedMedia(),
      getDeletedAnniversaries(),
    ]);
    setEvents(e);
    setMedia(m);
    setAnniversaries(a);
  }

  useEffect(() => {
    async function bootstrap() {
      await initDatabase();
      await load();
      setLoading(false);
    }
    bootstrap();
  }, []);

  async function handleRestore(type: Tab, id: number) {
    try {
      if (type === "events") await restoreEvent(id);
      if (type === "media") await restoreMedia(id);
      if (type === "anniversaries") await restoreAnniversary(id);
      await load();
    } catch (e) {
      alert("恢复失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleDelete(type: Tab, id: number) {
    if (!confirm("彻底删除后将无法恢复，确定继续吗？")) return;
    try {
      if (type === "events") await permanentDeleteEvent(id);
      if (type === "media") await permanentDeleteMedia(id);
      if (type === "anniversaries") await permanentDeleteAnniversary(id);
      await load();
    } catch (e) {
      alert("删除失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Calendar }[] = [
    { key: "events", label: `故事 (${events.length})`, icon: Calendar },
    { key: "media", label: `媒体 (${media.length})`, icon: Image },
    { key: "anniversaries", label: `纪念日 (${anniversaries.length})`, icon: Gift },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  const total = events.length + media.length + anniversaries.length;

  return (
    <div className="h-full flex flex-col p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">回收站</h2>
          <p className="text-slate-500 mt-1">删除的内容会暂存在这里，可恢复或彻底清空</p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
            <AlertTriangle className="w-4 h-4" />
            共 {total} 条已删除内容
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-colors ${
              activeTab === tab.key
                ? "bg-rose-100 text-rose-600 font-medium"
                : "bg-white text-slate-600 hover:bg-rose-50 border border-rose-100"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
        {activeTab === "events" && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <Empty text="没有已删除的故事" />
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm text-rose-500 font-medium">
                      <Calendar className="w-4 h-4" />
                      {event.date}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                      {event.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleRestore("events", event.id)}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      恢复
                    </button>
                    <button
                      onClick={() => handleDelete("events", event.id)}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      彻底删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "media" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {media.length === 0 ? (
              <div className="col-span-full">
                <Empty text="没有已删除的媒体文件" />
              </div>
            ) : (
              media.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl overflow-hidden border border-rose-100 shadow-sm"
                >
                  <div className="aspect-square">
                    {item.type === "image" ? (
                      <img
                        src={getMediaUrl(item.path)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={getMediaUrl(item.path)}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3 flex gap-2">
                    <button
                      onClick={() => handleRestore("media", item.id)}
                      className="flex-1 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => handleDelete("media", item.id)}
                      className="flex-1 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "anniversaries" && (
          <div className="space-y-3">
            {anniversaries.length === 0 ? (
              <Empty text="没有已删除的纪念日" />
            ) : (
              anniversaries.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm text-rose-500 font-medium">
                      <Gift className="w-4 h-4" />
                      {item.date}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleRestore("anniversaries", item.id)}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      恢复
                    </button>
                    <button
                      onClick={() => handleDelete("anniversaries", item.id)}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      彻底删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-slate-400 py-16">
      <Trash2 className="w-12 h-12 mb-3 text-rose-200" />
      <p>{text}</p>
    </div>
  );
}
