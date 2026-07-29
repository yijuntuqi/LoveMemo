import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Heart,
  Edit2,
  Trash2,
  MapPin,
  Calendar,
  Printer,
  Search,
  X,
  FileDown,
  Crown,
} from "lucide-react";
import {
  initDatabase,
  getSettings,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  createMedia,
  clearMediaByEventId,
  getMediaByEventId,
} from "../db";
import Modal from "../components/Modal";
import EventForm from "../components/EventForm";
import { getMediaUrl } from "../utils/media";
import { exportElementToPdf } from "../utils/pdf";
import { fetchUserInfo } from "../utils/api";
import { requirePremium } from "../utils/membership";
import type { MemoryEvent, MediaItem, AppSettings, UserInfo } from "../types";
import type { EventFormData } from "../components/EventForm";

export default function Timeline() {
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<number, MediaItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemoryEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      await initDatabase();
      const [data, s] = await Promise.all([getEvents(), getSettings()]);
      setEvents(data);
      setSettings(s as AppSettings);
      if (s.authToken) {
        try {
          const user = await fetchUserInfo(s as AppSettings);
          setUserInfo(user);
        } catch {
          // ignore
        }
      }

      const map: Record<number, MediaItem[]> = {};
      for (const event of data) {
        map[event.id] = await getMediaByEventId(event.id);
      }
      setMediaMap(map);
      setLoading(false);
    }
    load();
  }, []);

  async function refreshEvents() {
    const data = await getEvents();
    setEvents(data);
    const map: Record<number, MediaItem[]> = {};
    for (const event of data) {
      map[event.id] = await getMediaByEventId(event.id);
    }
    setMediaMap(map);
  }

  async function handleSubmit(form: EventFormData) {
    try {
      const input = {
        title: form.title,
        content: form.content,
        date: form.date,
        location: form.location || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        tags: form.tags || undefined,
        coverImage: form.coverImage || undefined,
        showOnMap: form.showOnMap,
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, input);
        await clearMediaByEventId(editingEvent.id);
        for (const item of form.media) {
          await createMedia({
            eventId: editingEvent.id,
            type: item.type,
            path: item.path,
            caption: item.caption,
          });
        }
      } else {
        const eventId = await createEvent(input);
        for (const item of form.media) {
          await createMedia({
            eventId: Number(eventId),
            type: item.type,
            path: item.path,
            caption: item.caption,
          });
        }
      }

      setIsModalOpen(false);
      setEditingEvent(null);
      await refreshEvents();
    } catch (e) {
      console.error("保存记录失败:", e);
      alert("保存失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定要删除这条记录吗？")) return;
    await deleteEvent(id);
    await refreshEvents();
  }

  const allTags = Array.from(
    new Set(
      events
        .flatMap((e) => (e.tags ? e.tags.split(/[,，]/).map((t) => t.trim()) : []))
        .filter(Boolean),
    ),
  ).sort();

  const filteredEvents = events.filter((event) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      event.title.toLowerCase().includes(q) ||
      (event.content && event.content.toLowerCase().includes(q)) ||
      (event.location && event.location.toLowerCase().includes(q)) ||
      (event.tags && event.tags.toLowerCase().includes(q));

    const matchesDateFrom = !dateFrom || event.date >= dateFrom;
    const matchesDateTo = !dateTo || event.date <= dateTo;

    const matchesTag =
      !selectedTag ||
      (event.tags &&
        event.tags
          .split(/[,，]/)
          .map((t) => t.trim())
          .includes(selectedTag));

    return matchesQuery && matchesDateFrom && matchesDateTo && matchesTag;
  });

  function openCreate() {
    setEditingEvent(null);
    setIsModalOpen(true);
  }

  function openEdit(event: MemoryEvent) {
    setEditingEvent(event);
    setIsModalOpen(true);
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  function handlePrint() {
    window.print();
  }

  async function handleExportPdf() {
    // 刷新最新会员状态，避免激活后仍被旧缓存拦截
    let latestUser = userInfo;
    if (settings.authToken) {
      try {
        latestUser = await fetchUserInfo(settings);
        setUserInfo(latestUser);
      } catch {
        // 失败时继续使用已有 userInfo
      }
    }
    if (!requirePremium(latestUser, "导出 PDF 纪念册")) return;
    if (filteredEvents.length === 0) {
      alert("没有可导出的记录");
      return;
    }
    if (!printRef.current) return;
    try {
      const start = settings.startDate ? new Date(settings.startDate) : null;
      const days = start
        ? Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      await exportElementToPdf(printRef.current, {
        coupleName: settings.coupleName,
        startDate: settings.startDate,
        daysTogether: days,
      });
    } catch (e) {
      alert("导出 PDF 失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div className="h-full flex flex-col p-8 print:p-0 print:bg-white print:h-auto print-content">
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-3xl font-bold text-rose-500">LoveMemo</h1>
        <p className="text-slate-500 mt-1">恋爱纪念册</p>
      </div>

      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">恋爱时间线</h2>
          <p className="text-slate-500 mt-1">记录属于我们的每一个重要时刻</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shadow-sm"
            title="打印或保存为 PDF"
          >
            <Printer className="w-5 h-5" />
            <span>打印纪念册</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shadow-sm"
            title="会员专属：导出 PDF 文件"
          >
            <Crown className="w-4 h-4 text-amber-500" />
            <FileDown className="w-5 h-5" />
            <span>导出 PDF</span>
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-lg shadow-rose-200"
          >
            <Plus className="w-5 h-5" />
            <span>新增记录</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题、内容、地点或标签"
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
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm text-slate-600"
        />
        <span className="text-slate-400 text-sm">至</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm text-slate-600"
        />
        {allTags.length > 0 && (
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 text-sm text-slate-600 bg-white"
          >
            <option value="">所有标签</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        )}
        {(searchQuery || dateFrom || dateTo || selectedTag) && (
          <button
            onClick={() => {
              setSearchQuery("");
              setDateFrom("");
              setDateTo("");
              setSelectedTag("");
            }}
            className="px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          >
            清空筛选
          </button>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mb-4">
            <Heart className="w-10 h-10 text-rose-400" />
          </div>
          <p className="text-lg">
              {events.length === 0 ? "还没有记录哦" : "没有找到匹配的记录"}
            </p>
          <p className="text-sm mt-1">
              {events.length === 0
                ? "点击右上角开始记录你们的故事"
                : "尝试调整筛选条件"}
            </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-2 print:overflow-visible print:pr-0">
          <div className="relative pl-8 border-l-2 border-rose-200 space-y-8 print:border-rose-300 print:pl-8">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative group break-inside-avoid">
                <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-rose-400 border-4 border-white shadow print:bg-rose-500" />
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100 hover:shadow-md transition-shadow print:shadow-none print:border-rose-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-rose-500 font-medium">
                        <Calendar className="w-4 h-4" />
                        {event.date}
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mt-1">
                        {event.title}
                      </h3>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                      <button
                        onClick={() => openEdit(event)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-600 mt-3 whitespace-pre-line">
                    {event.content}
                  </p>

                  {event.location && (
                    <p className="flex items-center gap-1 text-sm text-slate-400 mt-3">
                      <MapPin className="w-4 h-4" />
                      {event.location}
                    </p>
                  )}

                  {mediaMap[event.id]?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {mediaMap[event.id].map((item, idx) => (
                        <div
                          key={idx}
                          className="w-24 h-24 rounded-xl overflow-hidden border border-rose-100"
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
                              controls
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hidden print-footer">Created by LoveMemo</div>

      {/* PDF 导出专用容器 */}
      <div
        ref={printRef}
        className="fixed left-[-9999px] top-0 w-[794px] bg-white p-10 text-slate-800"
        style={{ zIndex: -1 }}
      >
        <div className="text-center mb-10 pb-8 border-b-2 border-rose-200">
          <h1 className="text-4xl font-bold text-rose-500">LoveMemo</h1>
          <p className="text-xl mt-3 font-medium">
            {settings.coupleName || "恋爱纪念册"}
          </p>
          {settings.startDate && (
            <p className="text-sm text-slate-500 mt-2">
              从 {settings.startDate} 开始记录
            </p>
          )}
        </div>

        <div className="space-y-8">
          {filteredEvents.map((event) => (
            <div key={event.id} className="pb-6 border-b border-rose-100">
              <div className="text-sm text-rose-500 font-medium mb-1">
                {event.date}
              </div>
              <h3 className="text-lg font-bold text-slate-800">{event.title}</h3>
              {event.content && (
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">
                  {event.content}
                </p>
              )}
              {event.location && (
                <p className="text-xs text-slate-400 mt-2">地点：{event.location}</p>
              )}
              {event.tags && (
                <p className="text-xs text-rose-400 mt-2">
                  {event.tags
                    .split(/[,，]/)
                    .map((t) => `#${t.trim()}`)
                    .join(" ")}
                </p>
              )}
              {mediaMap[event.id]?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {mediaMap[event.id].map((item, idx) =>
                    item.type === "image" ? (
                      <img
                        key={idx}
                        src={getMediaUrl(item.path)}
                        alt=""
                        className="w-24 h-24 object-cover rounded-lg border border-rose-100"
                      />
                    ) : null,
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-slate-400 mt-10 pt-6 border-t border-rose-100">
          Created by LoveMemo · {new Date().toLocaleDateString()}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? "编辑记录" : "新增记录"}
      >
        <EventForm
          initialData={editingEvent || undefined}
          initialMedia={
            editingEvent
              ? mediaMap[editingEvent.id]?.map((m) => ({
                  path: m.path,
                  type: m.type === "audio" ? "image" : m.type,
                  caption: m.caption || "",
                }))
              : undefined
          }
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
        />
      </Modal>
    </div>
  );
}
