
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Globe,
  Map,
  Search,
  X,
  Download,
} from "lucide-react";
import { exportToPng } from "../utils/exportImage";
import { initDatabase, getEvents, getSettings } from "../db";
import { fetchUserInfo, searchLocation } from "../utils/api";
import { requirePremium } from "../utils/membership";
import { getThemeClasses } from "../utils/theme";
import type { MemoryEvent, AppSettings, UserInfo } from "../types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapMode = "auto" | "china" | "world";

const HEART_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fda4af"/>
        <stop offset="100%" stop-color="#e11d48"/>
      </linearGradient>
    </defs>
    <path d="M20 34s-11-9.5-11-17.8C9 11.6 14 7 20 7s11 4.6 11 9.2C31 24.5 20 34 20 34z"
      fill="url(#heartGrad)" stroke="white" stroke-width="2" filter="url(#glow)"/>
    <path d="M20 15c-1.8-2-5-1.8-6.7.2-1.7 1.9-1.5 4.7.3 6.6 1.4 1.5 4 3.7 5.2 4.9.9-.9 3.6-3.3 5.1-4.8 2-2 2.2-4.8.4-6.7-1.7-1.9-4.8-2-6.6-.2z"
      fill="white"/>
  </svg>`,
);

function createHeartIcon() {
  return L.divIcon({
    className: "love-marker",
    html: `<div class="love-marker-pin" style="background-image:url('data:image/svg+xml,${HEART_SVG}')"></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
}

function isInChina(lat: number, lng: number) {
  return lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135;
}

function isAllInChina(events: MemoryEvent[]) {
  return events.every((e) => isInChina(e.latitude as number, e.longitude as number));
}

const CHINA_VIEW: L.LatLngExpression = [35.0, 105.0];
const CHINA_ZOOM = 4;
const WORLD_VIEW: L.LatLngExpression = [25.0, 10.0];
const WORLD_ZOOM = 2;

