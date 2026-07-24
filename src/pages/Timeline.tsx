import { useEffect, useState } from "react";
import { Plus, Heart, Edit2, Trash2, MapPin, Calendar, Printer } from "lucide-react";
import {
  initDatabase,
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
import type { MemoryEvent, MediaItem } from "../types";
import type { EventFormData } from "../components/EventForm";

export default function Timeline() {
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<number, MediaItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MemoryEvent | null>(null);

  useEffect(() => {
    async function load() {
      await initDatabase();
      const data = await getEvents();
      setEvents(data);

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
    const input = {
      title: form.title,
      content: form.content,
      date: form.date,
      location: form.location || undefined,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      tags: form.tags || undefined,
      coverImage: form.coverImage || undefined,
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
  }

  async function handleDelete(id: number) {
    if (!confirm("确定要删除这条记录吗？")) return;
    await deleteEvent(id);
    await refreshEvents();
  }

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

  return (
    <div className="h-full flex flex-col p-8 print:p-0 print:bg-white print:h-auto">
      <div className="flex items-center justify-between mb-8 print:hidden">
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
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-lg shadow-rose-200"
          >
            <Plus className="w-5 h-5" />
            <span>新增记录</span>
          </button>
        </div>
      </div>

      <div className="hidden print:block mb-6 text-center">
        <h1 className="text-3xl font-bold text-rose-600">LoveMemo 恋爱纪念册</h1>
        <p className="text-slate-500 mt-2">记录属于我们的每一个重要时刻</p>
      </div>

      {events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mb-4">
            <Heart className="w-10 h-10 text-rose-400" />
          </div>
          <p className="text-lg">还没有记录哦</p>
          <p className="text-sm mt-1">点击右上角开始记录你们的故事</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-2 print:overflow-visible print:pr-0">
          <div className="relative pl-8 border-l-2 border-rose-200 space-y-8 print:border-rose-300 print:pl-8">
            {events.map((event) => (
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
