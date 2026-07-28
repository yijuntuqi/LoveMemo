import { useEffect, useRef, useState } from "react";
import { MapPin, Globe, Map } from "lucide-react";
import { initDatabase, getEvents } from "../db";
import type { MemoryEvent } from "../types";
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
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapMode, setMapMode] = useState<MapMode>("auto");
  const [tileError, setTileError] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

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

    // 使用高德地图瓦片（国内可靠、明亮、中文标注）
    L.tileLayer(
      "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
      {
        subdomains: "123",
        maxZoom: 18,
        className: "map-tiles",
      },
    )
      .on("tileerror", () => setTileError(true))
      .addTo(map);

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
        </div>`,
      );
      marker.addTo(markersLayer);
      bounds.extend([lat, lng]);
    });

    // 根据地点分布决定模式
    const allInChina = isAllInChina(events);
    const effectiveMode =
      mapMode === "auto" ? (allInChina ? "china" : "world") : mapMode;

    if (events.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
    }

    if (effectiveMode === "china") {
      map.setView(CHINA_VIEW, CHINA_ZOOM, { animate: true, duration: 0.8 });
    } else if (effectiveMode === "world") {
      map.setView(WORLD_VIEW, WORLD_ZOOM, { animate: true, duration: 0.8 });
    }
  }, [loading, events, mapMode]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">恋爱地图</h2>
          <p className="text-slate-500 mt-1">标记我们一起走过的每一个角落</p>
        </div>
        {events.length > 0 && (
          <div className="flex items-center bg-white rounded-xl border border-rose-100 p-1 shadow-sm">
            {(["auto", "china", "world"] as MapMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setMapMode(mode)}
                className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-colors ${
                  mapMode === mode
                    ? "bg-rose-100 text-rose-600 font-medium"
                    : "text-slate-500 hover:bg-rose-50"
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

      {events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <MapPin className="w-16 h-16 mb-4 text-rose-200" />
          <p>还没有地点记录</p>
          <p className="text-sm mt-1">在添加记录时搜索地点并勾选“同时添加到恋爱地图”</p>
        </div>
      ) : (
        <div
          className="flex-1 rounded-2xl overflow-hidden border border-rose-100 shadow-xl map-3d-container"
          style={{ minHeight: "500px" }}
        >
          <div ref={mapRef} className="w-full h-full" />
          {tileError && (
            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-xs text-rose-600 shadow border border-rose-100">
              地图瓦片加载失败，请检查网络连接
            </div>
          )}
        </div>
      )}
    </div>
  );
}
