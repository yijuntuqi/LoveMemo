import { useEffect, useState } from "react";
import { Save, Sparkles, Download, Upload, Crown, Check } from "lucide-react";
import {
  getSettings,
  saveSettings,
  exportAllData,
  importAllData,
  type AppBackup,
} from "../db";
import {
  pickJsonFile,
  pickSaveJsonPath,
  saveTextFile,
  readTextFile,
} from "../utils/file";
import type { AppSettings } from "../types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [saved, setSaved] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  function handleChange(key: keyof AppSettings, value: string | boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function applyDefaultAiConfig() {
    const provider = settings.aiProvider || "moonshot";
    if (provider === "moonshot") {
      setSettings((prev) => ({
        ...prev,
        aiBaseUrl: "https://api.moonshot.cn/v1",
        aiModel: "moonshot-v1-8k",
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        aiBaseUrl: "https://api.chatanywhere.tech/v1",
        aiModel: "gpt-3.5-turbo",
      }));
    }
    setSaved(false);
  }

  async function handleExportBackup() {
    setBackupLoading(true);
    try {
      const data = await exportAllData();
      const path = await pickSaveJsonPath();
      if (!path) return;
      await saveTextFile(path, JSON.stringify(data, null, 2));
      alert("备份文件已导出");
    } catch (e) {
      alert("导出失败: " + e);
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleImportBackup() {
    if (!confirm("导入会覆盖当前所有数据，确定继续吗？")) return;
    setRestoreLoading(true);
    try {
      const path = await pickJsonFile();
      if (!path) return;
      const text = await readTextFile(path);
      const data: AppBackup = JSON.parse(text);
      await importAllData(data);
      alert("数据已恢复，页面将刷新");
      window.location.reload();
    } catch (e) {
      alert("导入失败: " + e);
    } finally {
      setRestoreLoading(false);
    }
  }

  const membershipBenefits = [
    "云端自动同步",
    "AI 无限文案生成",
    "高级 PDF 纪念册模板",
    "无水印导出",
    "专属情侣主题",
  ];

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto scrollbar-thin">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">设置</h2>
        <p className="text-slate-500 mt-1">管理你们的信息和 AI 配置</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">恋爱信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                情侣昵称
              </label>
              <input
                type="text"
                value={settings.coupleName || ""}
                onChange={(e) => handleChange("coupleName", e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="例如：小异 & 萱萱"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                相恋开始日期
              </label>
              <input
                type="date"
                value={settings.startDate || ""}
                onChange={(e) => handleChange("startDate", e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                我的名字
              </label>
              <input
                type="text"
                value={settings.myName || ""}
                onChange={(e) => handleChange("myName", e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                伴侣名字
              </label>
              <input
                type="text"
                value={settings.partnerName || ""}
                onChange={(e) => handleChange("partnerName", e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">AI 配置</h3>
            <button
              type="button"
              onClick={applyDefaultAiConfig}
              className="flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-600"
            >
              <Sparkles className="w-4 h-4" />
              恢复默认配置
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                AI 服务商
              </label>
              <select
                value={settings.aiProvider || "moonshot"}
                onChange={(e) =>
                  handleChange(
                    "aiProvider",
                    e.target.value as "moonshot" | "chatanywhere",
                  )
                }
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
              >
                <option value="moonshot">Moonshot (Kimi)</option>
                <option value="chatanywhere">ChatAnywhere</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={settings.aiApiKey || ""}
                onChange={(e) => handleChange("aiApiKey", e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="输入你的 API Key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={settings.aiBaseUrl || ""}
                onChange={(e) => handleChange("aiBaseUrl", e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="https://api.moonshot.cn/v1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                模型
              </label>
              <input
                type="text"
                value={settings.aiModel || ""}
                onChange={(e) => handleChange("aiModel", e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="例如 moonshot-v1-8k"
              />
            </div>
          </div>
        </section>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-lg shadow-rose-200"
        >
          <Save className="w-5 h-5" />
          <span>{saved ? "已保存" : "保存设置"}</span>
        </button>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">数据管理</h3>
          <p className="text-sm text-slate-500 mb-4">
            将所有恋爱记录导出为 JSON 文件备份，或在更换设备时导入恢复。
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportBackup}
              disabled={backupLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{backupLoading ? "导出中..." : "导出备份"}</span>
            </button>
            <button
              onClick={handleImportBackup}
              disabled={restoreLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{restoreLoading ? "导入中..." : "导入恢复"}</span>
            </button>
          </div>
        </section>

        <section className="bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl p-6 shadow-sm border border-amber-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">会员中心</h3>
              <p className="text-xs text-slate-500">当前为免费版</p>
            </div>
          </div>
          <ul className="space-y-2 mb-5">
            {membershipBenefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <Check className="w-4 h-4 text-rose-500" />
                {benefit}
              </li>
            ))}
          </ul>
          <button
            onClick={() => alert("会员功能即将上线，敬请期待！")}
            className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl transition-colors font-medium shadow-lg shadow-rose-200"
          >
            升级为会员
          </button>
        </section>
      </div>
    </div>
  );
}
