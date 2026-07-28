import { useEffect, useState } from "react";
import { Sparkles, ImagePlus, X, MapPin, Search, Loader2 } from "lucide-react";
import { pickMediaFile, importMediaWithSettings, getMediaUrl, isVideo } from "../utils/media";
import { generateMemoryText, isPremiumUser } from "../utils/ai";
import { searchLocation, type LocationResult, formatCoordinate } from "../utils/location";
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
  showOnMap: boolean;
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
    showOnMap: true,
    media: [],
  });
  const [tempMediaFiles, setTempMediaFiles] = useState<{ original: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);

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
        showOnMap: initialData.showOnMap !== false,
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
        showOnMap: true,
        media: [],
      });
    }
    setSearchQuery("");
    setSearchResults([]);
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
    // 先使用原始路径预览，等保存时再统一复制
    setTempMediaFiles((prev) => [...prev, { original: path }]);
    const type = isVideo(path) ? "video" : "image";
    const newMedia = { path, type: type as "image" | "video", caption: "" };
    setForm((prev) => ({
      ...prev,
      media: [...prev.media, newMedia],
      coverImage: prev.coverImage || path,
    }));
  }

  function removeMedia(index: number) {
    setForm((prev) => {
      const removed = prev.media[index];
      const next = prev.media.filter((_, i) => i !== index);
      if (removed) {
        setTempMediaFiles((tmp) => tmp.filter((t) => t.original !== removed.path));
      }
      return {
        ...prev,
        media: next,
        coverImage:
          prev.coverImage === removed?.path
            ? next[0]?.path || ""
            : prev.coverImage,
      };
    });
  }

  async function finalizeMedia(): Promise<EventFormData["media"]> {
    const finalized: EventFormData["media"] = [];
    for (const item of form.media) {
      const temp = tempMediaFiles.find((t) => t.original === item.path);
      if (temp) {
        try {
          const importedPath = await importMediaWithSettings(item.path);
          finalized.push({ ...item, path: importedPath });
        } catch (e) {
          alert("保存媒体失败: " + e);
          throw e;
        }
      } else {
        finalized.push(item);
      }
    }
    return finalized;
  }

  async function handleAiGenerate() {
    if (!form.title && !form.content) {
      alert("请先填写标题或内容");
      return;
    }
    if (!isPremiumUser(settings)) {
      alert("AI 润色是会员专属功能\n\n开通会员即可享受：\n• 无限次 AI 文案润色\n• 高级纪念册模板\n• 无水印导出\n\n前往「设置 → 会员中心」扫码支付，获取激活码后输入即可开通。");
      return;
    }
    setAiLoading(true);
    try {
      const prompt = `标题：${form.title}\n内容：${form.content}\n地点：${form.location || "未填写"}\n请为这段恋爱回忆生成一段温柔浪漫的文案。`;
      const text = await generateMemoryText(prompt, settings);
      updateField("content", text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("会员") || msg.includes("权限") || msg.includes("Forbidden")) {
        alert("AI 润色是会员专属功能，请前往「设置 → 会员中心」开通会员。");
      } else {
        alert("AI 生成失败: " + msg);
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSearchLocation() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const results = await searchLocation(searchQuery.trim(), settings);
      setSearchResults(results);
      if (results.length === 0) {
        alert("未找到相关地点，请尝试更具体的关键词");
      }
    } catch (e) {
      alert("地点搜索失败: " + e);
    } finally {
      setSearchLoading(false);
    }
  }

  function applyLocation(result: LocationResult) {
    setForm((prev) => ({
      ...prev,
      location: result.displayName,
      latitude: result.latitude.toString(),
      longitude: result.longitude.toString(),
    }));
    setSearchResults([]);
    setSearchQuery("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const finalizedMedia = await finalizeMedia();
      onSubmit({ ...form, media: finalizedMedia });
    } catch {
      // finalizeMedia 已弹窗
    }
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
          地点搜索
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchLocation())}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="输入地点名称搜索（支持全球地址）"
            />
          </div>
          <button
            type="button"
            onClick={handleSearchLocation}
            disabled={searchLoading}
            className="px-4 py-2 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200 disabled:opacity-50 flex items-center gap-1"
          >
            {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            搜索
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border border-rose-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyLocation(result)}
                className="w-full text-left px-4 py-2 hover:bg-rose-50 text-sm text-slate-700 border-b border-rose-100 last:border-0"
              >
                {result.displayName}
              </button>
            ))}
          </div>
        )}
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
            type="text"
            value={formatCoordinate(form.longitude, "lng")}
            readOnly
            className="w-full px-4 py-2 rounded-xl border border-rose-200 bg-slate-50 text-slate-600 focus:outline-none"
            placeholder="自动填充"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            纬度
          </label>
          <input
            type="text"
            value={formatCoordinate(form.latitude, "lat")}
            readOnly
            className="w-full px-4 py-2 rounded-xl border border-rose-200 bg-slate-50 text-slate-600 focus:outline-none"
            placeholder="自动填充"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={form.showOnMap}
          onChange={(e) => updateField("showOnMap", e.target.checked)}
          className="w-4 h-4 text-rose-500 rounded border-rose-200 focus:ring-rose-300"
        />
        同时添加到恋爱地图
      </label>

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
