import { useEffect, useState } from "react";
import {
  Gift,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Heart,
  Plane,
  Cake,
  Gem,
  Sparkles,
  Milestone,
} from "lucide-react";
import {
  initDatabase,
  getAnniversaries,
  getSettings,
  createAnniversary,
  updateAnniversary,
  deleteAnniversary,
} from "../db";
import Modal from "../components/Modal";
import { getThemeClasses } from "../utils/theme";
import type { Anniversary, AnniversaryCategory, AppSettings } from "../types";

const CATEGORIES: { value: AnniversaryCategory; label: string; icon: React.ReactNode }[] = [
  { value: "date", label: "约会", icon: <Heart className="w-5 h-5" /> },
  { value: "gift", label: "礼物", icon: <Gift className="w-5 h-5" /> },
  { value: "travel", label: "旅行", icon: <Plane className="w-5 h-5" /> },
  { value: "kiss", label: "亲密", icon: <Sparkles className="w-5 h-5" /> },
  { value: "wedding", label: "婚礼", icon: <Gem className="w-5 h-5" /> },
  { value: "birthday", label: "生日", icon: <Cake className="w-5 h-5" /> },
  { value: "custom", label: "其他", icon: <Milestone className="w-5 h-5" /> },
];

const REPEAT_TYPES: { value: Anniversary["repeatType"]; label: string }[] = [
  { value: "none", label: "不重复" },
  { value: "weekly", label: "每周重复" },
  { value: "monthly", label: "每月重复" },
  { value: "yearly", label: "每年重复" },
];

interface FormData {
  title: string;
  date: string;
  repeatType: Anniversary["repeatType"];
  category: AnniversaryCategory;
}

export default function Anniversaries() {
  const [items, setItems] = useState<Anniversary[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Anniversary | null>(null);
  const [form, setForm] = useState<FormData>({
    title: "",
    date: "",
    repeatType: "yearly",
    category: "gift",
  });

  useEffect(() => {
    async function load() {
      await initDatabase();
      const [data, s] = await Promise.all([getAnniversaries(), getSettings()]);
      setItems(data);
      setSettings(s as AppSettings);
      setLoading(false);
    }
    load();
  }, []);

  async function refresh() {
    const data = await getAnniversaries();
    setItems(data);
  }

  function nextOccurrence(dateStr: string, repeatType: Anniversary["repeatType"]): Date {
    const now = new Date();
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);

    if (repeatType === "none") return target;

    while (target < now) {
      if (repeatType === "weekly") target.setDate(target.getDate() + 7);
      else if (repeatType === "monthly") target.setMonth(target.getMonth() + 1);
      else if (repeatType === "yearly") target.setFullYear(target.getFullYear() + 1);
    }

    return target;
  }

  function daysUntil(dateStr: string, repeatType: Anniversary["repeatType"]): number {
    const target = nextOccurrence(dateStr, repeatType);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function categoryInfo(category: AnniversaryCategory) {
    return CATEGORIES.find((c) => c.value === category) || CATEGORIES[6];
  }

  function openCreate() {
    setEditing(null);
    setForm({ title: "", date: "", repeatType: "yearly", category: "gift" });
    setIsOpen(true);
  }

  function openEdit(item: Anniversary) {
    setEditing(item);
    setForm({
      title: item.title,
      date: item.date,
      repeatType: item.repeatType || "yearly",
      category: item.category || "gift",
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await updateAnniversary(editing.id, form);
      } else {
        await createAnniversary(form);
      }
      setIsOpen(false);
      await refresh();
    } catch (e) {
      console.error("保存纪念日失败:", e);
      alert("保存失败: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除这个纪念日吗？")) return;
    await deleteAnniversary(id);
    await refresh();
  }

  const t = getThemeClasses(settings.theme);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${t.loadingColor}`} />
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col p-8 ${t.pageBg}`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className={`text-2xl font-bold ${t.title}`}>纪念日</h2>
          <p className={`${t.subtitle} mt-1`}>让每一个特别的日子都不被遗忘</p>
        </div>
        <button
          onClick={openCreate}
          className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl transition-colors shadow-lg ${t.buttonPrimary}`}
        >
          <Plus className="w-5 h-5" />
          <span>新增纪念日</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Gift className={`w-16 h-16 mb-4 ${t.emptyIcon}`} />
          <p>还没有纪念日</p>
          <p className="text-sm mt-1">添加第一次牵手、初吻、周年纪念日等</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const days = daysUntil(item.date, item.repeatType);
              const info = categoryInfo(item.category);
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl p-5 shadow-sm border ${t.cardBorder} hover:shadow-md transition-shadow group`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl ${t.accentBg} flex items-center justify-center`}>
                      <span className={t.accent}>{info.icon}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(item)}
                        className={`p-2 text-slate-400 ${t.accentHover} ${t.accentBgHover} rounded-lg transition-colors`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mt-4">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                    <Calendar className="w-4 h-4" />
                    {item.date}
                    <span className={`text-xs ${t.accentBg} ${t.accent} px-2 py-0.5 rounded-full`}>
                      {REPEAT_TYPES.find((r) => r.value === item.repeatType)?.label || "每年"}
                    </span>
                  </div>
                  <div className={`mt-4 pt-4 border-t ${t.cardBorder}`}>
                    <p className={`text-3xl font-bold ${t.accent}`}>
                      {days === 0 ? "今天" : `${days} 天后`}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {days === 0 ? "记得庆祝哦" : `${info.label} 纪念日`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={editing ? "编辑纪念日" : "新增纪念日"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              标题
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`w-full px-4 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
              placeholder="例如：一周年纪念日"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              日期
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={`w-full px-4 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              重复周期
            </label>
            <select
              value={form.repeatType}
              onChange={(e) =>
                setForm({ ...form, repeatType: e.target.value as Anniversary["repeatType"] })
              }
              className={`w-full px-4 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
            >
              {REPEAT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              纪念日类型
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: c.value })}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors ${
                    form.category === c.value
                      ? `${t.accentBorder} ${t.accentBg} ${t.accent}`
                      : `${t.accentBorder} text-slate-500 ${t.accentBgHover}`
                  }`}
                >
                  {c.icon}
                  <span className="text-xs">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="submit"
              className={`px-6 py-2 text-white rounded-xl ${t.buttonPrimary}`}
            >
              保存
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
