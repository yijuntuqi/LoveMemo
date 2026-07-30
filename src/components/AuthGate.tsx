import { useEffect, useState } from "react";
import { Heart, Lock, Mail, Eye, EyeOff, Phone } from "lucide-react";
import { getSettings, saveSettings, clearAllData } from "../db";
import { register, login, fetchUserInfo } from "../utils/api";
import { fetch } from "../utils/http";
import { getThemeClasses } from "../utils/theme";
import type { AppSettings, UserInfo, AuthResponse } from "../types";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [settings, setSettings] = useState<AppSettings>({});
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverChecking, setServerChecking] = useState(true);
  const [serverOk, setServerOk] = useState(false);

  useEffect(() => {
    async function init() {
      console.log("[AuthGate] init start");
      let s: Record<string, string> = {};
      try {
        s = await getSettings();
        console.log("[AuthGate] settings loaded", s);
      } catch (e) {
        console.error("[AuthGate] getSettings failed", e);
      }
      setSettings(s as AppSettings);
      const url = (s.serverUrl || "http://localhost:3000").replace(/\/$/, "");
      console.log("[AuthGate] health url", `${url}/health`);
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("health check timeout")), 3000),
        );
        const res = (await Promise.race([
          fetch(`${url}/health`, { method: "GET" }),
          timeoutPromise,
        ])) as Response;
        console.log("[AuthGate] health ok", res.status);
        setServerOk(res.ok);
      } catch (e) {
        console.error("[AuthGate] health failed", e);
        setServerOk(false);
      } finally {
        console.log("[AuthGate] serverChecking done");
        setServerChecking(false);
      }
      if (s.authToken) {
        try {
          const info = await fetchUserInfo(s as AppSettings);
          console.log("[AuthGate] user info loaded", info);
          setUserInfo(info);
        } catch (e) {
          console.error("[AuthGate] fetch user info failed", e);
          setUserInfo(null);
        }
      }
    }
    init();
  }, []);

  // 监听设置变化：退出登录后 token 被清空，立即回到登录页
  useEffect(() => {
    async function refresh() {
      const s = await getSettings();
      setSettings(s as AppSettings);
      if (s.authToken) {
        try {
          const info = await fetchUserInfo(s as AppSettings);
          setUserInfo(info);
        } catch {
          setUserInfo(null);
        }
      } else {
        setUserInfo(null);
      }
    }
    window.addEventListener("lovememo-settings-changed", refresh);
    return () => window.removeEventListener("lovememo-settings-changed", refresh);
  }, []);

  async function persistAuth(token: string, user: UserInfo) {
    const current = await getSettings();
    // 如果登录的是不同账号，清空旧账号的本地数据，避免新账号看到别人的记录
    if (current._lastUserId && current._lastUserId !== user.id) {
      await clearAllData();
      await saveSettings({
        coupleName: "",
        startDate: "",
        myName: "",
        partnerName: "",
      });
    }
    const next: AppSettings = {
      ...settings,
      authToken: token,
      _userInfo: JSON.stringify(user),
      _lastUserId: user.id,
      coupleName: current._lastUserId && current._lastUserId !== user.id ? "" : settings.coupleName,
      startDate: current._lastUserId && current._lastUserId !== user.id ? "" : settings.startDate,
      myName: current._lastUserId && current._lastUserId !== user.id ? "" : settings.myName,
      partnerName: current._lastUserId && current._lastUserId !== user.id ? "" : settings.partnerName,
    };
    setSettings(next);
    setUserInfo(user);
    await saveSettings({
      authToken: token,
      _userInfo: JSON.stringify(user),
      _lastUserId: user.id,
    });
    window.dispatchEvent(new CustomEvent("lovememo-settings-changed"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || password.length < 6) {
      alert("请输入手机号和至少 6 位密码");
      return;
    }
    setLoading(true);
    try {
      const res: AuthResponse =
        mode === "register"
          ? await register(settings, phone.trim(), password, email.trim() || undefined)
          : await login(settings, phone.trim(), password);
      await persistAuth(res.token, res.user);
      alert(mode === "register" ? "注册成功，欢迎来到 LoveMemo" : "登录成功");
    } catch (err) {
      const action = mode === "register" ? "注册" : "登录";
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("fetch") || msg.includes("Failed to fetch")) {
        alert(`${action}失败：无法连接后端服务，请先运行 server 目录下的 cargo run`);
      } else {
        alert(`${action}失败：${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const t = getThemeClasses(settings.theme);

  if (serverChecking) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${t.pageBg}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${t.loadingColor} mx-auto`} />
          <p className="mt-4 text-slate-500">正在连接 LoveMemo 服务...</p>
        </div>
      </div>
    );
  }

  if (!serverOk) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${t.pageBg} p-8`}>
        <div className={`max-w-md w-full bg-white rounded-2xl p-8 shadow-lg border ${t.cardBorder} text-center`}>
          <div className={`w-16 h-16 rounded-full ${t.accentBg} flex items-center justify-center mx-auto mb-4`}>
            <Heart className={`w-8 h-8 ${t.accent}`} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">LoveMemo</h2>
          <p className="text-slate-500 mb-6">无法连接到后端服务</p>
          <p className="text-sm text-slate-600 mb-6">
            请先运行 LoveMemo/server 目录下的服务，再刷新本窗口：
          </p>
          <code className="block bg-slate-100 rounded-lg p-3 text-xs text-left text-slate-700 mb-6">
            cd E:\old-new\backup\BNU_leaning\LoveMemo\server<br />
            cargo run
          </code>
          <button
            onClick={() => window.location.reload()}
            className={`px-6 py-2.5 text-white rounded-xl transition-colors ${t.buttonPrimary}`}
          >
            我已启动服务，刷新
          </button>
        </div>
      </div>
    );
  }

  if (userInfo) {
    return <>{children}</>;
  }

  return (
    <div className={`h-full w-full flex items-center justify-center ${t.pageBg} p-6`}>
      <div className={`w-full max-w-md bg-white rounded-2xl p-8 shadow-xl border ${t.cardBorder}`}>
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${t.heroGradient} flex items-center justify-center mx-auto mb-4 shadow-lg ${t.heroShadow}`}>
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">LoveMemo</h1>
          <p className="text-slate-500 mt-1">恋爱纪念册</p>
        </div>

        <div className={`flex rounded-xl ${t.accentBg} p-1 mb-6`}>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "login"
                ? `bg-white ${t.accent} shadow-sm`
                : `text-slate-500 ${t.accentHover}`
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "register"
                ? `bg-white ${t.accent} shadow-sm`
                : `text-slate-500 ${t.accentHover}`
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              手机号 <span className={t.accent}>*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
                placeholder="请输入手机号"
                required
              />
            </div>
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                邮箱（选填）
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
                  placeholder="选填，用于找回密码"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing}`}
                placeholder="至少 6 位"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`absolute right-3 top-2.5 text-slate-400 ${t.accentHover}`}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 disabled:opacity-60 text-white rounded-xl transition-colors font-medium shadow-lg ${t.heroShadow} ${t.buttonPrimary}`}
          >
            {loading ? "请稍候..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          登录即表示你同意将账号信息用于 LoveMemo 会员服务
        </p>
      </div>
    </div>
  );
}
