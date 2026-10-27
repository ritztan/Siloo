// ── Silo API client ───────────────────────────────────────────────────────────
// Talks to the Python backend (backend/app). Keeps the login session in this
// browser and refreshes it automatically when it expires.

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000"

const SESSION_KEY = "silo-session"

// Browser events: something was saved / an undo happened (pages reload their data)
export const CHANGED_EVENT = "silo:changed"
export const UNDO_EVENT = "silo:undo"

// ── Types (match what the backend returns) ────────────────────────────────────
export type Role = "admin" | "coordinator" | "volunteer" | "farmer"
export type FarmStatus = "pending" | "approved" | "rejected" | "suspended"
export type DonationStatus =
  | "new"
  | "matched"
  | "pickup_scheduled"
  | "delivered"
  | "expired"
  | "cancelled"

export type Profile = {
  id: string
  first_name: string
  last_name: string
  organization: string
  phone: string | null
  role: Role
}

export type Farm = {
  id: string
  farm_name: string
  contact_name: string
  email: string | null
  phone: string | null
  location: string | null
  cooperative: string | null
  status: FarmStatus
  created_at: string
}

export type Account = { profile: Profile; farmer: Farm | null; email?: string }

type Tokens = { access_token: string; refresh_token: string; expires_at: number }

// ── Session storage ───────────────────────────────────────────────────────────
export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}

export function saveTokens(tokens: Tokens) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
      }),
    )
  } catch {
    // storage blocked (private window): the session lasts until the tab closes
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}

// ── Errors ────────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number
  data: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

const FIELD_NAMES: Record<string, string> = {
  email: "Email",
  password: "Password",
  full_name: "Full name",
  phone: "Mobile number",
  farm_name: "Farm name",
  farm_address: "Farm address",
  produce: "Produce",
  quantity_kg: "Quantity",
}

function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === "string") return detail
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message)
    }
    // FastAPI validation errors: [{ loc: ["body", "email"], msg: "..." }]
    if (Array.isArray(detail) && detail[0]) {
      const first = detail[0] as { loc?: string[]; msg?: string }
      const field = first.loc?.[first.loc.length - 1] ?? ""
      const label = FIELD_NAMES[field] ?? field
      const msg = (first.msg ?? "is invalid").replace(/^Value error, /, "")
      return label ? `${label}: ${msg}` : msg
    }
  }
  if (status >= 500) return "Something went wrong on the server. Please try again."
  return "The request couldn't be completed."
}

// ── Requests ──────────────────────────────────────────────────────────────────
let refreshing: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  const tokens = getTokens()
  if (!tokens?.refresh_token) return false
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      saveTokens((await res.json()) as Tokens)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const tokens = getTokens()
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(tokens ? { Authorization: `Bearer ${tokens.access_token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(
      "Can't reach the Silo server. Make sure the backend is running (uvicorn), then try again.",
      0,
    )
  }

  if (res.status === 401 && retry && tokens && !path.startsWith("/auth/signin")) {
    if (await refreshSession()) return request<T>(path, init, false)
    clearTokens()
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status, data)
  // Tell the sidebar something changed (so "Undo last action" stays current)
  if (init.method && init.method !== "GET" && !path.startsWith("/auth/")) {
    window.dispatchEvent(new Event(CHANGED_EVENT))
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<null>(path, { method: "DELETE" }),
}

// ── Account helpers ───────────────────────────────────────────────────────────
export async function signIn(email: string, password: string, role: "farmer" | "coordinator") {
  const result = await api.post<Tokens & Account>("/auth/signin", { email, password, role })
  saveTokens(result)
  return { profile: result.profile, farmer: result.farmer, email: result.email } as Account
}

export async function signOut() {
  await api.post("/auth/signout").catch(() => null)
  clearTokens()
}

export function loadAccount() {
  return api.get<Account>("/auth/me")
}

// ── Formatting ────────────────────────────────────────────────────────────────
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/** "Today, 10:30 AM" · "Tomorrow, 9:00 AM" · "Oct 29, 9:00 AM" */
export function formatDateTime(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const day = sameDay(date, today)
    ? "Today"
    : sameDay(date, tomorrow)
      ? "Tomorrow"
      : sameDay(date, yesterday)
        ? "Yesterday"
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${day}, ${formatTime(iso)}`
}

/** "Today" · "Yesterday" · "Mar 2024" */
export function formatJoined(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(date, today)) return "Today"
  if (sameDay(date, yesterday)) return "Yesterday"
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export function isToday(iso: string) {
  return sameDay(new Date(iso), new Date())
}

export function formatKg(value: number | string) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 })
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase() || "?"
}
