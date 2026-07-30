import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import {
  Heart,
  Calendar,
  Image,
  MapPin,
  Gift,
  Settings,
  Trash2,
  BarChart3,
} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Timeline from "./pages/Timeline";
import Gallery from "./pages/Gallery";
import MemoryMap from "./pages/MemoryMap";
import Anniversaries from "./pages/Anniversaries";
import RecycleBin from "./pages/RecycleBin";
import Statistics from "./pages/Statistics";
import SettingsPage from "./pages/Settings";
import AuthGate from "./components/AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { getSettings, cleanupDeletedRecords } from "./db";
import { checkAndNotifyAnniversaries } from "./utils/notification";
import { getThemeClasses } from "./utils/theme";
import type { AppSettings } from "./types";

function App() {
  const [settings, setSettings] = useState<AppSettings>({});

  useEffect(() => {
    getSettings().then((s) => {
      const loaded = s as AppSettings;
      setSettings(loaded);

      // 启动后自动清理回收站中超过保留期的数据
      const retentionDays = Number(loaded.recycleBinRetentionDays) || 30;
      cleanupDeletedRecords(retentionDays).catch(() => {
        // 清理失败不打扰用户
      });
    });

    function refreshSettings() {
      getSettings().then((s) => setSettings(s as AppSettings));
    }

    window.addEventListener("lovememo-settings-changed", refreshSettings);

    // 启动后检查近期纪念日并发送桌面提醒
    const timer = setTimeout(() => {
      checkAndNotifyAnniversaries(7);
    }, 2000);

    return () => {
      window.removeEventListener("lovememo-settings-changed", refreshSettings);
      clearTimeout(timer);
    };
  }, []);

  const navItems = [
    { to: "/", label: "首页", icon: Heart },
    { to: "/timeline", label: "时间线", icon: Calendar },
    { to: "/gallery", label: "相册", icon: Image },
    { to: "/map", label: "恋爱地图", icon: MapPin },
    { to: "/anniversaries", label: "纪念日", icon: Gift },
    { to: "/statistics", label: "统计", icon: BarChart3 },
    { to: "/recycle", label: "回收站", icon: Trash2 },
    { to: "/settings", label: "设置", icon: Settings },
  ];

  function daysTogether(): number | null {
    if (!settings.startDate) return null;
    const start = new Date(settings.startDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  const t = getThemeClasses(settings.theme);

  return (
    <div className={`flex h-full ${t.pageBg} print:block`}>
      <aside className={`w-64 flex-shrink-0 bg-white/80 backdrop-blur border-r ${t.cardBorder} flex flex-col print:hidden`}>
        <div className="p-6 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.heroGradient} flex items-center justify-center shadow-lg ${t.heroShadow}`}>
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold bg-gradient-to-r ${t.heroGradient} bg-clip-text text-transparent`}>
              LoveMemo
            </h1>
            <p className="text-xs text-slate-400">恋爱纪念册</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? `${t.accentBg} ${t.accent} font-medium shadow-sm`
                    : `text-slate-600 ${t.accentBgHover} ${t.accentHover}`
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={`p-4 border-t ${t.cardBorder}`}>
          <div className={`bg-gradient-to-br ${t.accentBg} to-white rounded-xl p-4`}>
            <p className={`text-sm font-medium ${t.accent}`}>已相恋</p>
            <p className={`text-2xl font-bold ${t.accent} mt-1`}>
              {daysTogether() !== null ? `${daysTogether()} 天` : "-- 天"}
            </p>
            {settings.coupleName && (
              <p className={`text-xs ${t.accent} mt-1 truncate opacity-80`}>
                {settings.coupleName}
              </p>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden print:overflow-visible print:h-auto">
        <ErrorBoundary>
          <AuthGate>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/map" element={<MemoryMap />} />
              <Route path="/anniversaries" element={<Anniversaries />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/recycle" element={<RecycleBin />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AuthGate>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
