import { useEffect, useState } from "react";
import { Heart, Lock, Mail, Eye, EyeOff, Phone } from "lucide-react";
import { getSettings, saveSettings } from "../db";
import { register, login, fetchUserInfo } from "../utils/api";
import { fetch } from "../utils/http";
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

  async function persistAuth(token: string, user: UserInfo) {
    const next = { ...settings, authToken: token, _userInfo: JSON.stringify(user) };
    setSettings(next);
    setUserInfo(user);
    await saveSettings({ authToken: token, _userInfo: JSON.stringify(user) });
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

  if (serverChecking) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-rose-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto" />
          <p className="mt-4 text-slate-500">正在连接 LoveMemo 服务...</p>
        </div>
      </div>
    );
  }

  if (!serverOk) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-rose-50 p-8">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg border border-rose-100 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-rose-500" />
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
            className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors"
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
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl border border-rose-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-200">
            <Heart className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">LoveMemo</h1>
          <p className="text-slate-500 mt-1">恋爱纪念册</p>
        </div>

        <div className="flex rounded-xl bg-rose-50 p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "login"
                ? "bg-white text-rose-600 shadow-sm"
                : "text-slate-500 hover:text-rose-500"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "register"
                ? "bg-white text-rose-600 shadow-sm"
                : "text-slate-500 hover:text-rose-500"
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              手机号 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
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
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="至少 6 位"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-rose-500"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-xl transition-colors font-medium shadow-lg shadow-rose-200"
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
