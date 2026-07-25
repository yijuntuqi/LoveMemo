import { useEffect, useState } from "react";
import { MapPin, ExternalLink, Navigation } from "lucide-react";
import { initDatabase, getEvents } from "../db";
import type { MemoryEvent } from "../types";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function MemoryMap() {
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      await initDatabase();
      const data = await getEvents();
      setEvents(
        data.filter(
          (e) => e.showOnMap !== false && e.latitude && e.longitude,
        ),
      );
      setLoading(false);
    }
    load();
  }, []);

  function openMap(lat: number, lng: number) {
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
    openUrl(url);
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
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">恋爱地图</h2>
        <p className="text-slate-500 mt-1">标记我们一起走过的每一个角落</p>
      </div>

      {events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <MapPin className="w-16 h-16 mb-4 text-rose-200" />
          <p>还没有地点记录</p>
          <p className="text-sm mt-1">在添加记录时填写经纬度，地图就会显示</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-6 h-6 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-800 truncate">
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {event.location || "未知地点"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {event.latitude?.toFixed(6)}, {event.longitude?.toFixed(6)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      openMap(event.latitude as number, event.longitude as number)
                    }
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="在地图中打开"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 rounded-xl overflow-hidden border border-rose-100 bg-rose-50 h-40 flex items-center justify-center">
                  <img
                    src={`https://static-maps.openstreetmap.org/?center=${event.latitude},${event.longitude}&zoom=14&size=400x200&markers=${event.latitude},${event.longitude}`}
                    alt="地图"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
