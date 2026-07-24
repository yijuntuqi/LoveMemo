import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Heart, Calendar, Image, MapPin, Gift, Settings } from "lucide-react";
import Timeline from "./pages/Timeline";
import Gallery from "./pages/Gallery";
import MemoryMap from "./pages/MemoryMap";
import Anniversaries from "./pages/Anniversaries";
import SettingsPage from "./pages/Settings";
import { getSettings } from "./db";
import type { AppSettings } from "./types";

function App() {
  const [settings, setSettings] = useState<AppSettings>({});

  useEffect(() => {
    getSettings().then((s) => setSettings(s as AppSettings));
  }, []);

  const navItems = [
    { to: "/", label: "时间线", icon: Calendar },
    { to: "/gallery", label: "相册", icon: Image },
    { to: "/map", label: "恋爱地图", icon: MapPin },
    { to: "/anniversaries", label: "纪念日", icon: Gift },
    { to: "/settings", label: "设置", icon: Settings },
  ];

  function daysTogether(): number | null {
    if (!settings.startDate) return null;
    const start = new Date(settings.startDate);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="flex h-full bg-rose-50/50 print:block">
      <aside className="w-64 flex-shrink-0 bg-white/80 backdrop-blur border-r border-rose-100 flex flex-col print:hidden">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-200">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">
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
                    ? "bg-rose-100 text-rose-600 font-medium shadow-sm"
                    : "text-slate-600 hover:bg-rose-50 hover:text-rose-500"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-rose-100">
          <div className="bg-gradient-to-br from-rose-100 to-pink-100 rounded-xl p-4">
            <p className="text-sm font-medium text-rose-700">已相恋</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              {daysTogether() !== null ? `${daysTogether()} 天` : "-- 天"}
            </p>
            {settings.coupleName && (
              <p className="text-xs text-rose-500 mt-1 truncate">
                {settings.coupleName}
              </p>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden print:overflow-visible print:h-auto">
        <Routes>
          <Route path="/" element={<Timeline />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/map" element={<MemoryMap />} />
          <Route path="/anniversaries" element={<Anniversaries />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
