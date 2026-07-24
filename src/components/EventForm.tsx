import { useEffect, useState } from "react";
import { Sparkles, ImagePlus, X, MapPin } from "lucide-react";
import { pickMediaFile, importMedia, getMediaUrl, isVideo } from "../utils/media";
import { generateMemoryText } from "../utils/ai";
import { getSettings } from "../db";
import type { MemoryEvent, AppSettings } from "../types";

interface EventFormProps {
  initialData?: Partial<MemoryEvent>;
  initialMedia?: { path: string; type: "image" | "video"; caption: string }[];
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
}

export interface EventFormData {
  title: string;
  content: string;
  date: string;
  location: string;
  latitude: string;
  longitude: string;
  tags: string;
  coverImage: string;
  media: { path: string; type: "image" | "video"; caption: string }[];
}

export default function EventForm({
  initialData,
  initialMedia,
  onSubmit,
  onCancel,
}: EventFormProps) {
  const [form, setForm] = useState<EventFormData>({
    title: "",
    content: "",
    date: new Date().toISOString().split("T")[0],
    location: "",
    latitude: "",
    longitude: "",
    tags: "",
    coverImage: "",
    media: [],
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({});

  useEffect(() => {
    getSettings().then((s) => setSettings(s as AppSettings));
    if (initialData) {
      setForm((prev) => ({
        ...prev,
        title: initialData.title || "",
        content: initialData.content || "",
        date: initialData.date || prev.date,
        location: initialData.location || "",
        latitude: initialData.latitude?.toString() || "",
        longitude: initialData.longitude?.toString() || "",
        tags: initialData.tags || "",
        coverImage: initialData.coverImage || "",
        media: initialMedia || [],
      }));
    } else {
      setForm({
        title: "",
        content: "",
        date: new Date().toISOString().split("T")[0],
        location: "",
        latitude: "",
        longitude: "",
        tags: "",
        coverImage: "",
        media: [],
      });
    }
  }, [initialData, initialMedia]);

  function updateField<K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddMedia() {
    const path = await pickMediaFile();
    if (!path) return;
    try {
      const importedPath = await importMedia(path);
      const type = isVideo(importedPath) ? "video" : "image";
      const newMedia = { path: importedPath, type: type as "image" | "video", caption: "" };
      setForm((prev) => ({
        ...prev,
        media: [...prev.media, newMedia],
        coverImage: prev.coverImage || importedPath,
      }));
    } catch (e) {
      alert("导入媒体失败: " + e);
    }
  }

  function removeMedia(index: number) {
    setForm((prev) => {
      const next = prev.media.filter((_, i) => i !== index);
      return {
        ...prev,
        media: next,
        coverImage:
          prev.coverImage === prev.media[index]?.path
            ? next[0]?.path || ""
            : prev.coverImage,
      };
    });
  }

  async function handleAiGenerate() {
    if (!form.title && !form.content) {
      alert("请先填写标题或内容");
      return;
    }
    setAiLoading(true);
    try {
      const prompt = `标题：${form.title}\n内容：${form.content}\n地点：${form.location || "未填写"}\n请为这段恋爱回忆生成一段温柔浪漫的文案。`;
      const text = await generateMemoryText(prompt, settings);
      updateField("content", text);
    } catch (e) {
      alert("AI 生成失败: " + e);
    } finally {
      setAiLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          标题
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
          placeholder="例如：第一次约会"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            日期
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => updateField("date", e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            标签
          </label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => updateField("tags", e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="约会, 旅行, 纪念日"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          地点
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="例如：星巴克（珠海）"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            经度
          </label>
          <input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(e) => updateField("longitude", e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="113.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            纬度
          </label>
          <input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(e) => updateField("latitude", e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="22.2"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-slate-600">
            故事内容
          </label>
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={aiLoading}
            className="flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-600 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? "生成中..." : "AI 润色"}
          </button>
        </div>
        <textarea
          value={form.content}
          onChange={(e) => updateField("content", e.target.value)}
          rows={5}
          className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
          placeholder="写下你们的故事..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">
          照片 / 视频
        </label>
        <div className="flex flex-wrap gap-3">
          {form.media.map((item, index) => (
            <div
              key={index}
              className="relative w-24 h-24 rounded-xl overflow-hidden border border-rose-200 group"
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
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddMedia}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-rose-200 flex flex-col items-center justify-center text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors"
          >
            <ImagePlus className="w-6 h-6 mb-1" />
            <span className="text-xs">添加</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-rose-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-lg shadow-rose-200"
        >
          保存
        </button>
      </div>
    </form>
  );
}
