import { useEffect, useState } from "react";
import {
  BarChart3,
  MapPin,
  Tag,
  Calendar,
  Heart,
  Image,
  TrendingUp,
} from "lucide-react";
import {
  initDatabase,
  getSettings,
  getDashboardStats,
  getEventYearlyStats,
  getEventMonthlyStats,
  getLocationStats,
  getTagStats,
} from "../db";

export default function Statistics() {
  const [stats, setStats] = useState({
    eventCount: 0,
    mediaCount: 0,
    anniversaryCount: 0,
    daysTogether: null as number | null,
  });
  const [yearly, setYearly] = useState<{ year: string; count: number }[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; count: number }[]>([]);
  const [locations, setLocations] = useState<{ location: string; count: number }[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      await initDatabase();
      const s = await getSettings();

      const [dashboardStats, yearlyStats, monthlyStats, locationStats, tagStats] =
        await Promise.all([
          getDashboardStats(s.startDate),
          getEventYearlyStats(),
          getEventMonthlyStats(),
          getLocationStats(),
          getTagStats(),
        ]);

      setStats(dashboardStats);
      setYearly(yearlyStats);
      setMonthly(monthlyStats.slice(-12));
      setLocations(locationStats);
      setTags(tagStats);
      setLoading(false);
    }
    load();
  }, []);

  const maxYearly = Math.max(...yearly.map((y) => y.count), 1);
  const maxMonthly = Math.max(...monthly.map((m) => m.count), 1);
  const maxLocation = Math.max(...locations.map((l) => l.count), 1);
  const maxTag = Math.max(...tags.map((t) => t.count), 1);

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
        <h2 className="text-2xl font-bold text-slate-800">恋爱统计报告</h2>
        <p className="text-slate-500 mt-1">用数据回顾你们一路走来的点点滴滴</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Heart}
          label="相恋天数"
          value={stats.daysTogether !== null ? `${stats.daysTogether}` : "--"}
        />
        <StatCard icon={Calendar} label="故事记录" value={String(stats.eventCount)} />
        <StatCard icon={Image} label="照片 / 视频" value={String(stats.mediaCount)} />
        <StatCard
          icon={TrendingUp}
          label="去过的地方"
          value={String(locations.length)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rose-500" />
            每年记录数
          </h3>
          {yearly.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {yearly.map((item) => (
                <div key={item.year} className="flex items-center gap-3">
                  <span className="w-12 text-sm text-slate-500">{item.year}</span>
                  <div className="flex-1 h-6 bg-rose-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all"
                      style={{ width: `${(item.count / maxYearly) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-slate-700">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-500" />
            近 12 个月记录数
          </h3>
          {monthly.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {monthly.map((item) => (
                <div key={item.month} className="flex items-center gap-3">
                  <span className="w-14 text-sm text-slate-500">{item.month}</span>
                  <div className="flex-1 h-6 bg-rose-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-300 to-rose-400 rounded-full transition-all"
                      style={{ width: `${(item.count / maxMonthly) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-slate-700">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-rose-500" />
            常去地点 Top 10
          </h3>
          {locations.length === 0 ? (
            <Empty text="还没有地点记录" />
          ) : (
            <div className="space-y-3">
              {locations.map((item) => (
                <div key={item.location} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-slate-600 truncate">
                    {item.location}
                  </span>
                  <div className="w-24 h-5 bg-rose-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-300 to-pink-400 rounded-full"
                      style={{ width: `${(item.count / maxLocation) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-medium text-slate-700">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-rose-100">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <Tag className="w-5 h-5 text-rose-500" />
            常用标签
          </h3>
          {tags.length === 0 ? (
            <Empty text="还没有标签记录" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((item) => (
                <span
                  key={item.tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: `rgba(244, 63, 94, ${
                      0.1 + (item.count / maxTag) * 0.4
                    })`,
                    color: `rgba(225, 29, 72, ${0.7 + (item.count / maxTag) * 0.3})`,
                  }}
                >
                  {item.tag}
                  <span className="text-xs opacity-70">{item.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
        <Icon className="w-6 h-6 text-rose-500" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Empty({ text = "暂无数据" }: { text?: string }) {
  return (
    <div className="text-center py-10 text-slate-400">
      <BarChart3 className="w-10 h-10 mx-auto mb-2 text-rose-200" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
