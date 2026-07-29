import { fetchUserInfo } from "./api";
import type { AppSettings, UserInfo } from "../types";

export function isPremium(user: UserInfo | null | undefined): boolean {
  if (!user) return false;
  if (user.membership_type !== "premium") return false;
  if (user.membership_expires_at && new Date(user.membership_expires_at) < new Date()) {
    return false;
  }
  return true;
}

export async function checkPremium(settings: AppSettings): Promise<boolean> {
  if (!settings.authToken) return false;
  try {
    const user = await fetchUserInfo(settings);
    return isPremium(user);
  } catch {
    return false;
  }
}

export function requirePremium(
  user: UserInfo | null | undefined,
  featureName: string,
): boolean {
  if (isPremium(user)) return true;
  alert(`「${featureName}」为会员专属功能，请前往设置激活会员。`);
  return false;
}
