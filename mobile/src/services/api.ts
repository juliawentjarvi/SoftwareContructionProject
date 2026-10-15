import { Platform } from "react-native";

const defaultApiBase = Platform.OS === "android"
  ? "http://10.0.2.2:5000/api"
  : "http://localhost:5000/api";
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || defaultApiBase).replace(/\/$/, "");

export interface AuthSession {
  token: string;
  user: { id: string; email: string };
}

export interface ApiError {
  message?: string;
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

export function register(email: string, password: string) {
  return request<AuthSession>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function login(email: string, password: string) {
  return request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function getMeals(token: string) {
  return request<Array<{ _id: string; name: string; notes?: string; eatenAt: string }>>("/meals", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createMeal(token: string, name: string, notes?: string, eatenAt?: string) {
  return request<{ _id: string; name: string; notes?: string; eatenAt: string }>("/meals", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, notes, eatenAt }),
  });
}

export default { register, login, getMeals, createMeal };
