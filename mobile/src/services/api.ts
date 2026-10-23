import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const defaultApiBase = Platform.OS === "android"
  ? "http://10.0.2.2:3000/api"
  : "http://localhost:3000/api";
const API_BASE_STORAGE_KEY = "bear-care-api-base";
let apiBase = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL || defaultApiBase);
let apiBaseReady: Promise<void> | null = null;

function normalizeApiBase(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid server URL, including http:// or https://.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Use an http:// or https:// server URL without credentials, query parameters, or fragments.");
  }
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path === "/api" || path.endsWith("/api") ? path : `${path}/api`;
  return url.toString().replace(/\/$/, "");
}

async function loadApiBase() {
  if (!apiBaseReady) {
    apiBaseReady = AsyncStorage.getItem(API_BASE_STORAGE_KEY).then((storedBase) => {
      if (storedBase) apiBase = normalizeApiBase(storedBase);
    });
  }
  await apiBaseReady;
  return apiBase;
}

export async function getApiBaseUrl() {
  return loadApiBase();
}

export async function testAndSetApiBaseUrl(value: string): Promise<{ ok: true; baseUrl: string } | { ok: false; message: string }> {
  let baseUrl: string;
  try {
    baseUrl = normalizeApiBase(value);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Enter a valid server URL." };
  }

  const healthUrl = new URL(baseUrl);
  healthUrl.pathname = healthUrl.pathname.replace(/\/api$/, "") + "/health";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(healthUrl.toString(), { signal: controller.signal });
  } catch {
    return {
      ok: false,
      message: controller.signal.aborted
        ? "The server check timed out. Check the URL and your network, then try again."
        : "Couldn't reach that server. Check the URL and make sure this network can access it.",
    };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) return { ok: false, message: `The server responded with HTTP ${response.status}; expected a healthy API at /health.` };

  try {
    await AsyncStorage.setItem(API_BASE_STORAGE_KEY, baseUrl);
  } catch {
    return { ok: false, message: "The server is reachable, but this setting couldn't be saved on your device." };
  }
  apiBase = baseUrl;
  apiBaseReady = Promise.resolve();
  return { ok: true, baseUrl };
}

export interface AuthSession {
  accessToken: string;
  user: Profile;
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  dailyMealGoal: number;
  notificationsEnabled: boolean;
  reminderTimes: string[];
}

export interface MealEntry {
  _id: string;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  eatenAt: string;
  notes?: string | null;
}

export interface ProgressSummary {
  date: string;
  dailyMealGoal: number;
  mealCount: number;
  goalMet: boolean;
  currentStreakDays: number;
  lastSevenDays: { date: string; mealCount: number; goalMet: boolean }[];
}

export interface ApiError {
  message?: string;
  error?: { message?: string };
}

type ApiResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; body: ApiError };

async function request<T>(path: string, opts: RequestInit = {}): Promise<ApiResult<T>> {
  let baseUrl: string;
  try {
    baseUrl = await loadApiBase();
  } catch {
    return { ok: false, status: 0, body: { message: "Saved server settings couldn't be loaded. Re-enter the server URL in Connection settings." } };
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = new Headers(opts.headers);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    response = await fetch(`${baseUrl}${path}`, { ...opts, headers, signal: controller.signal });
  } catch {
    return {
      ok: false,
      status: 0,
      body: {
        message: controller.signal.aborted
          ? "The request timed out. Check your connection and try again."
          : "Can't reach Bear Care right now. Check your connection and try again.",
      },
    };
  } finally {
    clearTimeout(timeout);
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return {
      ok: false,
      status: response.status,
      body: { message: "The connection ended before the server response finished. Check your connection and try again." },
    };
  }
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (response.ok && (body !== null || response.status === 204)) {
    return { ok: true, status: response.status, body: body as T };
  }
  if (response.ok) {
    return {
      ok: false,
      status: response.status,
      body: { message: "The server returned an invalid response. Try again later." },
    };
  }
  const errorBody = body && typeof body === "object" ? body as ApiError : {};
  return { ok: false, status: response.status, body: errorBody };
}

export function register(email: string, password: string, displayName: string) {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export function login(email: string, password: string) {
  return request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function getProfile(accessToken: string) {
  return request<{ user: Profile }>("/profile", { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function updateProfile(accessToken: string, changes: Partial<Pick<Profile, "displayName" | "dailyMealGoal" | "notificationsEnabled" | "reminderTimes">>) {
  return request<{ user: Profile }>("/profile", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(changes),
  });
}

export function getMeals(token: string) {
  return request<{ meals: MealEntry[] }>("/meals", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createMeal(token: string, name: string, mealType: MealEntry["mealType"], notes?: string, eatenAt = new Date().toISOString()) {
  return request<{ meal: MealEntry }>("/meals", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, mealType, notes, eatenAt }),
  });
}

export function deleteMeal(accessToken: string, mealId: string) {
  return request<null>(`/meals/${encodeURIComponent(mealId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getProgress(accessToken: string) {
  return request<{ progress: ProgressSummary }>("/progress", { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function deleteAccount(accessToken: string) {
  return request<null>("/auth/me", { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
}

export function errorMessage(error: ApiError, fallback: string) {
  return error.error?.message || error.message || fallback;
}

export default { register, login, getProfile, updateProfile, getMeals, createMeal, deleteMeal, getProgress, deleteAccount };
