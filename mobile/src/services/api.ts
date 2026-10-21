import { Platform } from "react-native";

const defaultApiBase = Platform.OS === "android"
  ? "http://10.0.2.2:3000/api"
  : "http://localhost:3000/api";
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || defaultApiBase).replace(/\/$/, "");

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
  let response: Response;
  try {
    const headers = new Headers(opts.headers);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    response = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  } catch {
    return { ok: false, status: 0, body: { message: "Can't reach Bear Care right now. Check your connection and try again." } };
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (response.ok) return { ok: true, status: response.status, body: body as T };
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
