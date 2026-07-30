export type ThemeKey = "rose" | "ocean" | "forest" | "midnight";

export const THEMES: { key: ThemeKey; label: string; emoji: string }[] = [
  { key: "rose", label: "浪漫玫瑰", emoji: "🌹" },
  { key: "ocean", label: "海洋微风", emoji: "🌊" },
  { key: "forest", label: "森林秘境", emoji: "🌿" },
  { key: "midnight", label: "午夜星河", emoji: "🌌" },
];

export const DEFAULT_THEME: ThemeKey = "rose";

export function getThemeClasses(theme?: string) {
  const key = (theme as ThemeKey) || DEFAULT_THEME;
  switch (key) {
    case "ocean":
      return {
        pageBg: "bg-sky-50/50",
        title: "text-sky-700",
        subtitle: "text-sky-500/80",
        accent: "text-sky-600",
        accentHover: "hover:text-sky-600",
        accentBg: "bg-sky-100",
        accentBgHover: "hover:bg-sky-50",
        accentBorder: "border-sky-200",
        accentRing: "focus:ring-sky-300",
        buttonPrimary: "bg-sky-500 hover:bg-sky-600 shadow-sky-200",
        buttonOutline: "border-sky-200 text-sky-600 hover:bg-sky-50",
        timelineLine: "border-sky-200",
        timelineDot: "bg-sky-400",
        cardBorder: "border-sky-100",
        emptyIcon: "text-sky-400",
        emptyBg: "bg-sky-100",
        loadingColor: "border-sky-500",
        heroGradient: "from-sky-400 to-blue-500",
        heroShadow: "shadow-sky-200",
        chartGradient1: "from-sky-400 to-blue-500",
        chartGradient2: "from-sky-300 to-sky-400",
        chartGradient3: "from-blue-300 to-blue-400",
      };
    case "forest":
      return {
        pageBg: "bg-emerald-50/50",
        title: "text-emerald-800",
        subtitle: "text-emerald-600/80",
        accent: "text-emerald-600",
        accentHover: "hover:text-emerald-600",
        accentBg: "bg-emerald-100",
        accentBgHover: "hover:bg-emerald-50",
        accentBorder: "border-emerald-200",
        accentRing: "focus:ring-emerald-300",
        buttonPrimary: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200",
        buttonOutline: "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
        timelineLine: "border-emerald-200",
        timelineDot: "bg-emerald-400",
        cardBorder: "border-emerald-100",
        emptyIcon: "text-emerald-400",
        emptyBg: "bg-emerald-100",
        loadingColor: "border-emerald-500",
        heroGradient: "from-emerald-400 to-green-500",
        heroShadow: "shadow-emerald-200",
        chartGradient1: "from-emerald-400 to-green-500",
        chartGradient2: "from-emerald-300 to-emerald-400",
        chartGradient3: "from-green-300 to-green-400",
      };
    case "midnight":
      return {
        pageBg: "bg-violet-50/50",
        title: "text-violet-800",
        subtitle: "text-violet-600/80",
        accent: "text-violet-600",
        accentHover: "hover:text-violet-600",
        accentBg: "bg-violet-100",
        accentBgHover: "hover:bg-violet-50",
        accentBorder: "border-violet-200",
        accentRing: "focus:ring-violet-300",
        buttonPrimary: "bg-violet-500 hover:bg-violet-600 shadow-violet-200",
        buttonOutline: "border-violet-200 text-violet-600 hover:bg-violet-50",
        timelineLine: "border-violet-200",
        timelineDot: "bg-violet-400",
        cardBorder: "border-violet-100",
        emptyIcon: "text-violet-400",
        emptyBg: "bg-violet-100",
        loadingColor: "border-violet-500",
        heroGradient: "from-violet-400 to-indigo-500",
        heroShadow: "shadow-violet-200",
        chartGradient1: "from-violet-400 to-indigo-500",
        chartGradient2: "from-violet-300 to-violet-400",
        chartGradient3: "from-indigo-300 to-indigo-400",
      };
    case "rose":
    default:
      return {
        pageBg: "bg-rose-50/50",
        title: "text-slate-800",
        subtitle: "text-slate-500",
        accent: "text-rose-600",
        accentHover: "hover:text-rose-600",
        accentBg: "bg-rose-100",
        accentBgHover: "hover:bg-rose-50",
        accentBorder: "border-rose-200",
        accentRing: "focus:ring-rose-300",
        buttonPrimary: "bg-rose-500 hover:bg-rose-600 shadow-rose-200",
        buttonOutline: "border-rose-200 text-rose-600 hover:bg-rose-50",
        timelineLine: "border-rose-200",
        timelineDot: "bg-rose-400",
        cardBorder: "border-rose-100",
        emptyIcon: "text-rose-400",
        emptyBg: "bg-rose-100",
        loadingColor: "border-rose-500",
        heroGradient: "from-rose-400 to-pink-500",
        heroShadow: "shadow-rose-200",
        chartGradient1: "from-rose-400 to-pink-500",
        chartGradient2: "from-rose-300 to-rose-400",
        chartGradient3: "from-pink-300 to-pink-400",
      };
  }
}
