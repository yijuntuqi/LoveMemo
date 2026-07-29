import { useEffect, useState } from "react";
import {
  Heart,
  Calendar,
  Image,
  Gift,
  Clock,
  MapPin,
  ChevronRight,
} from "lucide-react";
import {
  initDatabase,
  getSettings,
  getDashboardStats,
  getRecentEvents,
  getUpcomingAnniversaries,
  getMediaByEventId,
} from "../db";
import { getMediaUrl } from "../utils/media";
import type {
  AppSettings,
  MemoryEvent,
  MediaItem,
  AnniversaryWithDays,
} from "../types";

export default function Dashboard() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [stats, setStats] = useState({
    eventCount: 0,
    mediaCount: 0,
    anniversaryCount: 0,
    daysTogether: null as number | null,
  });
  const [recentEvents, setRecentEvents] = useState<MemoryEvent[]>([]);
  const [upcoming, setUpcoming] = useState<AnniversaryWithDays[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<number, MediaItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      await initDatabase();
      const s = await getSettings();
      setSettings(s as AppSettings);

      const [dashboardStats, events, anniversaries] = await Promise.all([
        getDashboardStats(s.startDate),
        getRecentEvents(5),
        getUpcomingAnniversaries(3),
      ]);
      setStats(dashboardStats);
      setRecentEvents(events);
      setUpcoming(anniversaries);

      const map: Record<number, MediaItem[]> = {};
      for (const event of events) {
        map[event.id] = await getMediaByEventId(event.id);
      }
      setMediaMap(map);
      setLoading(false);
    }
    load();
  }, []);

  const coupleName = settings.coupleName || "我们";
  const myName = settings.myName || "";
  const partnerName = settings.partnerName || "";

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto scrollbar-thin">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">
          你好，{myName || coupleName}
        </h2>
        <p className="text-slate-500 mt-1">
          {partnerName ? `与 ${partnerName} 的恋爱纪念册` : "记录每一个心动瞬间"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-gradient-to-br from-rose-400 to-pink-500 rounded-3xl p-8 text-white shadow-lg shadow-rose-200">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-6 h-6 fill-white" />
            <span className="font-medium opacity-90">已相恋</span>
          </div>
          <div className="text-6xl font-bold mb-2">
            {stats.daysTogether !== null ? stats.daysTogether : "--"}
          </div>
          <p className="text-lg opacity-90">
            {stats.daysTogether !== null
              ? `从 ${settings.startDate} 至今，每一天都值得纪念`
              : "在设置中填写相恋开始日期，即可看到相恋天数"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center">
              <Calendar className="w-7 h-7 text-rose-500" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.eventCount}</p>
              <p className="text-slate-500">故事记录</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-pink-100 flex items-center justify-center">
              <Image className="w-7 h-7 text-pink-500" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stats.mediaCount}</p>
              <p className="text-slate-500">照片 / 视频</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-800">最近的故事</h3>
            <a
              href="#/timeline"
              className="flex items-center gap-1 text-sm text-rose-500 hover:text-rose-600"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Heart className="w-10 h-10 mx-auto mb-2 text-rose-200" />
              <p>还没有记录，去时间线添加第一条吧</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <a
                  key={event.id}
                  href="#/timeline"
                  className="flex gap-4 p-4 rounded-2xl hover:bg-rose-50 transition-colors group"
                >
                  {mediaMap[event.id]?.[0]?.type === "image" ? (
                    <img
                      src={getMediaUrl(mediaMap[event.id][0].path)}
                      alt=""
                      className="w-20 h-20 rounded-xl object-cover border border-rose-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-8 h-8 text-rose-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-rose-500 font-medium">
                      <Calendar className="w-4 h-4" />
                      {event.date}
                    </div>
                    <h4 className="text-base font-bold text-slate-800 mt-1 truncate">
                      {event.title}
                    </h4>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {event.content}
                    </p>
                    {event.location && (
                      <p className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-800">即将到来的纪念日</h3>
            <a
              href="#/anniversaries"
              className="flex items-center gap-1 text-sm text-rose-500 hover:text-rose-600"
            >
              全部 <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {upcoming.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Gift className="w-10 h-10 mx-auto mb-2 text-rose-200" />
              <p>还没有纪念日，去添加一个吧</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcoming.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-rose-50 border border-rose-100"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600">
                      {item.category === "birthday"
                        ? "生日"
                        : item.category === "wedding"
                        ? "结婚"
                        : item.category === "date"
                        ? "相恋"
                        : item.category === "kiss"
                        ? "初吻"
                        : item.category === "travel"
                        ? "旅行"
                        : item.category === "gift"
                        ? "礼物"
                        : "纪念日"}
                    </span>
                    <span className="text-xs px-2 py-1 bg-white rounded-full text-rose-500 font-medium">
                      {item.daysUntil === 0
                        ? "今天"
                        : item.daysUntil === 1
                        ? "明天"
                        : `${item.daysUntil} 天后`}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800">{item.title}</h4>
                  <p className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <Clock className="w-3 h-3" />
                    {item.date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
