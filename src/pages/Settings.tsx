import { useEffect, useRef, useState } from "react";
import {
  Save,
  Download,
  Upload,
  User,
  FolderOpen,
  Crown,
  Check,
  QrCode,
  Lock,
  Mail,
  MessageCircle,
} from "lucide-react";
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
import type { AppSettings, UserInfo } from "../types";

import { fetchUserInfo, activateMembership } from "../utils/api";
import { open } from "@tauri-apps/plugin-dialog";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [saved, setSaved] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [activationCode, setActivationCode] = useState("");
  const [activateLoading, setActivateLoading] = useState(false);
  const [payTab, setPayTab] = useState<"wechat" | "alipay">("wechat");
  const initialLoadedRef = useRef(false);

  useEffect(() => {
    getSettings().then((s) => {
      const loaded = s as AppSettings;
      setSettings(loaded);
      initialLoadedRef.current = true;
    });
  }, []);

  // 自动保存设置，避免用户忘记点“保存设置”按钮
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    if (Object.keys(settings).length === 0) return;
    const timer = setTimeout(() => {
      saveSettings(settings)
        .then(() => {
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          window.dispatchEvent(new CustomEvent("lovememo-settings-changed"));
        })
        .catch(() => {
          // 自动保存失败不弹窗打扰，保留手动保存兜底
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [settings]);

  // 登录后拉取用户信息；优先用本地缓存的 _userInfo 快速展示
  useEffect(() => {
    if (!settings.authToken) {
      setUserInfo(null);
      return;
    }
    // 先用缓存快速展示
    if (settings._userInfo) {
      try {
        setUserInfo(JSON.parse(settings._userInfo));
      } catch {}
    }
    fetchUserInfo(settings)
      .then((info) => {
        setUserInfo(info);
        // 更新缓存
        saveSettings({ _userInfo: JSON.stringify(info) }).catch(() => {});
      })
      .catch(() => {
        // 拉取失败时不清空缓存，保留上次已知的好数据
      });
  }, [settings.authToken, settings.serverUrl]);

  async function saveAndNotify(next: Partial<AppSettings>) {
    const updated = { ...settings, ...next };
    setSettings(updated);
    setSaved(false);
    try {
      await saveSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      window.dispatchEvent(new CustomEvent("lovememo-settings-changed"));
    } catch {
      // 手动保存兜底失败时由后续自动保存再尝试
    }
  }

  function handleChange(key: keyof AppSettings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    // 日期选择后立刻保存并通知，确保左下角天数即时刷新
    if (key === "startDate") {
      void saveAndNotify({ [key]: value });
    }
  }

  async function handleSave() {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.dispatchEvent(new CustomEvent("lovememo-settings-changed"));
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

  async function handlePickMediaPath() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (!selected || Array.isArray(selected)) return;
      handleChange("mediaStoragePath", selected);
    } catch (e) {
      alert("选择目录失败: " + e);
    }
  }

  async function handleLogout() {
    await saveAndNotify({ authToken: undefined });
    setUserInfo(null);
  }

  async function handleActivate() {
    if (!activationCode.trim()) {
      alert("请输入激活码");
      return;
    }
    if (!settings.authToken) {
      alert("请先登录");
      return;
    }
    setActivateLoading(true);
    try {
      const user = await activateMembership(settings, activationCode.trim());
      setUserInfo(user);
      // 同步更新本地缓存并广播，让其他页面立即感知会员状态
      const next: Partial<AppSettings> = {
        _userInfo: JSON.stringify(user),
      };
      await saveSettings(next);
      setSettings((prev) => ({ ...prev, ...next }));
      setActivationCode("");
      alert("会员激活成功");
      window.dispatchEvent(new CustomEvent("lovememo-user-changed"));
    } catch (e) {
      alert("激活失败: " + e);
    } finally {
      setActivateLoading(false);
    }
  }

  const membershipBenefits = [
    "AI 无限文案生成",
    "高级 PDF 纪念册模板",
    "无水印导出",
    "专属情侣主题",
  ];

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto scrollbar-thin">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">设置</h2>
          <p className="text-slate-500 mt-1">管理你们的信息</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-lg shadow-rose-200"
        >
          <Save className="w-5 h-5" />
          <span>{saved ? "已保存" : "保存设置"}</span>
        </button>
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
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-bold text-slate-800">账号</h3>
          </div>

          {userInfo ? (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-sm text-slate-500">当前登录</p>
                <p className="font-semibold text-slate-800">{userInfo.phone}</p>
                {userInfo.email && (
                  <p className="text-xs text-slate-400 mt-1">{userInfo.email}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      userInfo.membership_type === "premium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {userInfo.membership_type === "premium" ? "会员" : "免费版"}
                  </span>
                  {userInfo.membership_expires_at && (
                    <span className="text-xs text-slate-400">
                      有效期至 {userInfo.membership_expires_at.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">未登录</p>
          )}
        </section>

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

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100">
          <div className="flex items-center gap-3 mb-4">
            <FolderOpen className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-bold text-slate-800">本地存储</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            照片和视频将保存在本地目录中，不依赖云端服务。
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.mediaStoragePath || ""}
                readOnly
                placeholder="默认保存在应用数据目录"
                className="flex-1 px-4 py-2 rounded-xl border border-rose-200 bg-slate-50 text-slate-600 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={handlePickMediaPath}
                className="px-4 py-2 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200 transition-colors text-sm font-medium"
              >
                选择目录
              </button>
            </div>
            {settings.mediaStoragePath && (
              <p className="text-xs text-slate-400">
                当前路径：{settings.mediaStoragePath}
              </p>
            )}
          </div>
        </section>

        <section className="bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl p-6 shadow-sm border border-amber-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">会员中心</h3>
              <p className="text-xs text-slate-500">
                {userInfo?.membership_type === "premium"
                  ? "当前为会员版"
                  : "当前为免费版"}
              </p>
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

          {userInfo?.membership_type !== "premium" && (
            <div className="bg-white rounded-xl p-4 border border-amber-100 mb-5">
              <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1.5">
                <QrCode className="w-4 h-4" />
                扫码支付后输入激活码
              </p>
              <div className="flex rounded-lg border border-amber-100 overflow-hidden mb-4">
                <button
                  type="button"
                  onClick={() => setPayTab("wechat")}
                  className={`flex-1 py-2 text-sm font-medium ${
                    payTab === "wechat"
                      ? "bg-green-500 text-white"
                      : "bg-white text-slate-600 hover:bg-amber-50"
                  }`}
                >
                  微信支付
                </button>
                <button
                  type="button"
                  onClick={() => setPayTab("alipay")}
                  className={`flex-1 py-2 text-sm font-medium ${
                    payTab === "alipay"
                      ? "bg-blue-500 text-white"
                      : "bg-white text-slate-600 hover:bg-amber-50"
                  }`}
                >
                  支付宝
                </button>
              </div>
              <div className="flex justify-center">
                <img
                  src={payTab === "wechat" ? "/payment/wechat-pay.png" : "/payment/alipay.png"}
                  alt={payTab === "wechat" ? "微信支付" : "支付宝"}
                  className="w-48 h-48 object-contain rounded-lg border border-amber-100"
                />
              </div>

              <div className="mt-4 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                <p className="text-xs text-slate-500 mb-2">付款后请按以下步骤获取激活码：</p>
                <div className="space-y-2">
                  <p className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs flex items-center justify-center font-medium">1</span>
                    <span>扫描上方二维码完成付款</span>
                  </p>
                  <p className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs flex items-center justify-center font-medium">2</span>
                    <span>将转账单号发送至以下联系方式</span>
                  </p>
                  <div className="pl-7 space-y-1.5">
                    <a
                      href="mailto:202411109014@mail.bnu.edu.cn"
                      className="flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700"
                    >
                      <Mail className="w-4 h-4" />
                      <span>202411109014@mail.bnu.edu.cn</span>
                    </a>
                    <p className="flex items-center gap-2 text-sm text-rose-600">
                      <MessageCircle className="w-4 h-4" />
                      <span>微信号：zy17796591211</span>
                    </p>
                  </div>
                  <p className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-xs flex items-center justify-center font-medium">3</span>
                    <span>获取激活码并输入下方文本框</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-5">
            <label className="block text-sm font-medium text-slate-700">
              激活码
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="输入激活码"
                className="flex-1 px-4 py-2 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={handleActivate}
                disabled={activateLoading || !settings.authToken}
                className="px-5 py-2 bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                {activateLoading ? "激活中..." : "激活"}
              </button>
            </div>
            {!settings.authToken && (
              <p className="text-xs text-amber-600">激活前请先登录账号</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
