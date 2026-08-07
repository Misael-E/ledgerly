import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, DEFAULT_BANKS } from "./constants";
import type { Settings } from "./types";

export function defSettings(): Settings {
  return {
    categories: [...DEFAULT_CATEGORIES],
    accounts: [...DEFAULT_ACCOUNTS],
    banks: [...DEFAULT_BANKS],
    goals: [],
    budgets: [],
    subscriptions: [],
    recurring: [],
    dismissedPatterns: [],
    assets: 0,
    liabilities: 0,
    netWorthConfigured: false,
    selectedPeriod: "all-time",
    freshStart: false,
    driveFolderName: null,
    driveFolderUrl: null,
    lastDriveSync: null,
    processedDriveFiles: [],
    driveResetAt: null,
  };
}

export function loadK<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveK<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function deleteK(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function listKeys(prefix: string): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}
