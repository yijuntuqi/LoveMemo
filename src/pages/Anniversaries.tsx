import { useEffect, useState } from "react";
import { Gift, Plus, Edit2, Trash2, Calendar } from "lucide-react";
import {
  initDatabase,
  getAnniversaries,
  createAnniversary,
  updateAnniversary,
  deleteAnniversary,
} from "../db";
import Modal from "../components/Modal";
import type { Anniversary } from "../types";

interface FormData {
  title: string;
  date: string;
  repeatYearly: boolean;
}

export default function Anniversaries() {
  const [items, setItems] = useState<Anniversary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Anniversary | null>(null);
  const [form, setForm] = useState<FormData>({
    title: "",
    date: "",
    repeatYearly: true,
  });

  useEffect(() => {
    async function load() {
      await initDatabase();
      const data = await getAnniversaries();
      setItems(data);
      setLoading(false);
    }
    load();
  }, []);

  async function refresh() {
    const data = await getAnniversaries();
    setItems(data);
  }

  function daysUntil(dateStr: string, repeatYearly: boolean): number {
    const now = new Date();
    const target = new Date(dateStr);
    if (repeatYearly) {
      target.setFullYear(now.getFullYear());
      if (target < now) target.setFullYear(now.getFullYear() + 1);
    }
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function openCreate() {
    setEditing(null);
    setForm({ title: "", date: "", repeatYearly: true });
    setIsOpen(true);
  }

  function openEdit(item: Anniversary) {
    setEditing(item);
    setForm({
      title: item.title,
      date: item.date,
      repeatYearly: item.repeatYearly,
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await updateAnniversary(editing.id, form);
    } else {
      await createAnniversary(form);
    }
    setIsOpen(false);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除这个纪念日吗？")) return;
    await deleteAnniversary(id);
    await refresh();
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">纪念日</h2>
          <p className="text-slate-500 mt-1">让每一个特别的日子都不被遗忘</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-lg shadow-rose-200"
        >
          <Plus className="w-5 h-5" />
          <span>新增纪念日</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Gift className="w-16 h-16 mb-4 text-rose-200" />
          <p>还没有纪念日</p>
          <p className="text-sm mt-1">添加第一次牵手、初吻、周年纪念日等</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const days = daysUntil(item.date, item.repeatYearly);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                      <Gift className="w-6 h-6 text-rose-500" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
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
                    {item.repeatYearly && (
                      <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">
                        每年
                      </span>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-rose-100">
                    <p className="text-3xl font-bold text-rose-500">
                      {days === 0 ? "今天" : `${days} 天后`}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {days === 0 ? "记得庆祝哦" : "就要到了"}
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
              className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
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
              className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.repeatYearly}
              onChange={(e) =>
                setForm({ ...form, repeatYearly: e.target.checked })
              }
              className="w-4 h-4 text-rose-500 rounded border-rose-200 focus:ring-rose-300"
            />
            每年重复
          </label>
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
              className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl"
            >
              保存
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
