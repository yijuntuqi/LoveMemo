import { useEffect, useRef, useState } from "react";
import {
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
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  getSettings,
  saveSettings,
  deleteSetting,
  exportAllData,
  importAllData,
  clearAllData,
  type AppBackup,
} from "../db";
import {
  pickJsonFile,
  pickSaveJsonPath,
  saveTextFile,
  readTextFile,
} from "../utils/file";
import Modal from "../components/Modal";
import type { AppSettings, UserInfo } from "../types";

import { fetchUserInfo, activateMembership } from "../utils/api";
import { THEMES, getThemeClasses } from "../utils/theme";
import { open } from "@tauri-apps/plugin-dialog";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [activationCode, setActivationCode] = useState("");
  const [activateLoading, setActivateLoading] = useState(false);
  const [payTab, setPayTab] = useState<"wechat" | "alipay">("wechat");
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);
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
    try {
      await saveSettings(next);
      window.dispatchEvent(new CustomEvent("lovememo-settings-changed"));
    } catch {
      // 手动保存兜底失败时由后续自动保存再尝试
    }
  }

  function handleChange(key: keyof AppSettings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    // 日期选择后立刻保存并通知，确保左下角天数即时刷新
    if (key === "startDate") {
      void saveAndNotify({ [key]: value });
    }
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

  async function handleClearAll() {
    setClearAllLoading(true);
    try {
      await clearAllData();
      setClearAllConfirmOpen(false);
      alert("所有记录已清空，页面将刷新");
      window.location.reload();
    } catch (e) {
      alert("清空失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setClearAllLoading(false);
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
    // 只删除登录凭证，保留本地数据和 _lastUserId
    // 这样同一账号重新登录时数据还在；切换到不同账号时由 AuthGate 清理
    await deleteSetting("authToken");
    await deleteSetting("_userInfo");
    setSettings((prev) => {
      const next = { ...prev };
      delete next.authToken;
      delete next._userInfo;
      return next;
    });
    setUserInfo(null);
    window.dispatchEvent(new CustomEvent("lovememo-settings-changed"));
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

  function getMembershipStatus(user: UserInfo | null) {
    if (!user || user.membership_type !== "premium") {
      return {
        isPremium: false,
        isExpiringSoon: false,
        isExpired: false,
        daysLeft: null,
      };
    }
    if (!user.membership_expires_at) {
      return {
        isPremium: true,
        isExpiringSoon: false,
        isExpired: false,
        daysLeft: null,
      };
    }
    const expires = new Date(user.membership_expires_at);
    const now = new Date();
    const daysLeft = Math.floor(
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      isPremium: true,
      isExpiringSoon: daysLeft >= 0 && daysLeft <= 7,
      isExpired: daysLeft < 0,
      daysLeft,
    };
  }

  const membershipStatus = getMembershipStatus(userInfo);
  const showRenewal =
    !membershipStatus.isPremium ||
    membershipStatus.isExpiringSoon ||
    membershipStatus.isExpired;

  const t = getThemeClasses(settings.theme);

  return (
    <div className={`h-full flex flex-col p-8 overflow-y-auto scrollbar-thin ${t.pageBg}`}>
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${t.title}`}>设置</h2>
        <p className={`${t.subtitle} mt-1`}>自定义你们的 LoveMemo</p>
      </div>

      <div className="space-y-6 max-w-4xl">
        <section className={`bg-white rounded-2xl p-6 shadow-sm border ${t.cardBorder}`}>
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
                className={`w-full px-4 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
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
                className={`w-full px-4 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
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
                className={`w-full px-4 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
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
                className={`w-full px-4 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
              />
            </div>
          </div>
        </section>

        <section className={`bg-white rounded-2xl p-6 shadow-sm border ${t.cardBorder}`}>
          <h3 className="text-lg font-bold text-slate-800 mb-4">外观主题</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEMES.map((theme) => {
              const classes = getThemeClasses(theme.key);
              const selected = (settings.theme || "rose") === theme.key;
              return (
                <button
                  key={theme.key}
                  onClick={() => handleChange("theme", theme.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    selected
                      ? `${classes.accentBg} ${classes.accentBorder} ring-2 ${classes.accentBorder.replace("border", "ring")}`
                      : `border-slate-200 hover:${t.accentBorder} ${t.accentBgHover}`
                  }`}
                >
                  <span className="text-2xl">{theme.emoji}</span>
                  <span className="text-sm font-medium text-slate-700">
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`bg-white rounded-2xl p-6 shadow-sm border ${t.cardBorder}`}>
          <div className="flex items-center gap-3 mb-4">
            <User className={`w-5 h-5 ${t.accent}`} />
            <h3 className="text-lg font-bold text-slate-800">账号</h3>
          </div>

          {userInfo ? (
            <div className="space-y-4">
              <div className={`p-4 ${t.accentBg} rounded-xl border ${t.cardBorder}`}>
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
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  请勿在同一设备上切换不同账号。本设备上的恋爱记录与本地账号绑定，切换或登录其它账号会清除当前设备的本地数据，且无法恢复。如需换设备，请先在「数据管理」中导出备份。
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">未登录</p>
          )}
        </section>

        <section className={`bg-white rounded-2xl p-6 shadow-sm border ${t.cardBorder}`}>
          <h3 className="text-lg font-bold text-slate-800 mb-4">数据管理</h3>
          <p className="text-sm text-slate-500 mb-4">
            将所有恋爱记录导出为 JSON 文件备份，或在更换设备时导入恢复。
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportBackup}
              disabled={backupLoading}
              className={`flex items-center gap-2 px-5 py-2.5 bg-white border ${t.accentBorder} ${t.accent} ${t.accentBgHover} rounded-xl transition-colors disabled:opacity-50`}
            >
              <Download className="w-4 h-4" />
              <span>{backupLoading ? "导出中..." : "导出备份"}</span>
            </button>
            <button
              onClick={handleImportBackup}
              disabled={restoreLoading}
              className={`flex items-center gap-2 px-5 py-2.5 bg-white border ${t.accentBorder} ${t.accent} ${t.accentBgHover} rounded-xl transition-colors disabled:opacity-50`}
            >
              <Upload className="w-4 h-4" />
              <span>{restoreLoading ? "导入中..." : "导入恢复"}</span>
            </button>
            <button
              onClick={() => setClearAllConfirmOpen(true)}
              disabled={clearAllLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearAllLoading ? "清空中..." : "清空全部"}</span>
            </button>
          </div>
        </section>

        <section className={`bg-white rounded-2xl p-6 shadow-sm border ${t.cardBorder}`}>
          <div className="flex items-center gap-3 mb-4">
            <FolderOpen className={`w-5 h-5 ${t.accent}`} />
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
                className={`flex-1 px-4 py-2 rounded-xl border ${t.accentBorder} bg-slate-50 text-slate-600 text-sm focus:outline-none`}
              />
              <button
                type="button"
                onClick={handlePickMediaPath}
                className={`px-4 py-2 ${t.accentBg} ${t.accent} rounded-xl ${t.accentBgHover} transition-colors text-sm font-medium`}
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
                {membershipStatus.isExpired
                  ? "会员已过期，请及时续费"
                  : membershipStatus.isExpiringSoon
                    ? `会员即将到期，还剩 ${membershipStatus.daysLeft} 天`
                    : membershipStatus.isPremium
                      ? "当前为会员版"
                      : "当前为免费版"}
              </p>
            </div>
          </div>

          {showRenewal && (
            <div className="mb-5 p-3 bg-white/80 rounded-xl border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {membershipStatus.isExpired
                    ? "会员权益已暂停"
                    : membershipStatus.isExpiringSoon
                      ? "会员权益即将暂停"
                      : "解锁更多专属功能"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {membershipStatus.isExpired || membershipStatus.isExpiringSoon
                    ? "续费后即可继续享受会员权益"
                    : "开通会员后可使用 AI 润色、无水印导出等高级功能"}
                </p>
              </div>
            </div>
          )}

          <ul className="space-y-2 mb-5">
            {membershipBenefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <Check className={`w-4 h-4 ${t.accent}`} />
                {benefit}
              </li>
            ))}
          </ul>

          {showRenewal && (
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
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full ${t.accentBg} ${t.accent} text-xs flex items-center justify-center font-medium`}>1</span>
                    <span>扫描上方二维码完成付款</span>
                  </p>
                  <p className="text-sm text-slate-700 flex items-start gap-2">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full ${t.accentBg} ${t.accent} text-xs flex items-center justify-center font-medium`}>2</span>
                    <span>将转账单号发送至以下联系方式</span>
                  </p>
                  <div className="pl-7 space-y-1.5">
                    <a
                      href="mailto:202411109014@mail.bnu.edu.cn"
                      className={`flex items-center gap-2 text-sm ${t.accent} ${t.accentHover}`}
                    >
                      <Mail className="w-4 h-4" />
                      <span>202411109014@mail.bnu.edu.cn</span>
                    </a>
                    <p className={`flex items-center gap-2 text-sm ${t.accent}`}>
                      <MessageCircle className="w-4 h-4" />
                      <span>微信号：zy17796591211</span>
                    </p>
                  </div>
                  <p className="text-sm text-slate-700 flex items-start gap-2">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full ${t.accentBg} ${t.accent} text-xs flex items-center justify-center font-medium`}>3</span>
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

      <Modal
        isOpen={clearAllConfirmOpen}
        onClose={() => setClearAllConfirmOpen(false)}
        title="确认清空全部数据"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">
                这将删除所有恋爱记录、媒体和纪念日，且无法恢复。
              </p>
              <p className="text-xs text-slate-500 mt-1">
                建议先导出备份。账号登录信息不会被清除。
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setClearAllConfirmOpen(false)}
              disabled={clearAllLoading}
              className="px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors text-sm disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleClearAll}
              disabled={clearAllLoading}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors text-sm shadow-lg shadow-red-200 disabled:opacity-50"
            >
              {clearAllLoading ? "清空中..." : "确认清空"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
