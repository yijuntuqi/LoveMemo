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
  permanentDeleteAllDeletedRecords,
  getSettings,
} from "../db";
import { getMediaUrl } from "../utils/media";
import { getThemeClasses } from "../utils/theme";
import Modal from "../components/Modal";
import type { MemoryEvent, MediaItem, Anniversary, AppSettings } from "../types";

type Tab = "events" | "media" | "anniversaries";

export default function RecycleBin() {
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    type: Tab;
    id: number;
    title: string;
  }>({ open: false, type: "events", id: 0, title: "" });
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

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
      const [e, m, a, s] = await Promise.all([
        getDeletedEvents(),
        getDeletedMedia(),
        getDeletedAnniversaries(),
        getSettings(),
      ]);
      setEvents(e);
      setMedia(m);
      setAnniversaries(a);
      setSettings(s as AppSettings);
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

  function openDeleteConfirm(type: Tab, id: number, title: string) {
    setConfirm({ open: true, type, id, title });
  }

  function closeDeleteConfirm() {
    setConfirm((prev) => ({ ...prev, open: false }));
  }

  async function executeDelete() {
    const { type, id } = confirm;
    closeDeleteConfirm();
    try {
      if (type === "events") await permanentDeleteEvent(id);
      if (type === "media") await permanentDeleteMedia(id);
      if (type === "anniversaries") await permanentDeleteAnniversary(id);
      await load();
    } catch (e) {
      alert("删除失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleDeleteAll() {
    setDeleteAllLoading(true);
    try {
      const count = await permanentDeleteAllDeletedRecords();
      setDeleteAllConfirmOpen(false);
      alert(`已彻底删除 ${count} 条内容`);
      await load();
    } catch (e) {
      alert("删除失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeleteAllLoading(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Calendar }[] = [
    { key: "events", label: `故事 (${events.length})`, icon: Calendar },
    { key: "media", label: `媒体 (${media.length})`, icon: Image },
    { key: "anniversaries", label: `纪念日 (${anniversaries.length})`, icon: Gift },
  ];

  const t = getThemeClasses(settings.theme);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${t.loadingColor}`} />
      </div>
    );
  }

  const total = events.length + media.length + anniversaries.length;

  return (
    <div className={`h-full flex flex-col p-8 ${t.pageBg}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${t.title}`}>回收站</h2>
          <p className={`${t.subtitle} mt-1`}>删除的内容会暂存在这里，可恢复或彻底清空</p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
              <AlertTriangle className="w-4 h-4" />
              共 {total} 条已删除内容
            </div>
            <button
              onClick={() => setDeleteAllConfirmOpen(true)}
              disabled={deleteAllLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              全部删除
            </button>
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
                ? `${t.accentBg} ${t.accent} font-medium`
                : `bg-white text-slate-600 ${t.accentBgHover} border ${t.cardBorder}`
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
              <Empty text="没有已删除的故事" theme={t} />
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={`bg-white rounded-2xl p-5 border ${t.cardBorder} shadow-sm flex items-center justify-between`}
                >
                  <div>
                    <div className={`flex items-center gap-2 text-sm ${t.accent} font-medium`}>
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
                      className={`flex items-center gap-1 px-4 py-2 text-sm ${t.accent} ${t.accentBgHover} rounded-xl transition-colors`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      恢复
                    </button>
                    <button
                      onClick={() =>
                        openDeleteConfirm("events", event.id, event.title)
                      }
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
                <Empty text="没有已删除的媒体文件" theme={t} />
              </div>
            ) : (
              media.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl overflow-hidden border ${t.cardBorder} shadow-sm`}
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
                      className={`flex-1 py-1.5 text-xs ${t.accent} ${t.accentBgHover} rounded-lg transition-colors`}
                    >
                      恢复
                    </button>
                    <button
                      onClick={() =>
                        openDeleteConfirm(
                          "media",
                          item.id,
                          item.caption || "媒体文件",
                        )
                      }
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
              <Empty text="没有已删除的纪念日" theme={t} />
            ) : (
              anniversaries.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl p-5 border ${t.cardBorder} shadow-sm flex items-center justify-between`}
                >
                  <div>
                    <div className={`flex items-center gap-2 text-sm ${t.accent} font-medium`}>
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
                      className={`flex items-center gap-1 px-4 py-2 text-sm ${t.accent} ${t.accentBgHover} rounded-xl transition-colors`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      恢复
                    </button>
                    <button
                      onClick={() =>
                        openDeleteConfirm("anniversaries", item.id, item.title)
                      }
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

      <Modal
        isOpen={confirm.open}
        onClose={closeDeleteConfirm}
        title="确认彻底删除"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">
                即将彻底删除：
                <span className="font-semibold text-slate-900 ml-1">
                  {confirm.title}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                删除后将无法恢复，请确认是否继续。
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={closeDeleteConfirm}
              className="px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={executeDelete}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors text-sm shadow-lg shadow-red-200"
            >
              彻底删除
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteAllConfirmOpen}
        onClose={() => setDeleteAllConfirmOpen(false)}
        title="确认清空回收站"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">
                即将彻底删除回收站中的全部内容。
              </p>
              <p className="text-xs text-slate-500 mt-1">
                共 {total} 条，删除后将无法恢复，请确认是否继续。
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteAllConfirmOpen(false)}
              disabled={deleteAllLoading}
              className="px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors text-sm disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deleteAllLoading}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors text-sm shadow-lg shadow-red-200 disabled:opacity-50"
            >
              {deleteAllLoading ? "删除中..." : "全部删除"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Empty({ text, theme }: { text: string; theme: ReturnType<typeof getThemeClasses> }) {
  return (
    <div className="flex flex-col items-center justify-center text-slate-400 py-16">
      <Trash2 className={`w-12 h-12 mb-3 ${theme.emptyIcon}`} />
      <p>{text}</p>
    </div>
  );
}