export default function MemoryMap() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>("auto");
  const [tileError, setTileError] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({});
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { name: string; address: string; latitude: number; longitude: number }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    async function load() {
      await initDatabase();
      const [data, s] = await Promise.all([getEvents(), getSettings()]);
      setEvents(
        data.filter(
          (e) => e.showOnMap !== false && e.latitude && e.longitude,
        ),
      );
      setSettings(s as AppSettings);
      if (s.authToken) {
        try {
          const user = await fetchUserInfo(s as AppSettings);
          setUserInfo(user);
        } catch {
          // ignore
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  // 初始化地图（只执行一次）
  useEffect(() => {
    if (loading || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      });
      mapInstanceRef.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);

      // 容器尺寸稳定后再刷新，避免灰色
      const observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(mapRef.current);

      // 首次初始化后延迟刷新
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 300);

      return () => {
        observer.disconnect();
      };
    }
  }, [loading]);

  // 根据事件和模式更新图层与视角
  useEffect(() => {
    if (loading || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    // 清除旧瓦片（切换模式时重新添加，确保样式一致）
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    // 根据模式选择底图：国内用高德，国外/全球用 OpenStreetMap
    const allInChina = isAllInChina(events);
    const effectiveMode =
      mapMode === "auto" ? (allInChina ? "china" : "world") : mapMode;

    if (effectiveMode === "china") {
      L.tileLayer(
        "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
        {
          subdomains: "123",
          maxZoom: 18,
          minZoom: 3,
          className: "map-tiles",
        },
      )
        .on("tileerror", () => setTileError(true))
        .addTo(map);
    } else {
      // OpenStreetMap 全球底图 + CartoDB 明亮注记，适合国外细节
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: "abc",
        maxZoom: 19,
        minZoom: 1,
        attribution: "&copy; OpenStreetMap",
        className: "map-tiles",
      })
        .on("tileerror", () => setTileError(true))
        .addTo(map);
    }

    // 清除旧标记
    markersLayer.clearLayers();

    const icon = createHeartIcon();
    const bounds = L.latLngBounds([]);

    events.forEach((event) => {
      const lat = event.latitude as number;
      const lng = event.longitude as number;
      // 高德瓦片使用 GCJ-02 坐标系，标记坐标无需转换

      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(
        `<div style="padding:6px;font-size:14px;min-width:160px;font-family:sans-serif;">
          <div style="font-weight:700;color:#be123c;font-size:15px;">${event.title}</div>
          <div style="color:#4b5563;margin-top:4px;">${event.location || ""}</div>
          <div style="color:#9ca3af;font-size:12px;margin-top:6px;">${event.date}</div>
          <div style="margin-top:8px;color:#e11d48;font-size:12px;font-weight:500;">点击查看详情</div>
        </div>`,
      );
      marker.on("click", () => {
        navigate(`/timeline?event=${event.id}`);
      });
      marker.addTo(markersLayer);
      bounds.extend([lat, lng]);
    });

    if (events.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
    }

    if (effectiveMode === "china") {
      map.setView(CHINA_VIEW, CHINA_ZOOM, { animate: true, duration: 0.8 });
    } else if (effectiveMode === "world") {
      map.setView(WORLD_VIEW, WORLD_ZOOM, { animate: true, duration: 0.8 });
    }
  }, [loading, events, mapMode]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await searchLocation(settings, searchQuery.trim());
      setSearchResults(res.results);
    } catch (err) {
      alert(err instanceof Error ? err.message : "搜索失败");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSelectLocation(lat: number, lng: number) {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1.5 });
    }
    setShowSearchPanel(false);
  }

  async function handleExportMap() {
    if (!mapRef.current) return;

    // 刷新最新会员状态
    let latestUser = userInfo;
    if (settings.authToken) {
      try {
        latestUser = await fetchUserInfo(settings);
        setUserInfo(latestUser);
      } catch {
        // ignore
      }
    }

    const isPremium = latestUser?.membership_type === "premium";
    if (!isPremium && !requirePremium(latestUser, "导出恋爱地图图片")) {
      return;
    }

    setExporting(true);
    try {
      const dataUrl = await exportToPng(mapRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法创建 canvas 上下文");
      ctx.drawImage(img, 0, 0);

      // 非会员添加右下角水印
      if (!isPremium) {
        const text = "LoveMemo";
        const fontSize = Math.round(canvas.width / 25);
        ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
        ctx.lineWidth = Math.max(1, fontSize / 20);
        const metrics = ctx.measureText(text);
        const padding = fontSize;
        const x = canvas.width - metrics.width - padding;
        const y = canvas.height - padding / 2;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }

      const link = document.createElement("a");
      link.download = `LoveMemo_恋爱地图_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      alert("导出地图图片失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
    }
  }

  const t = getThemeClasses(settings.theme);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${t.loadingColor}`} />
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col p-8 ${t.pageBg}`}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${t.title}`}>恋爱地图</h2>
          <p className={`${t.subtitle} mt-1`}>标记我们一起走过的每一个角落</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearchPanel(!showSearchPanel)}
            className={`flex items-center gap-1.5 px-4 py-2 bg-white border ${t.accentBorder} ${t.accent} ${t.accentBgHover} rounded-xl transition-colors shadow-sm text-sm`}
          >
            <Search className="w-4 h-4" />
            搜索地名
          </button>
          <button
            onClick={handleExportMap}
            disabled={exporting}
            className={`flex items-center gap-1.5 px-4 py-2 bg-white border ${t.accentBorder} ${t.accent} ${t.accentBgHover} rounded-xl transition-colors shadow-sm text-sm disabled:opacity-50`}
            title="导出当前地图为高清图片"
          >
            <Download className="w-4 h-4" />
            {exporting ? "导出中..." : "导出图片"}
          </button>
          {events.length > 0 && (
            <div className={`flex items-center bg-white rounded-xl border ${t.cardBorder} p-1 shadow-sm`}>
            {(["auto", "china"] as MapMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setMapMode(mode)}
                className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${
                  mapMode === mode
                    ? `${t.accentBg} ${t.accent} font-medium`
                    : `text-slate-500 ${t.accentBgHover}`
                }`}
                title={
                  mode === "auto"
                    ? "自动根据地点切换"
                    : mode === "china"
                      ? "中国地图"
                      : "世界地图"
                }
              >
                {mode === "world" ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Map className="w-4 h-4" />
                )}
                {mode === "auto" ? "自动" : mode === "china" ? "中国" : "世界"}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <MapPin className={`w-16 h-16 mb-4 ${t.emptyIcon}`} />
          <p>还没有地点记录</p>
          <p className="text-sm mt-1">在添加记录时搜索地点并勾选“同时添加到恋爱地图”</p>
        </div>
      ) : (
        <div
          className={`flex-1 rounded-2xl overflow-hidden border ${t.cardBorder} shadow-xl relative`}
          style={{ minHeight: "500px", height: "calc(100vh - 200px)" }}
        >
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

          {showSearchPanel && (
            <div className={`absolute top-4 left-4 z-[1000] w-80 bg-white/95 backdrop-blur rounded-2xl shadow-lg border ${t.cardBorder} p-4`}>
              <form onSubmit={handleSearch} className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索地点"
                    className={`w-full pl-8 pr-7 py-2 rounded-xl border ${t.accentBorder} focus:outline-none focus:ring-2 ${t.accentRing} text-sm`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 ${t.accentHover}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className={`px-3 py-2 ${t.buttonPrimary} text-white rounded-xl text-sm disabled:opacity-50`}
                >
                  {searching ? "..." : "搜索"}
                </button>
              </form>

              <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-2">
                {searchResults.length === 0 && !searching && searchQuery && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    未找到结果
                  </p>
                )}
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      handleSelectLocation(item.latitude, item.longitude)
                    }
                    className={`w-full text-left p-3 rounded-xl ${t.accentBgHover} transition-colors`}>
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {item.address}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tileError && (
            <div className={`absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-xs ${t.accent} shadow border ${t.cardBorder}`}>
              地图瓦片加载失败，请检查网络连接
            </div>
          )}
        </div>
      )}
    </div>
  );
}
