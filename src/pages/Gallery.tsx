import { useEffect, useState } from "react";
import { ImageIcon, Play, Search, X } from "lucide-react";
import { getAllMedia, getEvents, initDatabase } from "../db";
import { getMediaUrl } from "../utils/media";
import Modal from "../components/Modal";
import type { MediaItem, MemoryEvent } from "../types";

export default function Gallery() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      await initDatabase();
      const [m, e] = await Promise.all([getAllMedia(), getEvents()]);
      setMedia(m);
      setEvents(e);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = media.filter((item) => {
    const matchesType = filter === "all" ? true : item.type === filter;
    const q = searchQuery.trim().toLowerCase();
    const title = eventTitle(item.eventId).toLowerCase();
    const matchesQuery =
      !q || title.includes(q) || item.path.toLowerCase().includes(q);
    return matchesType && matchesQuery;
  });

  function eventTitle(eventId: number) {
    return events.find((e) => e.id === eventId)?.title || "未关联事件";
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">恋爱相册</h2>
          <p className="text-slate-500 mt-1">收藏我们最美好的瞬间</p>
        </div>
        <div className="flex gap-2 bg-white rounded-xl p-1 border border-rose-100">
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filter === f
                  ? "bg-rose-100 text-rose-600 font-medium"
                  : "text-slate-500 hover:bg-rose-50"
              }`}
            >
              {f === "all" ? "全部" : f === "image" ? "照片" : "视频"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索关联的故事标题"
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <ImageIcon className="w-16 h-16 mb-4 text-rose-200" />
          <p>{media.length === 0 ? "还没有媒体文件" : "没有找到匹配的文件"}</p>
          <p className="text-sm mt-1">
            {media.length === 0
              ? "在时间线中添加记录时上传照片或视频"
              : "尝试调整搜索或筛选条件"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelected(item)}
                className="aspect-square rounded-2xl overflow-hidden border border-rose-100 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow relative group"
              >
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
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  {item.type === "video" && (
                    <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-white" />
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white truncate">
                    {eventTitle(item.eventId)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? eventTitle(selected.eventId) : ""}
        maxWidth="max-w-4xl"
      >
        {selected && (
          <div className="flex flex-col items-center">
            {selected.type === "image" ? (
              <img
                src={getMediaUrl(selected.path)}
                alt=""
                className="max-h-[70vh] rounded-xl"
              />
            ) : (
              <video
                src={getMediaUrl(selected.path)}
                controls
                className="max-h-[70vh] rounded-xl"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
