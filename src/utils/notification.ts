import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getUpcomingAnniversaries } from "../db";

export async function ensureNotificationPermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  return granted;
}

export async function checkAndNotifyAnniversaries(daysWindow = 7) {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;

    const upcoming = await getUpcomingAnniversaries(10);
    const soon = upcoming.filter((a) => a.daysUntil <= daysWindow);
    if (soon.length === 0) return;

    const first = soon[0];
    const title =
      soon.length === 1
        ? `即将到来的纪念日：${first.title}`
        : `你有 ${soon.length} 个纪念日即将到来`;

    const body =
      soon.length === 1
        ? first.daysUntil === 0
          ? `${first.title} 就是今天，别忘了庆祝！`
          : first.daysUntil === 1
          ? `${first.title} 就在明天`
          : `${first.title} 还有 ${first.daysUntil} 天`
        : soon
            .slice(0, 3)
            .map(
              (a) =>
                `${a.title}${
                  a.daysUntil === 0 ? "（今天）" : `（${a.daysUntil} 天后）`
                }`,
            )
            .join("、");

    sendNotification({ title, body });
  } catch (e) {
    console.error("纪念日提醒检查失败:", e);
  }
}
