import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  api,
  ApiError,
  clearTokens,
  formatDateTime,
  formatJoined,
  formatKg,
  formatTime,
  getTokens,
  initials,
  isToday,
  loadAccount,
  signIn,
  signOut,
  type Account,
  type DonationStatus,
  type Farm,
  type FarmStatus,
  CHANGED_EVENT,
  UNDO_EVENT,
} from "./lib/api"

// ── Screens ───────────────────────────────────────────────────────────────────
// Every screen in the app. Each one has its own component below, so you can
// open that function and edit it on its own.
type Screen =
  | "splash"
  | "signin"
  | "signup"
  | "dashboard"
  | "donations"
  | "pickups"
  | "farmers"
  | "recipients"
  | "reports"
  | "farmer-status"
  | "farmer-dashboard"
  | "farmer-log"
  | "farmer-donations"
  | "farmer-profile"
  | "reset-password"

// Screens anyone can open without logging in
const PUBLIC_SCREENS: Screen[] = ["splash", "signin", "signup", "reset-password"]
// Screens for farmer accounts
const FARMER_SCREENS: Screen[] = ["farmer-status", "farmer-dashboard", "farmer-log", "farmer-donations", "farmer-profile"]

// ── Types ─────────────────────────────────────────────────────────────────────
type IconName = "grid" | "gift" | "truck" | "shield" | "users" | "home" | "chart" | "menu" | "close" | "arrow" | "clock" | "leaf" | "search" | "mail" | "lock" | "eye"

type NavItem = {
  screen: Screen
  label: string
  icon: IconName
  group?: string
  count?: number
}

type ActivityTone = "amber" | "green" | "blue" | "dark"

// ── Signed-in account ─────────────────────────────────────────────────────────
// Shared with every screen so they know who is logged in.
type Session = {
  account: Account | null
  setAccount: (account: Account | null) => void
  pendingFarmers: number | null
  setPendingFarmers: (count: number) => void
}

const SessionContext = createContext<Session>({
  account: null,
  setAccount: () => {},
  pendingFarmers: null,
  setPendingFarmers: () => {},
})

const useSession = () => useContext(SessionContext)

// Where an account lands after logging in
function homeFor(account: Account): Screen {
  if (account.profile.role !== "farmer") return "dashboard"
  return account.farmer?.status === "approved" ? "farmer-dashboard" : "farmer-status"
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Coordinator · Admin",
  coordinator: "Coordinator",
  farmer: "Farmer",
  retired: "Account inactive",
}

// Reload a page's data every 30 seconds and whenever you come back to the tab,
// so new sign-ups, donations and pickups show up without pressing refresh.
function useAutoRefresh(load: () => void, seconds = 30) {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") load()
    }
    const timer = window.setInterval(refresh, seconds * 1000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener(UNDO_EVENT, load) // an undo may have changed this page's data
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener(UNDO_EVENT, load)
    }
  }, [load, seconds])
}

function errorText(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something went wrong. Please try again."
}

// ── Icon ──────────────────────────────────────────────────────────────────────
const ICON_PATHS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  gift: (
    <>
      <path d="M4 9h16v11H4zM3 5h18v4H3zM12 5v15" />
      <path d="M12 5c-1-3-5-3-5-1s3 2 5 1Zm0 0c1-3 5-3 5-1s-3 2-5 1Z" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z" />
      <path d="M4 21c2-5 6-8 12-11" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

// ── Navigation ────────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  {
    screen: "dashboard",
    label: "Dashboard",
    icon: "grid",
    group: "Overview",
  },
  {
    screen: "donations",
    label: "Donations",
    icon: "gift",
    group: "Food operations",
  },
  {
    screen: "pickups",
    label: "Pickups",
    icon: "truck",
  },
  {
    screen: "farmers",
    label: "Farmers",
    icon: "shield",
    group: "Community",
  },
  {
    screen: "recipients",
    label: "Recipient Partners",
    icon: "home",
  },
  {
    screen: "reports",
    label: "Reports",
    icon: "chart",
    group: "Insights",
  },
]

// Farmer portal menu
const FARMER_NAV: NavItem[] = [
  { screen: "farmer-dashboard", label: "Home", icon: "home" },
  { screen: "farmer-log", label: "Log surplus", icon: "gift" },
  { screen: "farmer-donations", label: "My donations", icon: "leaf" },
  { screen: "farmer-profile", label: "Farm profile", icon: "shield" },
]

// ── Sample data ───────────────────────────────────────────────────────────────
const RANGES = ["7 days", "30 days"]



// ────────────────────────────────────────────────────────────────────────────
// Shared pieces
// ────────────────────────────────────────────────────────────────────────────

// ── App shell (sidebar + top bar) ─────────────────────────────────────────────
// Wraps every screen after sign-in. Pass the screen's own content as children.
// live = this screen shows real data from Supabase (otherwise it's still sample data).
function AppShell({
  go,
  active,
  title,
  children,
  live = false,
  nav = NAV_ITEMS,
}: {
  go: (s: Screen) => void
  active: Screen
  title: string
  children: ReactNode
  live?: boolean
  nav?: NavItem[]
}) {
  const { account, setAccount, pendingFarmers, setPendingFarmers } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const isStaff = !!account && account.profile.role !== "farmer"
  const canUndo = canManageOps(account)
  const [lastAction, setLastAction] = useState<{ id: number; label: string; created_at: string } | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [undoNote, setUndoNote] = useState("")

  // Sidebar: last undoable change + pending farmers badge
  const loadSidebar = useCallback(() => {
    if (!isStaff) return
    api
      .get<{ last_action: typeof lastAction; farmers_pending: number }>("/sidebar")
      .then((info) => {
        setLastAction(info.last_action)
        setPendingFarmers(info.farmers_pending)
      })
      .catch(() => null)
  }, [isStaff])

  useEffect(loadSidebar, [loadSidebar])
  useAutoRefresh(loadSidebar)
  useEffect(() => {
    const changed = () => {
      setUndoNote("")
      loadSidebar()
    }
    window.addEventListener(CHANGED_EVENT, changed)
    return () => window.removeEventListener(CHANGED_EVENT, changed)
  }, [loadSidebar])

  const undoLast = async () => {
    if (!lastAction) return
    setUndoing(true)
    try {
      const result = await api.post<{ undone: string; last_action: typeof lastAction }>("/activity/undo")
      setLastAction(result.last_action)
      setUndoNote(`Undone: ${result.undone}`)
      window.dispatchEvent(new Event(UNDO_EVENT))
    } catch (err) {
      setUndoNote(errorText(err))
    } finally {
      setUndoing(false)
    }
  }
  const [jumpQuery, setJumpQuery] = useState("")
  const profile = account?.profile
  // Coordinators added in Supabase may have no name yet: fall back to their email
  const fullName =
    (profile && `${profile.first_name} ${profile.last_name}`.trim()) ||
    account?.email?.split("@")[0] ||
    "Silo user"
  const navItems = nav.map((item) =>
    item.screen === "farmers" && pendingFarmers ? { ...item, count: pendingFarmers } : item,
  )
  const matchingPages = navItems.filter((item) =>
    item.label.toLowerCase().includes(jumpQuery.trim().toLowerCase()),
  )

  const selectPage = (next: Screen) => {
    setJumpQuery("")
    go(next)
  }

  const handleSignOut = async () => {
    await signOut()
    setAccount(null)
    go("signin")
  }

  return (
    <div className="admin-shell">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="logo-lockup">
          <span className="logo-tile">s</span>

          <div>
            <strong>silo</strong>
            <small>{profile?.role === "farmer" ? "Farmer portal" : "Food rescue network"}</small>
          </div>

          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* ── Navigation menu ──────────────────────────────────────────── */}
        <nav className="side-nav" aria-label={profile?.role === "farmer" ? "Farmer navigation" : "Coordinator navigation"}>
          {navItems.map((item) => (
            <div key={item.label} className="nav-entry">
              {item.group && <span className="nav-label">{item.group}</span>}

              <button
                type="button"
                className={active === item.screen ? "active" : ""}
                onClick={() => {
                  setMenuOpen(false)
                  go(item.screen)
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.count ? <b>{item.count}</b> : null}
              </button>
            </div>
          ))}
        </nav>

        {/* ── Sidebar footer ───────────────────────────────────────────── */}
        <div className="side-bottom">
          {canUndo && (
            <div className="undo-card">
              <strong>Undo last action</strong>
              {lastAction ? (
                <>
                  <span title={lastAction.label}>
                    {lastAction.label} · {formatTime(lastAction.created_at)}
                  </span>
                  <button type="button" onClick={undoLast} disabled={undoing}>
                    {undoing ? "Undoing..." : "Undo"}
                  </button>
                </>
              ) : (
                <span>Nothing to undo.</span>
              )}
              {undoNote && <small className="undo-note">{undoNote}</small>}
            </div>
          )}

          <div className="account-card">
            <span className="avatar">{initials(fullName)}</span>

            <div>
              <strong title={fullName}>{fullName}</strong>
              <small>{ROLE_LABELS[profile?.role ?? ""] ?? ""}</small>
            </div>

            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay ───────────────────────────────────────────────── */}
      {menuOpen && (
        <button
          type="button"
          className="scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="workspace">
        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <header className="admin-topbar">
          <button
            type="button"
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>

          <strong>{title}</strong>

          <div className="jump-field">
            <Icon name="search" size={16} />
            <input
              aria-label="Jump to a page"
              placeholder="Jump to a page..."
              value={jumpQuery}
              onChange={(event) => setJumpQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matchingPages[0]) {
                  selectPage(matchingPages[0].screen)
                }
                if (event.key === "Escape") setJumpQuery("")
              }}
            />
            {jumpQuery && (
              <div className="jump-results">
                {matchingPages.length ? (
                  matchingPages.map((item) => (
                    <button
                      type="button"
                      key={item.screen}
                      onClick={() => selectPage(item.screen)}
                    >
                      <Icon name={item.icon} size={15} />
                      {item.label}
                    </button>
                  ))
                ) : (
                  <span>No pages found</span>
                )}
              </div>
            )}
          </div>

          <div className={`demo-status ${live ? "live" : ""}`}>
            <i></i>{" "}
            {live ? "Live data · Supabase" : "Sample data · not connected yet"}
          </div>
        </header>

        {children}

        {!live && (
          <div className="sample-bar">
            Sample data · this page isn't connected to the database yet
          </div>
        )}
      </div>
    </div>
  )
}

// ── Auth layout ───────────────────────────────────────────────────────────────
function AuthLayout({
  children,
  go,
}: {
  children: ReactNode
  go: (s: Screen) => void
}) {
  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <button
          type="button"
          className="auth-wordmark"
          aria-label="Silo home"
          onClick={() => go("signin")}
        >
          silo
        </button>
        <span>Community food rescue network</span>
      </header>
      {children}
      <footer className="auth-footer">
        Silo is a coordination tool and does not certify food safety. Requires
        an internet connection.
      </footer>
    </main>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Screens
// ────────────────────────────────────────────────────────────────────────────

// ── Splash Screen ─────────────────────────────────────────────────────────────
function SplashScreen({ go }: { go: (s: Screen) => void }) {
  const { setAccount } = useSession()

  useEffect(() => {
    let cancelled = false
    const minimumWait = new Promise((resolve) => window.setTimeout(resolve, 1700))
    // Still logged in from last time? Load the account while the splash plays.
    const restore = getTokens() ? loadAccount().catch(() => null) : Promise.resolve(null)

    Promise.all([restore, minimumWait]).then(([account]) => {
      if (cancelled) return
      const activeAccount = account?.profile.role === "retired" ? null : account
      if (!activeAccount && account) clearTokens()
      setAccount(activeAccount)
      go(activeAccount ? homeFor(activeAccount) : "signin")
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="splash-screen">
      <div className="splash-orbit orbit-one"></div>
      <div className="splash-orbit orbit-two"></div>

      <div className="splash-content">
        <div className="splash-mark">
          <Icon name="leaf" size={42} />
        </div>

        <strong>silo</strong>
        <p>Every harvest has a home.</p>

        <span className="splash-loader">
          <i></i>
        </span>
      </div>

      <span className="splash-foot">Food rescue network</span>
    </main>
  )
}

// ── Forgot password (used on both login cards) ────────────────────────────────
function ForgotPassword({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: "error" | "success"; text: string } | null>(null)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setNote(null)
    try {
      const result = await api.post<{ message: string }>("/auth/forgot", {
        email: address.trim(),
        // the link in the email comes back to this website
        redirect_to: `${window.location.origin}${window.location.pathname}`,
      })
      setNote({ kind: "success", text: result.message })
    } catch (err) {
      setNote({ kind: "error", text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-link forgot-link"
        onClick={() => {
          setAddress(email)
          setOpen(true)
        }}
      >
        Forgot password?
      </button>
    )
  }

  return (
    <form className="forgot-box" onSubmit={send}>
      <label>
        <span>Email for the reset link</span>
        <input
          required
          type="email"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <div className="forgot-actions">
        <button type="submit" className="outline-action" disabled={busy}>
          {busy ? "Sending..." : "Send reset link"}
        </button>
        <button type="button" className="text-link" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {note && (
        <p className={`auth-feedback ${note.kind === "error" ? "auth-error" : "auth-success"}`} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </form>
  )
}

// ── Reset password (opened from the link in the reset email) ──────────────────
// Supabase sends people back to the website with the details after "#", e.g.
//   http://localhost:5173/#access_token=...&type=recovery
// or, if the link is too old:  #error=access_denied&error_code=otp_expired&...
function readRecoveryLink(): { token: string | null; error: string | null } | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const isRecovery = hash.get("type") === "recovery"
  const error = hash.get("error_description") || hash.get("error")
  if (!isRecovery && !error) return null
  // remove the token from the address bar so it isn't bookmarked or shared
  window.history.replaceState(null, "", window.location.pathname + window.location.search)
  return {
    token: isRecovery ? hash.get("access_token") : null,
    error: error ? error.replace(/\+/g, " ") : null,
  }
}

const RECOVERY = readRecoveryLink()

function ResetPasswordScreen({ go }: { go: (s: Screen) => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(
    RECOVERY?.token
      ? ""
      : RECOVERY?.error
        ? "This reset link has expired or was already used. Go back to login and request a new one."
        : "Open this page from the link in your reset email.",
  )

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirm) {
      setError("The two passwords don't match.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await api.post("/auth/reset", { access_token: RECOVERY?.token, password })
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout go={go}>
      <section className="signup-success reset-card" role="status">
        <span className="signup-success-icon">
          <Icon name="lock" size={24} />
        </span>
        <p className="auth-eyebrow">{done ? "All set" : "Reset password"}</p>
        <h1>{done ? "Your password is updated." : "Choose a new password."}</h1>
        {done ? (
          <>
            <p>You can now log in with your new password, as a farmer or coordinator.</p>
            <button type="button" className="auth-submit" onClick={() => go("signin")}>
              Go to login
            </button>
          </>
        ) : RECOVERY?.token ? (
          <form className="reset-form" onSubmit={save}>
            <label>
              <span>New password</span>
              <input
                required
                minLength={6}
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                required
                minLength={6}
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? "Saving..." : "Save new password"}
            </button>
            {error && (
              <p className="auth-feedback auth-error" role="alert">
                {error}
              </p>
            )}
          </form>
        ) : (
          <>
            <p>{error}</p>
            <button type="button" className="auth-submit" onClick={() => go("signin")}>
              Back to login
            </button>
          </>
        )}
      </section>
    </AuthLayout>
  )
}

// ── Sign In Screen ────────────────────────────────────────────────────────────
function SignInScreen({ go }: { go: (s: Screen) => void }) {
  const { setAccount } = useSession()
  const [farmerEmail, setFarmerEmail] = useState("")
  const [farmerPassword, setFarmerPassword] = useState("")
  const [coordEmail, setCoordEmail] = useState("")
  const [coordPassword, setCoordPassword] = useState("")
  const [busy, setBusy] = useState<"farmer" | "coordinator" | null>(null)
  const [error, setError] = useState<{ role: "farmer" | "coordinator"; text: string } | null>(null)

  const submit = (role: "farmer" | "coordinator") => async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(role)
    try {
      const account =
        role === "farmer"
          ? await signIn(farmerEmail.trim(), farmerPassword, "farmer")
          : await signIn(coordEmail.trim(), coordPassword, "coordinator")
      setAccount(account)
      go(homeFor(account))
    } catch (err) {
      setError({ role, text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <AuthLayout go={go}>
      <section className="login-layout">
        <div className="login-intro">
          <p className="auth-eyebrow">Rescue more. Waste less.</p>
          <h1>Rescue surplus harvest before it spoils.</h1>
          <p>
            Farmers post excess crops. The coordinator sees them ranked by
            spoilage risk and distance, then matches each one to a partner food
            bank.
          </p>
          <img
            className="login-hero-art"
            src="/login-farm.jpeg"
            alt="Green farmland with crops growing in rows"
          />
        </div>

        <div className="login-cards">
          <section className="login-card">
            <div className="login-card-heading">
              <h2>Farmer login</h2>
              <span className="role-tag">Donor</span>
            </div>
            <form onSubmit={submit("farmer")}>
              <label>
                <span>Email</span>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={farmerEmail}
                  onChange={(event) => setFarmerEmail(event.target.value)}
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={farmerPassword}
                  onChange={(event) => setFarmerPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="auth-submit" disabled={busy !== null}>
                {busy === "farmer" ? "Logging in..." : "Log in as farmer"}
              </button>
              {error?.role === "farmer" && (
                <p className="auth-feedback auth-error" role="alert">
                  {error.text}
                </p>
              )}
            </form>
            <ForgotPassword email={farmerEmail} />
            <div className="login-card-bottom">
              <span>New farmer?</span>
              <button
                type="button"
                className="outline-action"
                onClick={() => go("signup")}
              >
                Create farmer account
              </button>
              <small>
                If your account is Pending or Suspended, login shows the status
                screen.
              </small>
            </div>
          </section>

          <section className="login-card">
            <div className="login-card-heading">
              <h2>Coordinator login</h2>
              <span className="role-tag admin-tag">Admin</span>
            </div>
            <form onSubmit={submit("coordinator")}>
              <label>
                <span>Email</span>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  placeholder="coordinator@organization.org"
                  value={coordEmail}
                  onChange={(event) => setCoordEmail(event.target.value)}
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={coordPassword}
                  onChange={(event) => setCoordPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="auth-submit" disabled={busy !== null}>
                {busy === "coordinator" ? "Logging in..." : "Log in as coordinator"}
              </button>
              {error?.role === "coordinator" && (
                <p className="auth-feedback auth-error" role="alert">
                  {error.text}
                </p>
              )}
            </form>
            <ForgotPassword email={coordEmail} />
            <p className="login-help">
              Coordinator accounts are set up by the operating office (barangay,
              city agriculture office, NGO or food bank network desk). No public
              sign-up.
            </p>
          </section>
        </div>
      </section>
    </AuthLayout>
  )
}

// ── Sign Up Screen ────────────────────────────────────────────────────────────
function SignUpScreen({ go }: { go: (s: Screen) => void }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    cooperative: "",
    farm_name: "",
    farm_address: "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [name]: event.target.value })),
  })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      const confirmInput =
        event.currentTarget.elements.namedItem("confirmPassword")
      if (confirmInput instanceof HTMLInputElement) {
        confirmInput.setCustomValidity("Passwords do not match.")
        confirmInput.reportValidity()
      }
      return
    }
    setError("")
    setBusy(true)
    try {
      const result = await api.post<{ needs_email_confirmation: boolean }>("/auth/signup", {
        ...form,
        email: form.email.trim(),
        password,
      })
      setNeedsConfirmation(result.needs_email_confirmation)
      setSubmitted(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout go={go}>
      {submitted ? (
        <section className="signup-success" role="status">
          <span className="signup-success-icon">
            <Icon name="leaf" size={24} />
          </span>
          <p className="auth-eyebrow">Application received</p>
          <h1>Your account is pending review.</h1>
          <p>
            {needsConfirmation
              ? "First, confirm your email using the link we just sent you. "
              : ""}
            A coordinator will verify your details before you can post
            donations. You can log in any time to check your status.
          </p>
          <button
            type="button"
            className="auth-submit"
            onClick={() => go("signin")}
          >
            Back to login
          </button>
        </section>
      ) : (
        <section className="signup-layout">
          <div className="signup-heading">
            <div>
              <p className="auth-eyebrow">Join the network</p>
              <h1>Create a farmer account</h1>
              <p>
                Your account starts as <strong>Pending</strong>. The coordinator
                verifies you (by phone or a cooperative / barangay list) before
                you can post donations.
              </p>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => go("signin")}
            >
              Back to login
            </button>
          </div>

          <form className="signup-form" onSubmit={submit}>
            <fieldset>
              <legend>1 · About you</legend>
              <div className="signup-fields">
                <label>
                  <span>Full name</span>
                  <input
                    required
                    autoComplete="name"
                    placeholder="Your full name"
                    {...field("full_name")}
                  />
                </label>
                <label>
                  <span>Mobile number</span>
                  <input
                    required
                    minLength={7}
                    type="tel"
                    autoComplete="tel"
                    placeholder="09XX XXX XXXX"
                    {...field("phone")}
                  />
                </label>
                <label>
                  <span>Email (used to log in)</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...field("email")}
                  />
                </label>
                <label>
                  <span>Cooperative / association (optional)</span>
                  <input placeholder="Association name" {...field("cooperative")} />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>2 · Your farm</legend>
              <div className="signup-fields">
                <label>
                  <span>Farm name</span>
                  <input
                    required
                    placeholder="Your farm or garden name"
                    {...field("farm_name")}
                  />
                </label>
                <label>
                  <span>Farm address</span>
                  <input
                    required
                    autoComplete="street-address"
                    placeholder="Street, barangay, municipality / city"
                    {...field("farm_address")}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>3 · Log-in details</legend>
              <div className="signup-fields">
                <label>
                  <span>Password</span>
                  <input
                    required
                    minLength={6}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(event) => {
                      const value = event.target.value
                      setPassword(value)
                      const confirmInput =
                        event.currentTarget.form?.elements.namedItem(
                          "confirmPassword",
                        )
                      if (confirmInput instanceof HTMLInputElement) {
                        confirmInput.setCustomValidity(
                          confirmPassword && confirmPassword !== value
                            ? "Passwords do not match."
                            : "",
                        )
                      }
                    }}
                  />
                </label>
                <label>
                  <span>Confirm password</span>
                  <input
                    required
                    minLength={6}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) => {
                      const value = event.target.value
                      setConfirmPassword(value)
                      event.target.setCustomValidity(
                        value && value !== password
                          ? "Passwords do not match."
                          : "",
                      )
                    }}
                  />
                </label>
              </div>
            </fieldset>

            <label className="signup-agreement">
              <input required type="checkbox" />
              <span>
                I agree that Silo only coordinates donations and the receiving
                organization decides whether to accept produce.
              </span>
            </label>
            <div className="signup-actions">
              <button
                type="button"
                className="outline-action"
                onClick={() => go("signin")}
              >
                Cancel
              </button>
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? "Submitting..." : "Submit for approval"}
              </button>
            </div>
            {error && (
              <p className="auth-feedback auth-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
      )}
    </AuthLayout>
  )
}

// ── Donation status labels ────────────────────────────────────────────────────
function donationStatus(
  status: DonationStatus,
  nextPickupAt?: string | null,
): { label: string; tone: ActivityTone } {
  switch (status) {
    case "new":
      return { label: "New", tone: "blue" }
    case "matched":
      return { label: "Matched", tone: "green" }
    case "pickup_scheduled":
      return {
        label: nextPickupAt && isToday(nextPickupAt) ? "Pickup today" : "Pickup scheduled",
        tone: "amber",
      }
    case "delivered":
      return { label: "Delivered", tone: "dark" }
    case "expired":
      return { label: "Expired", tone: "dark" }
    case "rejected":
      return { label: "Rejected", tone: "amber" }
    default:
      return { label: "Cancelled", tone: "dark" }
  }
}

type DashboardData = {
  stats: {
    active_donations: number
    donations_today: number
    pickups_today: number
    next_pickup_at: string | null
    farmers_pending: number
    food_rescued_kg: number | string
    delivered_donations: number
  }
  priority_queue: { type: string; count: number; title: string; detail: string }[]
  priority_total: number
  activity: {
    id: string
    produce: string
    quantity_kg: number | string
    status: DonationStatus
    farm_name: string
    recipient_name: string | null
    next_pickup_at: string | null
  }[]
  rescue_volume: { day: string; kg_rescued: number }[]
}

const QUEUE_LOOK: Record<string, { icon: IconName; className: string; screen: Screen }> = {
  farmers_pending: { icon: "shield", className: "", screen: "farmers" },
  donations_expiring: { icon: "gift", className: "blue-bg", screen: "donations" },
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

// ── Dashboard Screen (coordinators) ───────────────────────────────────────────
function DashboardScreen({ go }: { go: (s: Screen) => void }) {
  const { account, setPendingFarmers } = useSession()
  const [range, setRange] = useState("7 days")
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    setError("")
    api
      .get<DashboardData>(`/dashboard?days=${range === "7 days" ? 7 : 30}`)
      .then((result) => {
        setData(result)
        setPendingFarmers(result.stats.farmers_pending)
      })
      .catch((err) => setError(errorText(err)))
  }, [range])

  useEffect(load, [load])
  useAutoRefresh(load)

  const stats = data?.stats
  const show = (value: number | string | undefined) => (value === undefined ? "…" : value)
  const volume = data?.rescue_volume ?? []
  const maxKg = Math.max(0, ...volume.map((day) => day.kg_rescued))
  const labelEvery = volume.length > 7 ? Math.ceil(volume.length / 7) : 1
  const firstName = account?.profile.first_name

  return (
    <AppShell go={go} active="dashboard" title="Dashboard" live>
      <main className="dashboard-main">
        {/* ── Page heading ───────────────────────────────────────────────── */}
        <section className="page-heading">
          <div>
            <p className="eyebrow">Operations overview</p>
            <h1>Dashboard</h1>
            <p>
              {greeting()}
              {firstName ? `, ${firstName}` : ""}. Here’s what needs your attention
              today.
            </p>
          </div>

          <button
            type="button"
            className="primary-action"
            onClick={() => go("donations")}
          >
            + Log donation
          </button>
        </section>

        {error && (
          <div className="load-error" role="alert">
            <span>{error}</span>
            <button type="button" className="quiet-action" onClick={load}>
              Try again
            </button>
          </div>
        )}

        {/* ── Key metrics ────────────────────────────────────────────────── */}
        <section className="stats-grid" aria-label="Key metrics">
          <article>
            <div className="stat-icon lime">
              <Icon name="gift" />
            </div>
            <p>Active donations</p>
            <strong>{show(stats?.active_donations)}</strong>
            <span className="positive">
              {stats ? `+${stats.donations_today} today` : ""}
            </span>
          </article>

          <article>
            <div className="stat-icon mint">
              <Icon name="truck" />
            </div>
            <p>Pickups today</p>
            <strong>{show(stats?.pickups_today)}</strong>
            <span>
              {stats?.next_pickup_at
                ? `Next at ${formatTime(stats.next_pickup_at)}`
                : stats
                  ? "Nothing scheduled"
                  : ""}
            </span>
          </article>

          <article>
            <div className="stat-icon cream">
              <Icon name="shield" />
            </div>
            <p>Farmers pending</p>
            <strong>{show(stats?.farmers_pending)}</strong>
            {stats &&
              (stats.farmers_pending > 0 ? (
                <span className="attention">Needs review</span>
              ) : (
                <span>All reviewed</span>
              ))}
          </article>

          <article className="impact-stat">
            <div className="stat-icon inverse">
              <Icon name="leaf" />
            </div>
            <p>Food rescued</p>
            <strong>
              {stats ? formatKg(stats.food_rescued_kg) : "…"} <small>kg</small>
            </strong>
            <span>{stats ? `Across ${stats.delivered_donations} donations` : ""}</span>
          </article>
        </section>

        <section className="dashboard-grid">
          {/* ── Donation activity ────────────────────────────────────────── */}
          <article className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Live operations</p>
                <h2>Donation activity</h2>
              </div>

              <button type="button" onClick={() => go("donations")}>
                View all <Icon name="arrow" size={15} />
              </button>
            </div>

            <div className="activity-table">
              <div className="table-head">
                <span>Donation</span>
                <span>Recipient</span>
                <span>Status</span>
                <span></span>
              </div>

              {data?.activity.map((item) => {
                const status = donationStatus(item.status, item.next_pickup_at)
                const title = `${item.produce} · ${formatKg(item.quantity_kg)} kg`
                return (
                  <div key={item.id} className="activity-row">
                    <div className="donation-info">
                      <span className="produce-dot">
                        <Icon name="leaf" size={15} />
                      </span>

                      <div>
                        <strong>{title}</strong>
                        <small>{item.farm_name}</small>
                      </div>
                    </div>

                    <span className="recipient">{item.recipient_name ?? "Not matched yet"}</span>

                    <span className={`status ${status.tone}`}>{status.label}</span>

                    <button
                      type="button"
                      aria-label={`Open ${title}`}
                      onClick={() => go("donations")}
                    >
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                )
              })}
              {data && data.activity.length === 0 && (
                <p className="empty-state">No donations yet.</p>
              )}
              {!data && !error && <p className="empty-state">Loading…</p>}
            </div>
          </article>

          {/* ── Priority queue ───────────────────────────────────────────── */}
          <article className="panel queue-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Action required</p>
                <h2>Priority queue</h2>
              </div>

              <span className="queue-count">{data?.priority_total ?? "…"}</span>
            </div>

            {data?.priority_queue.map((item) => {
              const look = QUEUE_LOOK[item.type] ?? QUEUE_LOOK.donations_expiring
              return (
                <div key={item.type} className="queue-item">
                  <span className={`queue-icon ${look.className}`}>
                    <Icon name={look.icon} />
                  </span>
                  <div>
                    <strong>
                      {item.count}{" "}
                      {item.count === 1
                        ? item.title.replace("farmers", "farmer").replace("pickups", "pickup").replace("donations", "donation")
                        : item.title}
                    </strong>
                    <p>{item.detail}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Go to ${item.title}`}
                    onClick={() => go(look.screen)}
                  >
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              )
            })}
            {data && data.priority_queue.length === 0 && (
              <p className="empty-state">Nothing needs your attention right now.</p>
            )}
          </article>

          {/* ── Rescue volume chart ──────────────────────────────────────── */}
          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Network performance</p>
                <h2>Rescue volume</h2>
              </div>

              <div className="range-picker">
                {RANGES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={range === option ? "selected" : ""}
                    onClick={() => setRange(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="volume-chart live">
              {volume.map((day) => {
                const height = maxKg > 0 ? Math.max(day.kg_rescued > 0 ? 6 : 2, (day.kg_rescued / maxKg) * 100) : 2
                return (
                  <div
                    key={day.day}
                    className="chart-column"
                    title={`${new Date(`${day.day}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${formatKg(day.kg_rescued)} kg`}
                  >
                    <span style={{ height: `${height}%` }}></span>
                  </div>
                )
              })}
            </div>

            <div className="chart-meta">
              {volume
                .filter((_, i) => i % labelEvery === 0)
                .map((day) => {
                  const date = new Date(`${day.day}T00:00`)
                  return (
                    <span key={day.day}>
                      {volume.length > 7
                        ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                    </span>
                  )
                })}
            </div>
            {data && maxKg === 0 && (
              <p className="chart-empty">No deliveries in this period yet.</p>
            )}
          </article>
        </section>
      </main>
    </AppShell>
  )
}

type PageMetric = {
  label: string
  value: string
  detail: string
  icon: IconName
  tone: "lime" | "mint" | "cream"
}

function PageMetrics({ items }: { items: PageMetric[] }) {
  return (
    <section className="stats-grid page-stats" aria-label="Page summary">
      {items.map((item) => (
        <article key={item.label}>
          <div className={`stat-icon ${item.tone}`}>
            <Icon name={item.icon} />
          </div>
          <p>{item.label}</p>
          <strong>{item.value}</strong>
          <span>{item.detail}</span>
        </article>
      ))}
    </section>
  )
}

function ListToolbar({
  search,
  onSearch,
  filters,
  activeFilter,
  onFilter,
}: {
  search: string
  onSearch: (value: string) => void
  filters: string[]
  activeFilter: string
  onFilter: (filter: string) => void
}) {
  return (
    <div className="list-toolbar">
      <label className="list-search">
        <Icon name="search" size={16} />
        <input
          aria-label="Search records"
          placeholder="Search records..."
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      <div className="filter-tabs" role="group" aria-label="Filter records">
        {filters.map((filter) => (
          <button
            type="button"
            key={filter}
            className={activeFilter === filter ? "selected" : ""}
            aria-pressed={activeFilter === filter}
            onClick={() => onFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatusPill({
  label,
  tone = "green",
}: {
  label: string
  tone?: ActivityTone
}) {
  return <span className={`status ${tone}`}>{label}</span>
}

// ── Shared records for the operations pages ───────────────────────────────────
type DonationRecord = {
  id: string
  produce: string
  quantity_kg: number | string
  status: DonationStatus
  expires_at: string | null
  delivered_at: string | null
  notes: string | null
  created_at: string
  farmer: { id: string; farm_name: string } | null
  recipient: { id: string; name: string } | null
  pickups: { id: string; scheduled_at: string; status: string }[]
  logistics?: "pickup" | "deliver"
  condition?: "fresh" | "good" | "fair" | null
  pickup_address?: string | null
  rejection_reason?: string | null
}

type RecipientRecord = { id: string; name: string; type: string; address: string | null; status: string }

const canManageOps = (account: Account | null) =>
  account?.profile.role === "admin" || account?.profile.role === "coordinator"

const nextPickup = (donation: DonationRecord) =>
  donation.pickups
    .filter((pickup) => pickup.status === "scheduled" || pickup.status === "in_progress")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0]

// <input type="datetime-local"> value for "now + hours", rounded to the half hour
function localDateTime(hoursFromNow = 0) {
  const date = new Date(Date.now() + hoursFromNow * 3600_000)
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const thisMonth = (iso: string | null) => {
  if (!iso) return false
  const date = new Date(iso)
  const now = new Date()
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

// ── Donations Screen ──────────────────────────────────────────────────────────
function DonationsScreen({ go }: { go: (s: Screen) => void }) {
  const { account } = useSession()
  const canManage = canManageOps(account)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [donations, setDonations] = useState<DonationRecord[] | null>(null)
  const [farms, setFarms] = useState<Farm[]>([])
  const [recipients, setRecipients] = useState<RecipientRecord[]>([])
  const [error, setError] = useState("")
  // Which form is open: logging a new donation, or acting on one donation
  const [panel, setPanel] = useState<
    | { kind: "log" }
    | { kind: "match"; donation: DonationRecord }
    | { kind: "schedule"; donation: DonationRecord }
    | { kind: "reject"; donation: DonationRecord }
    | null
  >(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null)
  // form fields
  const [farmId, setFarmId] = useState("")
  const [produce, setProduce] = useState("")
  const [quantity, setQuantity] = useState("")
  const [recipientId, setRecipientId] = useState("")
  const [pickupAt, setPickupAt] = useState("")
  const [reason, setReason] = useState("")

  const load = useCallback(() => {
    setError("")
    Promise.all([
      api.get<DonationRecord[]>("/donations?limit=500"),
      api.get<Farm[]>("/farmers?status=approved&limit=500"),
      api.get<RecipientRecord[]>("/recipients?limit=500"),
    ])
      .then(([donationRows, farmRows, recipientRows]) => {
        setDonations(donationRows)
        setFarms(farmRows)
        setRecipients(recipientRows.filter((recipient) => recipient.status !== "closed"))
      })
      .catch((err) => setError(errorText(err)))
  }, [])

  useEffect(load, [load])
  useAutoRefresh(load)

  const open = (next: typeof panel) => {
    setMessage(null)
    setPanel(next)
    if (next?.kind === "log") setFarmId((current) => current || farms[0]?.id || "")
    if (next?.kind === "match") setRecipientId(next.donation.recipient?.id ?? recipients[0]?.id ?? "")
    if (next?.kind === "schedule") {
      setRecipientId(next.donation.recipient?.id ?? recipients[0]?.id ?? "")
      setPickupAt(localDateTime(2))
    }
    if (next?.kind === "reject") setReason("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const run = async (work: () => Promise<string>) => {
    setSaving(true)
    setMessage(null)
    try {
      const text = await work()
      setPanel(null)
      setMessage({ kind: "success", text })
      load()
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const logDonation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    run(async () => {
      await api.post("/donations", {
        farmer_id: farmId,
        produce: produce.trim(),
        quantity_kg: Number(quantity),
      })
      setProduce("")
      setQuantity("")
      return `Logged ${produce.trim()}.`
    })
  }

  const matchDonation = (donation: DonationRecord) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    run(async () => {
      await api.patch(`/donations/${donation.id}`, { recipient_id: recipientId, status: "matched" })
      const name = recipients.find((r) => r.id === recipientId)?.name
      return `${donation.produce} is matched with ${name}. Next: schedule the pickup.`
    })
  }

  const schedulePickup = (donation: DonationRecord) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    run(async () => {
      await api.patch(`/donations/${donation.id}`, { recipient_id: recipientId, status: "matched" })
      await api.post("/pickups", {
        donation_id: donation.id,
        scheduled_at: new Date(pickupAt).toISOString(),
      })
      const partner = recipients.find((recipient) => recipient.id === recipientId)?.name
      return `Pickup for ${donation.produce} to ${partner} scheduled for ${formatDateTime(new Date(pickupAt).toISOString())}.`
    })
  }

  const rejectDonation = (donation: DonationRecord) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    run(async () => {
      await api.post(`/donations/${donation.id}/reject`, { reason: reason.trim() })
      return `Rejected ${donation.produce}. The farmer will see your reason.`
    })
  }

  const markReceived = (donation: DonationRecord) => {
    if (!window.confirm(`Mark ${donation.produce} as received by ${donation.recipient?.name ?? "the recipient"}?`)) return
    run(async () => {
      await api.post(`/donations/${donation.id}/receive`)
      return `${donation.produce} received. Nice work!`
    })
  }

  const cancelDonation = (donation: DonationRecord) => {
    if (!window.confirm(`Cancel the ${donation.produce} donation from ${donation.farmer?.farm_name}?`)) return
    run(async () => {
      await api.patch(`/donations/${donation.id}`, { status: "cancelled" })
      return `Cancelled ${donation.produce}.`
    })
  }

  const statusOf = (donation: DonationRecord) =>
    donation.status === "new"
      ? { label: "Available", tone: "blue" as ActivityTone }
      : donationStatus(donation.status, nextPickup(donation)?.scheduled_at)

  const all = donations ?? []
  const active = all.filter((d) => ["new", "matched", "pickup_scheduled"].includes(d.status))
  const awaitingPickup = all.filter((d) => d.status === "pickup_scheduled")
  const dueToday = awaitingPickup.filter((d) => {
    const pickup = nextPickup(d)
    return pickup && isToday(pickup.scheduled_at)
  }).length
  const matchedThisMonth = all.filter((d) => d.recipient && thisMonth(d.created_at))
  const rescuedThisMonth = all
    .filter((d) => d.status === "delivered" && thisMonth(d.delivered_at ?? d.created_at))
    .reduce((sum, d) => sum + Number(d.quantity_kg), 0)

  const filters = ["All", "Available", "Matched", "Pickup scheduled", "Delivered", "Rejected", "Expired"]
  const visibleDonations = all.filter((donation) => {
    const label = statusOf(donation).label
    const matchesFilter =
      filter === "All" ||
      label === filter ||
      (filter === "Pickup scheduled" && label === "Pickup today")
    const query = search.toLowerCase()
    const matchesSearch = `${donation.produce} ${donation.farmer?.farm_name ?? ""} ${donation.recipient?.name ?? ""}`
      .toLowerCase()
      .includes(query)
    return matchesFilter && matchesSearch
  })

  return (
    <AppShell go={go} active="donations" title="Donations" live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Food operations</p>
            <h1>Donations</h1>
            <p>Every donation logged by farms in your network.</p>
          </div>
          {canManage && (
            <button
              type="button"
              className="primary-action"
              onClick={() => (panel?.kind === "log" ? setPanel(null) : open({ kind: "log" }))}
            >
              {panel?.kind === "log" ? "Cancel" : "+ Log donation"}
            </button>
          )}
        </section>

        {error && (
          <div className="load-error" role="alert">
            <span>{error}</span>
            <button type="button" className="quiet-action" onClick={load}>
              Try again
            </button>
          </div>
        )}

        <PageMetrics
          items={[
            {
              label: "Active donations",
              value: donations ? String(active.length) : "…",
              detail: `${all.filter((d) => isToday(d.created_at)).length} posted today`,
              icon: "gift",
              tone: "lime",
            },
            {
              label: "Awaiting pickup",
              value: donations ? String(awaitingPickup.length) : "…",
              detail: `${dueToday} due today`,
              icon: "clock",
              tone: "cream",
            },
            {
              label: "Matched this month",
              value: donations ? String(matchedThisMonth.length) : "…",
              detail: `Across ${new Set(matchedThisMonth.map((d) => d.farmer?.id)).size} farms`,
              icon: "users",
              tone: "mint",
            },
            {
              label: "Food rescued",
              value: donations ? `${formatKg(rescuedThisMonth)} kg` : "…",
              detail: "Delivered this month",
              icon: "leaf",
              tone: "lime",
            },
          ]}
        />

        {message && !panel && (
          <p className={`page-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
            {message.kind === "success" && message.text.startsWith("Pickup scheduled") && (
              <button type="button" className="quiet-action" onClick={() => go("pickups")}>
                Open Pickups <Icon name="arrow" size={13} />
              </button>
            )}
          </p>
        )}

        {panel?.kind === "log" && (
          <form className="inline-form ops-form" onSubmit={logDonation}>
            <div>
              <p className="eyebrow">Quick entry</p>
              <strong>Log a new donation</strong>
            </div>
            <label>
              Farm
              <select required value={farmId} onChange={(event) => setFarmId(event.target.value)}>
                {farms.length === 0 && <option value="">No approved farms yet</option>}
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farm_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Produce
              <input
                required
                value={produce}
                onChange={(event) => setProduce(event.target.value)}
                placeholder="e.g. Apples"
              />
            </label>
            <label>
              Quantity (kg)
              <input
                required
                type="number"
                min="0.1"
                step="0.1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="e.g. 25"
              />
            </label>
            <button type="submit" className="primary-action" disabled={saving || !farmId}>
              {saving ? "Saving..." : "Save donation"}
            </button>
            {message?.kind === "error" && <p className="form-message error" role="alert">{message.text}</p>}
          </form>
        )}

        {panel?.kind === "match" && (
          <form className="inline-form ops-form" onSubmit={matchDonation(panel.donation)}>
            <div>
              <p className="eyebrow">Match donation</p>
              <strong>
                {panel.donation.produce} · {formatKg(panel.donation.quantity_kg)} kg
              </strong>
              <small className="form-sub">{panel.donation.farmer?.farm_name}</small>
            </div>
            <label>
              Send to recipient
              <select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>
                {recipients.length === 0 && <option value="">No recipients yet</option>}
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="outline-action" onClick={() => setPanel(null)}>
              Close
            </button>
            <button type="submit" className="primary-action" disabled={saving || !recipientId}>
              {saving ? "Saving..." : "Match"}
            </button>
            {message?.kind === "error" && <p className="form-message error" role="alert">{message.text}</p>}
          </form>
        )}

        {panel?.kind === "schedule" && (
          <form className="inline-form ops-form" onSubmit={schedulePickup(panel.donation)}>
            <div>
              <p className="eyebrow">Schedule pickup</p>
              <strong>
                {panel.donation.produce} · {formatKg(panel.donation.quantity_kg)} kg
              </strong>
              <small className="form-sub">{panel.donation.farmer?.farm_name}</small>
            </div>
            <label>
              Recipient partner
              <select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>
                {recipients.length === 0 && <option value="">No open partners available</option>}
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pickup time
              <input
                required
                type="datetime-local"
                value={pickupAt}
                onChange={(event) => setPickupAt(event.target.value)}
              />
            </label>
            <button type="button" className="outline-action" onClick={() => setPanel(null)}>
              Close
            </button>
            <button type="submit" className="primary-action" disabled={saving || !recipientId}>
              {saving ? "Saving..." : "Schedule"}
            </button>
            {message?.kind === "error" && <p className="form-message error" role="alert">{message.text}</p>}
          </form>
        )}

        {panel?.kind === "reject" && (
          <form className="inline-form ops-form" onSubmit={rejectDonation(panel.donation)}>
            <div>
              <p className="eyebrow">Reject donation</p>
              <strong>
                {panel.donation.produce} · {formatKg(panel.donation.quantity_kg)} kg
              </strong>
              <small className="form-sub">{panel.donation.farmer?.farm_name}</small>
            </div>
            <label>
              Reason (the farmer will see this)
              <input
                required
                minLength={3}
                maxLength={300}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. No cold storage this week"
              />
            </label>
            <button type="button" className="outline-action" onClick={() => setPanel(null)}>
              Close
            </button>
            <button type="submit" className="primary-action" disabled={saving}>
              {saving ? "Saving..." : "Reject"}
            </button>
            {message?.kind === "error" && <p className="form-message error" role="alert">{message.text}</p>}
          </form>
        )}

        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Network inventory</p>
              <h2>
                All donations <span>{visibleDonations.length}</span>
              </h2>
            </div>
            <button
              type="button"
              className="quiet-action"
              onClick={() => {
                setSearch("")
                setFilter("All")
              }}
            >
              Reset filters
            </button>
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            filters={filters}
            activeFilter={filter}
            onFilter={setFilter}
          />
          <div className="table-scroll">
            <div className={`record-table donations-table ${canManage ? "with-actions" : ""}`}>
              <div className="record-table-head">
                <span>Produce & farm</span>
                <span>Quantity</span>
                <span>Recipient</span>
                <span>Pickup</span>
                <span>Status</span>
                {canManage && <span></span>}
              </div>
              {visibleDonations.map((donation) => {
                const status = statusOf(donation)
                const pickup = nextPickup(donation)
                const busy = saving && panel === null
                return (
                  <div className="record-row" key={donation.id}>
                    <div className="record-primary">
                      <span className="produce-dot">
                        <Icon name="leaf" size={15} />
                      </span>
                      <div>
                        <strong>{donation.produce}</strong>
                        <small>
                          {donation.farmer?.farm_name ?? "—"}
                          {donation.logistics === "deliver" ? " · farmer delivers" : donation.logistics === "pickup" ? " · needs pickup" : ""}
                          {donation.expires_at && ["new", "matched"].includes(donation.status)
                            ? ` · use by ${new Date(donation.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                            : ""}
                        </small>
                      </div>
                    </div>
                    <span>{formatKg(donation.quantity_kg)} kg</span>
                    <span>{donation.recipient?.name ?? "—"}</span>
                    <span>
                      {pickup
                        ? formatDateTime(pickup.scheduled_at)
                        : donation.status === "delivered" && donation.delivered_at
                          ? `Delivered ${formatDateTime(donation.delivered_at)}`
                          : "—"}
                    </span>
                    <StatusPill label={status.label} tone={status.tone} />
                    {canManage && (
                      <div className="row-actions">
                        {donation.status === "new" && (
                          <>
                            <button type="button" className="row-action" disabled={busy} onClick={() => open({ kind: "match", donation })}>
                              Match
                            </button>
                            <button type="button" className="row-action danger" disabled={busy} onClick={() => open({ kind: "reject", donation })}>
                              Reject
                            </button>
                          </>
                        )}
                        {donation.status === "matched" && (
                          <>
                            {donation.logistics === "deliver" ? (
                              <button type="button" className="row-action" disabled={busy} onClick={() => markReceived(donation)}>
                                Received
                              </button>
                            ) : (
                              <button type="button" className="row-action" onClick={() => open({ kind: "schedule", donation })}>
                                Schedule
                              </button>
                            )}
                            <button type="button" className="row-action danger" disabled={busy} onClick={() => open({ kind: "reject", donation })}>
                              Reject
                            </button>
                          </>
                        )}
                        {donation.status === "pickup_scheduled" && (
                          <button type="button" className="row-action" onClick={() => go("pickups")}>
                            View pickup
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {donations && visibleDonations.length === 0 && (
                <p className="empty-state">
                  {all.length ? "No donations match your search." : "No donations yet."}
                </p>
              )}
              {!donations && !error && <p className="empty-state">Loading…</p>}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

// ── Pickups Screen ────────────────────────────────────────────────────────────
type PickupRecord = {
  id: string
  scheduled_at: string
  status: "scheduled" | "in_progress" | "completed" | "cancelled"
  donation: {
    id: string
    produce: string
    quantity_kg: number | string
    status: DonationStatus
    farmer: { farm_name: string } | null
    recipient: { name: string } | null
  } | null
}

function pickupStatus(pickup: PickupRecord): { label: string; tone: ActivityTone } {
  if (pickup.status === "completed") return { label: "Delivered", tone: "dark" }
  if (pickup.status === "cancelled") return { label: "Cancelled", tone: "dark" }
  if (pickup.status === "in_progress") return { label: "On the way", tone: "blue" }
  return { label: "Scheduled", tone: "green" }
}

function PickupsScreen({ go }: { go: (s: Screen) => void }) {
  const { account } = useSession()
  const canManage = canManageOps(account)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("Upcoming")
  const [pickups, setPickups] = useState<PickupRecord[] | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<PickupRecord | null>(null)
  const [pickupAt, setPickupAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null)

  const load = useCallback(() => {
    setError("")
    api.get<PickupRecord[]>("/pickups")
      .then(setPickups)
      .catch((err) => setError(errorText(err)))
  }, [])

  useEffect(load, [load])
  useAutoRefresh(load)

  const manage = (pickup: PickupRecord) => {
    setMessage(null)
    setSelected(pickup)
    const date = new Date(pickup.scheduled_at)
    const pad = (n: number) => String(n).padStart(2, "0")
    setPickupAt(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const update = async (pickup: PickupRecord, changes: Record<string, unknown>, done: string) => {
    setSaving(true)
    setMessage(null)
    try {
      await api.patch(`/pickups/${pickup.id}`, changes)
      setSelected(null)
      setMessage({ kind: "success", text: done })
      load()
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const label = (pickup: PickupRecord) =>
    `${pickup.donation?.produce ?? "Donation"} · ${formatKg(pickup.donation?.quantity_kg ?? 0)} kg`

  const saveChanges = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    update(
      selected,
      { scheduled_at: new Date(pickupAt).toISOString() },
      `Pickup rescheduled for ${formatDateTime(new Date(pickupAt).toISOString())}.`,
    )
  }

  const markDelivered = (pickup: PickupRecord) => {
    if (!window.confirm(`Mark ${label(pickup)} as delivered to ${pickup.donation?.recipient?.name ?? "the recipient"}?`)) return
    update(pickup, { status: "completed" }, `${label(pickup)} delivered. Nice work!`)
  }

  const cancelPickup = (pickup: PickupRecord) => {
    if (!window.confirm(`Cancel this pickup? The donation goes back to "Matched" so you can reschedule it.`)) return
    update(pickup, { status: "cancelled" }, "Pickup cancelled. You can reschedule it from Donations.")
  }

  const all = pickups ?? []
  const open = all.filter((p) => p.status === "scheduled" || p.status === "in_progress")
  const today = all.filter((p) => p.status !== "cancelled" && isToday(p.scheduled_at))
  const upcoming = open.filter((p) => new Date(p.scheduled_at) >= new Date(Date.now() - 3600_000))
  const nextOne = upcoming[0]
  const weekAgo = Date.now() - 7 * 86400_000
  const completedWeek = all.filter((p) => p.status === "completed" && new Date(p.scheduled_at).getTime() >= weekAgo)
  const kgWeek = completedWeek.reduce((sum, p) => sum + Number(p.donation?.quantity_kg ?? 0), 0)
  const inSevenDays = open.filter((p) => new Date(p.scheduled_at).getTime() <= Date.now() + 7 * 86400_000)

  const filteredPickups = all.filter((pickup) => {
    const matchesFilter =
      filter === "Upcoming"
        ? pickup.status === "scheduled" || pickup.status === "in_progress"
        : filter === "Delivered"
          ? pickup.status === "completed"
          : true
    return (
      matchesFilter &&
      `${pickup.donation?.farmer?.farm_name ?? ""} ${pickup.donation?.produce ?? ""} ${pickup.donation?.recipient?.name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })

  return (
    <AppShell go={go} active="pickups" title="Pickups" live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Food operations</p>
            <h1>Pickups</h1>
            <p>Scheduled pickups and delivery status.</p>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => go("donations")}
          >
            {canManage ? "Schedule a pickup" : "View donations"}
          </button>
        </section>

        {error && (
          <div className="load-error" role="alert">
            <span>{error}</span>
            <button type="button" className="quiet-action" onClick={load}>
              Try again
            </button>
          </div>
        )}

        <PageMetrics
          items={[
            {
              label: "Scheduled today",
              value: pickups ? String(today.length) : "…",
              detail: nextOne ? `Next: ${formatDateTime(nextOne.scheduled_at)}` : "Nothing upcoming",
              icon: "truck",
              tone: "mint",
            },
            {
              label: "Active pickups",
              value: pickups ? String(open.length) : "…",
              detail: "Scheduled or in progress",
              icon: "truck",
              tone: "cream",
            },
            {
              label: "Delivered this week",
              value: pickups ? String(completedWeek.length) : "…",
              detail: `${formatKg(kgWeek)} kg of food`,
              icon: "chart",
              tone: "lime",
            },
            {
              label: "Next 7 days",
              value: pickups ? String(inSevenDays.length) : "…",
              detail: "Pickups planned",
              icon: "clock",
              tone: "mint",
            },
          ]}
        />

        {message && !selected && (
          <p className={`page-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}

        {selected && (
          <form className="inline-form ops-form" onSubmit={saveChanges}>
            <div>
              <p className="eyebrow">Manage pickup</p>
              <strong>{label(selected)}</strong>
              <small className="form-sub">
                {selected.donation?.farmer?.farm_name} → {selected.donation?.recipient?.name}
              </small>
            </div>
            <label>
              Pickup time
              <input
                required
                type="datetime-local"
                value={pickupAt}
                onChange={(event) => setPickupAt(event.target.value)}
              />
            </label>
            <button type="submit" className="primary-action" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <div className="form-extra-actions">
              <button type="button" className="row-action" disabled={saving} onClick={() => markDelivered(selected)}>
                Mark delivered
              </button>
              <button type="button" className="row-action danger" disabled={saving} onClick={() => cancelPickup(selected)}>
                Cancel pickup
              </button>
              <button type="button" className="row-action" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            {message?.kind === "error" && <p className="form-message error" role="alert">{message.text}</p>}
          </form>
        )}

        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Route coordination</p>
              <h2>
                Pickup schedule <span>{filteredPickups.length}</span>
              </h2>
            </div>
            <button type="button" className="quiet-action" onClick={() => go("donations")}>
              Schedule from Donations <Icon name="arrow" size={13} />
            </button>
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            filters={["Upcoming", "Delivered", "All"]}
            activeFilter={filter}
            onFilter={setFilter}
          />
          <div className="table-scroll">
            <div className="record-table pickups-table">
              <div className="record-table-head">
                <span>Pickup</span>
                <span>Donation</span>
                <span>Recipient</span>
                <span>Status</span>
                <span></span>
              </div>
              {filteredPickups.map((pickup) => {
                const status = pickupStatus(pickup)
                const isOpen = pickup.status === "scheduled" || pickup.status === "in_progress"
                return (
                  <div className="record-row" key={pickup.id}>
                    <div className="record-primary">
                      <span className="date-icon">
                        <Icon name="clock" size={16} />
                      </span>
                      <div>
                        <strong>{formatDateTime(pickup.scheduled_at)}</strong>
                        <small>{pickup.donation?.farmer?.farm_name ?? "—"}</small>
                      </div>
                    </div>
                    <span>{label(pickup)}</span>
                    <span>{pickup.donation?.recipient?.name ?? "—"}</span>
                    <StatusPill label={status.label} tone={status.tone} />
                    {canManage && isOpen ? (
                      <div className="row-actions">
                        <button type="button" className="row-action" onClick={() => manage(pickup)}>
                          Manage
                        </button>
                        <button type="button" className="row-action" disabled={saving} onClick={() => markDelivered(pickup)}>
                          Done
                        </button>
                      </div>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </div>
                )
              })}
              {pickups && filteredPickups.length === 0 && (
                <p className="empty-state">
                  {all.length ? "No pickups here." : "No pickups yet. Schedule one from a matched donation."}
                </p>
              )}
              {!pickups && !error && <p className="empty-state">Loading…</p>}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

// ── Farmers Screen (coordinators review farmer accounts here) ─────────────────
type FarmRecord = Farm & {
  donations: { produce: string; status: DonationStatus; created_at: string }[]
}

const FARM_STATUS: Record<FarmStatus, { label: string; tone: ActivityTone }> = {
  pending: { label: "Pending review", tone: "amber" },
  approved: { label: "Active", tone: "green" },
  rejected: { label: "Rejected", tone: "dark" },
  suspended: { label: "Suspended", tone: "dark" },
}

function topProduce(names: string[], limit: number) {
  const counts = new Map<string, number>()
  for (const name of names) {
    const key = name.trim()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name]) => name)
}

function FarmersScreen({ go }: { go: (s: Screen) => void }) {
  const { account, setPendingFarmers } = useSession()
  const canManage = account?.profile.role === "admin" || account?.profile.role === "coordinator"
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All farmers")
  const [farmers, setFarmers] = useState<FarmRecord[] | null>(null)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setError("")
    api
      .get<FarmRecord[]>("/farmers?limit=500")
      .then((rows) => {
        setFarmers(rows)
        setPendingFarmers(rows.filter((farm) => farm.status === "pending").length)
      })
      .catch((err) => setError(errorText(err)))
  }, [])

  useEffect(load, [load])
  useAutoRefresh(load)

  const review = async (farm: FarmRecord, action: "approve" | "reject" | "suspend") => {
    if (action !== "approve" && !window.confirm(`${action === "reject" ? "Reject" : "Suspend"} ${farm.farm_name}?`)) return
    setBusyId(farm.id)
    setError("")
    try {
      const updated = await api.post<Farm>(`/farmers/${farm.id}/${action}`)
      const next = all.map((row) => (row.id === farm.id ? { ...row, ...updated } : row))
      setFarmers(next)
      setPendingFarmers(next.filter((row) => row.status === "pending").length)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  const all = farmers ?? []
  const pending = all.filter((farm) => farm.status === "pending").length
  const active = all.filter((farm) => farm.status === "approved")
  const areas = new Set(active.map((farm) => farm.location).filter(Boolean))
  const now = new Date()
  const donationsThisMonth = all
    .flatMap((farm) => farm.donations)
    .filter((donation) => {
      const date = new Date(donation.created_at)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length
  const [mostDonated] = topProduce(all.flatMap((farm) => farm.donations.map((d) => d.produce)), 1)

  const filteredFarmers = all.filter((farm) => {
    const label = FARM_STATUS[farm.status].label
    const matchesFilter =
      filter === "All farmers" ||
      (filter === "Pending review" ? farm.status === "pending" : filter === "Active" ? farm.status === "approved" : label === filter)
    return (
      matchesFilter &&
      `${farm.farm_name} ${farm.contact_name} ${farm.location ?? ""} ${farm.donations.map((d) => d.produce).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })

  return (
    <AppShell go={go} active="farmers" title="Farmers" live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Community</p>
            <h1>Farmers</h1>
            <p>Partner farms and new account applications to review.</p>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => setFilter("Pending review")}
          >
            Review applications · {farmers ? pending : "…"}
          </button>
        </section>
        <PageMetrics
          items={[
            {
              label: "Partner farms",
              value: farmers ? String(active.length) : "…",
              detail: areas.size ? `Across ${areas.size} ${areas.size === 1 ? "area" : "areas"}` : "Approved farms",
              icon: "shield",
              tone: "lime",
            },
            {
              label: "Applications",
              value: farmers ? String(pending) : "…",
              detail: "Waiting for review",
              icon: "clock",
              tone: "cream",
            },
            {
              label: "Donations this month",
              value: farmers ? String(donationsThisMonth) : "…",
              detail: "From all farms",
              icon: "gift",
              tone: "mint",
            },
            {
              label: "Top produce",
              value: mostDonated ?? "—",
              detail: "Most donated",
              icon: "leaf",
              tone: "lime",
            },
          ]}
        />
        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Growing together</p>
              <h2>
                Farm network <span>{filteredFarmers.length}</span>
              </h2>
            </div>
            <button
              type="button"
              className="quiet-action"
              onClick={() => {
                setFilter("All farmers")
                setSearch("")
              }}
            >
              View all partners
            </button>
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            filters={["All farmers", "Pending review", "Active", "Suspended"]}
            activeFilter={filter}
            onFilter={setFilter}
          />
          {error && (
            <div className="load-error inline-note" role="alert">
              <span>{error}</span>
              <button type="button" className="quiet-action" onClick={load}>
                Reload
              </button>
            </div>
          )}
          <div className="table-scroll">
            <div className="record-table farmers-table">
              <div className="record-table-head">
                <span>Farm</span>
                <span>Location</span>
                <span>Primary produce</span>
                <span>Activity</span>
                <span>Member since</span>
                <span>Status</span>
                <span></span>
              </div>
              {filteredFarmers.map((farm) => {
                const status = FARM_STATUS[farm.status]
                const produce = topProduce(farm.donations.map((d) => d.produce), 2)
                const count = farm.donations.length
                const busy = busyId === farm.id
                return (
                  <div className="record-row" key={farm.id}>
                    <div className="record-primary">
                      <span className="initial-avatar">{initials(farm.farm_name)}</span>
                      <div>
                        <strong>{farm.farm_name}</strong>
                        <small>
                          {[farm.contact_name, farm.phone].filter(Boolean).join(" · ") || "Local farm partner"}
                        </small>
                      </div>
                    </div>
                    <span title={farm.location ?? ""}>{farm.location ?? "—"}</span>
                    <span>{produce.length ? produce.join(", ") : "No donations yet"}</span>
                    <span>
                      {farm.status === "pending"
                        ? "New application"
                        : `${count} ${count === 1 ? "donation" : "donations"}`}
                    </span>
                    <span>{formatJoined(farm.created_at)}</span>
                    <StatusPill label={status.label} tone={status.tone} />
                    {canManage ? (
                      <div className="row-actions">
                        {farm.status === "pending" && (
                          <>
                            <button type="button" className="row-action" disabled={busy} onClick={() => review(farm, "approve")}>
                              Approve
                            </button>
                            <button type="button" className="row-action danger" disabled={busy} onClick={() => review(farm, "reject")}>
                              Reject
                            </button>
                          </>
                        )}
                        {farm.status === "approved" && (
                          <button type="button" className="row-action danger" disabled={busy} onClick={() => review(farm, "suspend")}>
                            Suspend
                          </button>
                        )}
                        {(farm.status === "suspended" || farm.status === "rejected") && (
                          <button type="button" className="row-action" disabled={busy} onClick={() => review(farm, "approve")}>
                            Reactivate
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </div>
                )
              })}
              {farmers && filteredFarmers.length === 0 && (
                <p className="empty-state">
                  {all.length ? "No farmers match your search." : "No farmers have signed up yet."}
                </p>
              )}
              {!farmers && !error && <p className="empty-state">Loading…</p>}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

// ── Recipients Screen ─────────────────────────────────────────────────────────
type RecipientType = "rescue_partner"
type RecipientStatus = "open" | "limited" | "closed"

type RecipientFull = RecipientRecord & {
  type: RecipientType
  contact_name: string | null
  phone: string | null
  needs: string | null
  status: RecipientStatus
  donations: { quantity_kg: number | string; status: DonationStatus; delivered_at: string | null }[]
}

const RECIPIENT_TYPES: Record<RecipientType, string> = {
  rescue_partner: "Non-governmental organization",
}

const RECIPIENT_STATUS: Record<RecipientStatus, { label: string; tone: ActivityTone }> = {
  open: { label: "Open", tone: "green" },
  limited: { label: "Limited availability", tone: "amber" },
  closed: { label: "Closed", tone: "dark" },
}

type RecipientForm = {
  name: string
  type: RecipientType
  address: string
  contact_name: string
  phone: string
  needs: string
  status: RecipientStatus
}

const emptyRecipient: RecipientForm = {
  name: "",
  type: "rescue_partner",
  address: "",
  contact_name: "",
  phone: "",
  needs: "",
  status: "open",
}

function recipientBody(form: RecipientForm) {
  const clean = (value: string) => value.trim() || null
  return {
    name: form.name.trim(),
    type: form.type,
    address: clean(form.address),
    contact_name: clean(form.contact_name),
    phone: clean(form.phone),
    needs: clean(form.needs),
    status: form.status,
  }
}

function RecipientsScreen({ go }: { go: (s: Screen) => void }) {
  const { account } = useSession()
  const canManage = canManageOps(account)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All partners")
  const [recipients, setRecipients] = useState<RecipientFull[] | null>(null)
  const [error, setError] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState<RecipientForm>(emptyRecipient)
  const [selected, setSelected] = useState<RecipientFull | null>(null)
  const [editForm, setEditForm] = useState<RecipientForm>(emptyRecipient)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null)

  const load = useCallback(() => {
    setError("")
    api
      .get<RecipientFull[]>("/recipients?limit=500")
      .then(setRecipients)
      .catch((err) => setError(errorText(err)))
  }, [])

  useEffect(load, [load])
  useAutoRefresh(load)

  const save = async (work: () => Promise<unknown>, text: string, after?: () => void) => {
    setSaving(true)
    setMessage(null)
    try {
      await work()
      after?.()
      setMessage({ kind: "success", text })
      load()
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const addRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = form.name.trim()
    save(() => api.post("/recipients", recipientBody(form)), `Added ${name}. It now appears when matching donations.`, () => {
      setForm(emptyRecipient)
      setShowAddForm(false)
      setFilter("All partners")
      setSearch("")
    })
  }

  const openEdit = (recipient: RecipientFull) => {
    setMessage(null)
    setSelected(recipient)
    setEditForm({
      name: recipient.name,
      type: recipient.type,
      address: recipient.address ?? "",
      contact_name: recipient.contact_name ?? "",
      phone: recipient.phone ?? "",
      needs: recipient.needs ?? "",
      status: recipient.status,
    })
  }

  const saveEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    save(() => api.patch(`/recipients/${selected.id}`, recipientBody(editForm)), `Saved ${editForm.name.trim()}.`, () =>
      setSelected(null),
    )
  }

  const remove = (recipient: RecipientFull) => {
    const donationNote = recipient.donations.length
      ? ` ${recipient.donations.length} associated ${recipient.donations.length === 1 ? "donation will" : "donations will"} remain, but will no longer be linked to this partner.`
      : ""
    if (!window.confirm(`Remove ${recipient.name}? This can't be undone.${donationNote}`)) return
    save(() => api.delete(`/recipients/${recipient.id}`), `Removed ${recipient.name}.`, () => setSelected(null))
  }

  const all = recipients ?? []
  const areas = new Set(all.map((r) => r.address?.trim()).filter(Boolean))
  const delivered = all.flatMap((r) => r.donations).filter((d) => d.status === "delivered")
  const kgReceived = delivered.reduce((sum, d) => sum + Number(d.quantity_kg), 0)
  const openCount = all.filter((r) => r.status === "open").length
  const limitedCount = all.filter((r) => r.status === "limited").length
  const deliveriesThisMonth = delivered.filter((d) => thisMonth(d.delivered_at)).length

  const filteredRecipients = all.filter((recipient) => {
    const status = RECIPIENT_STATUS[recipient.status].label
    const matchesFilter = filter === "All partners" || status === filter
    return (
      matchesFilter &&
      `${recipient.name} ${RECIPIENT_TYPES[recipient.type]} ${recipient.address ?? ""} ${recipient.needs ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })

  const fields = (value: RecipientForm, change: (next: RecipientForm) => void, full: boolean) => (
    <>
      <label>
        Organization name
        <input
          required
          value={value.name}
          onChange={(event) => change({ ...value, name: event.target.value })}
          placeholder="e.g. Partner NGO"
        />
      </label>
      <label>
        Partner type
        <select value={value.type} onChange={(event) => change({ ...value, type: event.target.value as RecipientType })}>
          {Object.entries(RECIPIENT_TYPES).map(([type, name]) => (
            <option key={type} value={type}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Location
        <input
          value={value.address}
          onChange={(event) => change({ ...value, address: event.target.value })}
          placeholder="e.g. Sampaloc, Manila"
        />
      </label>
      <label>
        Priority needs
        <input
          value={value.needs}
          onChange={(event) => change({ ...value, needs: event.target.value })}
          placeholder="e.g. Fresh produce"
        />
      </label>
      {full && (
        <>
          <label>
            Contact person
            <input
              value={value.contact_name}
              onChange={(event) => change({ ...value, contact_name: event.target.value })}
              placeholder="Name"
            />
          </label>
          <label>
            Contact number
            <input
              type="tel"
              value={value.phone}
              onChange={(event) => change({ ...value, phone: event.target.value })}
              placeholder="09XX XXX XXXX"
            />
          </label>
          <label>
            Status
            <select value={value.status} onChange={(event) => change({ ...value, status: event.target.value as RecipientStatus })}>
              <option value="open">Open</option>
              <option value="limited">Limited availability</option>
              <option value="closed">Closed (hide from matching)</option>
            </select>
          </label>
        </>
      )}
    </>
  )

  return (
    <AppShell go={go} active="recipients" title="Recipient Partners" live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Community</p>
            <h1>Recipient Partners</h1>
            <p>NGO partners that receive donations.</p>
          </div>
          {canManage && (
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setMessage(null)
                setShowAddForm((open) => !open)
              }}
            >
              {showAddForm ? "Cancel" : "+ Add partner"}
            </button>
          )}
        </section>

        {error && (
          <div className="load-error" role="alert">
            <span>{error}</span>
            <button type="button" className="quiet-action" onClick={load}>
              Try again
            </button>
          </div>
        )}

        <PageMetrics
          items={[
            {
              label: "Partners",
              value: recipients ? String(all.length) : "…",
              detail: areas.size ? `Across ${areas.size} ${areas.size === 1 ? "area" : "areas"}` : "Partner organizations",
              icon: "home",
              tone: "lime",
            },
            {
              label: "Food received",
              value: recipients ? `${formatKg(kgReceived)} kg` : "…",
              detail: `From ${delivered.length} deliveries`,
              icon: "leaf",
              tone: "mint",
            },
            {
              label: "Open to donations",
              value: recipients ? String(openCount + limitedCount) : "…",
              detail: `${limitedCount} with limited availability`,
              icon: "gift",
              tone: "cream",
            },
            {
              label: "Deliveries",
              value: recipients ? String(deliveriesThisMonth) : "…",
              detail: "This month",
              icon: "truck",
              tone: "lime",
            },
          ]}
        />

        {message && !selected && (
          <p className={`page-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}

        {showAddForm && (
          <form className="inline-form ops-form" onSubmit={addRecipient}>
            <div>
              <p className="eyebrow">New partner</p>
              <strong>Add an NGO partner</strong>
            </div>
            {fields(form, setForm, false)}
            <button type="submit" className="primary-action" disabled={saving}>
              {saving ? "Adding..." : "Add partner"}
            </button>
          </form>
        )}

        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Where food goes</p>
              <h2>
                Recipient partners <span>{filteredRecipients.length}</span>
              </h2>
            </div>
            <button type="button" className="quiet-action" onClick={() => setFilter("Open")}>
              Show open partners
            </button>
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            filters={["All partners", "Open", "Limited availability", "Closed"]}
            activeFilter={filter}
            onFilter={setFilter}
          />
          <div className="table-scroll">
            <div className={`record-table recipients-table ${canManage ? "with-actions" : ""}`}>
              <div className="record-table-head">
                <span>Organization</span>
                <span>Partner type</span>
                <span>Location</span>
                <span>Priority needs</span>
                <span>Status</span>
                {canManage && <span></span>}
              </div>
              {filteredRecipients.map((recipient) => {
                const status = RECIPIENT_STATUS[recipient.status]
                const received = recipient.donations
                  .filter((d) => d.status === "delivered")
                  .reduce((sum, d) => sum + Number(d.quantity_kg), 0)
                return (
                  <div className="record-row" key={recipient.id}>
                    <div className="record-primary">
                      <span className="initial-avatar recipient-avatar">{initials(recipient.name)}</span>
                      <div>
                        <strong>{recipient.name}</strong>
                        <small>{received ? `${formatKg(received)} kg received` : "No deliveries yet"}</small>
                      </div>
                    </div>
                    <span>{RECIPIENT_TYPES[recipient.type]}</span>
                    <span title={recipient.address ?? ""}>{recipient.address || "—"}</span>
                    <span title={recipient.needs ?? ""}>{recipient.needs || "—"}</span>
                    <StatusPill label={status.label} tone={status.tone} />
                    {canManage && (
                      <button type="button" className="row-action" onClick={() => openEdit(recipient)}>
                        Edit
                      </button>
                    )}
                  </div>
                )
              })}
              {recipients && filteredRecipients.length === 0 && (
                <p className="empty-state">
                  {all.length ? "No partners match your search." : "No NGO partners yet. Add a partner above."}
                </p>
              )}
              {!recipients && !error && <p className="empty-state">Loading…</p>}
            </div>
          </div>
        </section>

        {selected && (
          <div className="detail-backdrop" role="presentation" onClick={() => setSelected(null)}>
            <section
              className="detail-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recipient-edit-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="detail-close"
                aria-label="Close"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
              <span className="initial-avatar recipient-avatar">{initials(selected.name)}</span>
              <p className="eyebrow">Edit NGO partner</p>
              <h2 id="recipient-edit-title">{selected.name}</h2>
              <form className="dialog-form" onSubmit={saveEdit}>
                {fields(editForm, setEditForm, true)}
                <div className="dialog-actions">
                  <button type="submit" className="primary-action" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <button type="button" className="outline-action" onClick={() => setSelected(null)}>
                    Cancel
                  </button>
                  <button type="button" className="row-action danger" disabled={saving} onClick={() => remove(selected)}>
                    Remove partner
                  </button>
                </div>
              </form>
              {message && (
                <p className={`form-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
                  {message.text}
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  )
}

// ── Reports Screen ────────────────────────────────────────────────────────────
type ReportData = {
  period: "7d" | "30d" | "12m"
  start: string
  end: string
  totals: {
    kg_rescued: number
    previous_kg_rescued: number
    change_percent: number | null
    delivered_donations: number
    posted_donations: number
    matched_percent: number | null
    partner_farms: number
    partner_recipients: number
    estimated_meals: number
    kg_per_meal: number
  }
  series: { key: string; label: string; kg: number }[]
  where_it_went: { name: string; kg: number; percent: number }[]
  top_farms: { name: string; kg: number }[]
  top_produce: { name: string; kg: number }[]
  top_recipients: { name: string; kg: number }[]
  top_partner_ngos: { name: string; kg: number }[]
}

const REPORT_PERIODS: { label: string; value: ReportData["period"]; phrase: string }[] = [
  { label: "7 days", value: "7d", phrase: "in the last 7 days" },
  { label: "30 days", value: "30d", phrase: "in the last 30 days" },
  { label: "12 months", value: "12m", phrase: "in the last 12 months" },
]

const IMPACT_DOTS = ["green-dot", "yellow-dot", "blue-dot"]
const IMPACT_COLORS = ["var(--green)", "#d3a63c", "#7999a2"]

// A round number just above the biggest bar, for the chart's scale
function niceMax(value: number) {
  if (value <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10
  return step * magnitude
}

function ReportsScreen({ go }: { go: (s: Screen) => void }) {
  const [period, setPeriod] = useState<ReportData["period"]>("30d")
  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    setError("")
    api
      .get<ReportData>(`/reports?period=${period}`)
      .then(setData)
      .catch((err) => setError(errorText(err)))
  }, [period])

  useEffect(load, [load])
  useAutoRefresh(load)

  const totals = data?.totals
  const phrase = REPORT_PERIODS.find((p) => p.value === period)?.phrase ?? ""
  const scale = niceMax(Math.max(0, ...(data?.series ?? []).map((point) => point.kg)))
  const labelEvery = (data?.series.length ?? 0) > 12 ? 5 : 1
  const change = totals?.change_percent

  const changeText =
    !totals || totals.kg_rescued === 0
      ? "No deliveries yet in this period"
      : change === null || change === undefined
        ? "First deliveries in this comparison"
        : change === 0
          ? "Same as the previous period"
          : `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}% vs previous period`

  const note = !totals
    ? null
    : totals.kg_rescued === 0
      ? {
          title: "No deliveries in this period yet",
          text: "Once pickups are marked delivered on the Pickups page, they show up here.",
        }
      : change && change > 0
        ? {
            title: "Rescue is growing in your network",
            text: `Food recovery is up ${change}% compared with the previous period. Thank you for helping local food reach local tables.`,
          }
        : change && change < 0
          ? {
              title: "Rescue dipped this period",
              text: `Deliveries are down ${Math.abs(change)}% from the previous period. Check Donations for produce waiting to be matched.`,
            }
          : {
              title: `${formatKg(totals.kg_rescued)} kg rescued ${phrase}`,
              text: "Thank you for helping local food reach local tables.",
            }

  const ranking = (title: string, rows: { name: string; value: string; share: number }[], empty: string) => (
    <div className="ranking">
      <p className="eyebrow">{title}</p>
      {rows.length ? (
        <ol>
          {rows.map((row) => (
            <li key={row.name}>
              <div>
                <span title={row.name}>{row.name}</span>
                <strong>{row.value}</strong>
              </div>
              <div className="impact-track">
                <i style={{ width: `${Math.max(4, row.share)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ranking-empty">{empty}</p>
      )}
    </div>
  )

  const share = (value: number, rows: { kg?: number; pickups?: number }[]) => {
    const top = Math.max(...rows.map((row) => row.kg ?? row.pickups ?? 0), 0)
    return top ? (value / top) * 100 : 0
  }

  return (
    <AppShell go={go} active="reports" title="Reports" live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Insights</p>
            <h1>Reports</h1>
            <p>How much food the network has rescued over time.</p>
          </div>
          <button
            type="button"
            className="secondary-action"
            onClick={() => window.print()}
          >
            <Icon name="chart" size={15} /> Export report
          </button>
        </section>

        <div className="report-period">
          <span>
            Reporting period
            {data
              ? ` · ${new Date(`${data.start}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: period === "12m" ? "numeric" : undefined })} – ${new Date(`${data.end}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : ""}
          </span>
          <div className="range-picker">
            {REPORT_PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={period === option.value ? "selected" : ""}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="load-error" role="alert">
            <span>{error}</span>
            <button type="button" className="quiet-action" onClick={load}>
              Try again
            </button>
          </div>
        )}

        <PageMetrics
          items={[
            {
              label: "Food rescued",
              value: totals ? `${formatKg(totals.kg_rescued)} kg` : "…",
              detail: totals ? changeText : "",
              icon: "leaf",
              tone: "lime",
            },
            {
              label: "Successful donations",
              value: totals ? String(totals.delivered_donations) : "…",
              detail:
                totals?.matched_percent !== null && totals?.matched_percent !== undefined
                  ? `${totals.matched_percent}% of posted donations matched`
                  : "No donations posted yet",
              icon: "gift",
              tone: "mint",
            },
            {
              label: "Partners",
              value: totals ? String(totals.partner_farms + totals.partner_recipients) : "…",
              detail: totals ? `${totals.partner_farms} farms · ${totals.partner_recipients} recipients` : "",
              icon: "users",
              tone: "cream",
            },
            {
              label: "Estimated meals",
              value: totals ? totals.estimated_meals.toLocaleString("en-US") : "…",
              detail: totals ? `At about ${totals.kg_per_meal} kg per meal` : "",
              icon: "home",
              tone: "lime",
            },
          ]}
        />

        <section className="reports-grid">
          <article className="panel report-chart">
            <div className="records-heading">
              <div>
                <p className="eyebrow">Rescue volume</p>
                <h2>Food rescued over time</h2>
              </div>
              <span className="chart-legend">
                <i /> Kilograms {period === "12m" ? "per month" : "per day"}
              </span>
            </div>
            <div className="report-chart-area">
              <div className="chart-y-labels">
                {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
                  <span key={fraction}>{fraction ? `${formatKg(scale * fraction)} kg` : "0"}</span>
                ))}
              </div>
              <div className={`report-bars ${data && data.series.length > 12 ? "dense" : ""}`}>
                {data?.series.map((point, index) => (
                  <div className="report-bar-column" key={point.key}>
                    <span
                      className={point.kg ? "" : "empty"}
                      style={{ height: `${point.kg ? Math.max(3, (point.kg / scale) * 100) : 0}%` }}
                      title={`${point.label}: ${formatKg(point.kg)} kg`}
                    />
                    <small>{index % labelEvery === 0 || index === data.series.length - 1 ? point.label : ""}</small>
                  </div>
                ))}
              </div>
            </div>
            {!data && !error && <p className="chart-empty">Loading…</p>}
          </article>

          <article className="panel impact-card">
            <div className="records-heading">
              <div>
                <p className="eyebrow">Community impact</p>
                <h2>Where it went</h2>
              </div>
            </div>
            <div className="impact-breakdown">
              {data?.where_it_went.map((row, index) => (
                <div key={row.name} className="impact-entry">
                  <div>
                    <span className={`impact-dot ${IMPACT_DOTS[index % IMPACT_DOTS.length]}`} />
                    <span>{row.name}</span>
                    <strong title={`${formatKg(row.kg)} kg`}>{row.percent}%</strong>
                  </div>
                  <div className="impact-track">
                    <i style={{ width: `${row.percent}%`, background: IMPACT_COLORS[index % IMPACT_COLORS.length] }} />
                  </div>
                </div>
              ))}
              {data && data.where_it_went.length === 0 && (
                <p className="ranking-empty">No deliveries {phrase} yet.</p>
              )}
            </div>
            <div className="impact-foot">
              <Icon name="leaf" size={17} />
              <span>
                <strong>{totals ? `${formatKg(totals.kg_rescued)} kg` : "…"}</strong> kept out of landfill {phrase}
              </span>
            </div>
          </article>
        </section>

        <section className="panel report-rankings">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Top contributors</p>
              <h2>Who made it happen</h2>
            </div>
          </div>
          <div className="ranking-grid">
            {ranking(
              "Farms · kg donated",
              (data?.top_farms ?? []).map((row) => ({ name: row.name, value: `${formatKg(row.kg)} kg`, share: share(row.kg, data?.top_farms ?? []) })),
              "No deliveries yet.",
            )}
            {ranking(
              "Produce · kg rescued",
              (data?.top_produce ?? []).map((row) => ({ name: row.name, value: `${formatKg(row.kg)} kg`, share: share(row.kg, data?.top_produce ?? []) })),
              "No deliveries yet.",
            )}
            {ranking(
              "Recipients · kg received",
              (data?.top_recipients ?? []).map((row) => ({ name: row.name, value: `${formatKg(row.kg)} kg`, share: share(row.kg, data?.top_recipients ?? []) })),
              "No deliveries yet.",
            )}
            {ranking(
              "Partner NGOs · kg received",
              (data?.top_partner_ngos ?? []).map((row) => ({
                name: row.name,
                value: `${formatKg(row.kg)} kg`,
                share: share(row.kg, data?.top_partner_ngos ?? []),
              })),
              "No deliveries to partner NGOs yet.",
            )}
          </div>
        </section>

        {note && (
          <section className="panel report-note">
            <span className="queue-icon">
              <Icon name="chart" />
            </span>
            <div>
              <strong>{note.title}</strong>
              <p>{note.text}</p>
            </div>
            <button type="button" onClick={() => go("donations")}>
              View donations <Icon name="arrow" size={15} />
            </button>
          </section>
        )}
      </main>
    </AppShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Farmer screens
// ────────────────────────────────────────────────────────────────────────────

const FARMER_STATUS_COPY: Record<Exclude<FarmStatus, "approved">, { eyebrow: string; title: string; text: string }> = {
  pending: {
    eyebrow: "Application received",
    title: "Your account is pending review.",
    text: "A coordinator will verify your details (by phone or your cooperative / barangay list). Once approved, you can post surplus harvest here.",
  },
  rejected: {
    eyebrow: "Application not approved",
    title: "Your application wasn't approved.",
    text: "If you think this is a mistake, contact your coordinator. They can review your account again.",
  },
  suspended: {
    eyebrow: "Account suspended",
    title: "Your account is suspended.",
    text: "You can't post donations right now. Please contact your coordinator for help.",
  },
}

// ── Farmer status (pending / rejected / suspended) ────────────────────────────
function FarmerStatusScreen({ go }: { go: (s: Screen) => void }) {
  const { account, setAccount } = useSession()
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState("")
  const farm = account?.farmer
  const status = farm && farm.status !== "approved" ? farm.status : "pending"
  const copy = FARMER_STATUS_COPY[status]

  const checkAgain = async () => {
    setChecking(true)
    setNote("")
    try {
      const latest = await loadAccount()
      setAccount(latest)
      if (latest.farmer?.status === "approved") go("farmer-dashboard")
      else setNote("No change yet. We'll let you in as soon as you're approved.")
    } catch (err) {
      setNote(errorText(err))
    } finally {
      setChecking(false)
    }
  }

  // Check in the background so the farmer is let in as soon as they're approved
  const quietCheck = useCallback(() => {
    loadAccount()
      .then((latest) => {
        if (latest.farmer?.status !== account?.farmer?.status) setAccount(latest)
        if (latest.farmer?.status === "approved") go("farmer-dashboard")
      })
      .catch(() => null)
  }, [account])
  useAutoRefresh(quietCheck, 20)

  const leave = async () => {
    await signOut()
    setAccount(null)
    go("signin")
  }

  return (
    <AuthLayout go={go}>
      <section className="signup-success farmer-status-card" role="status">
        <span className="signup-success-icon">
          <Icon name={status === "pending" ? "clock" : "shield"} size={24} />
        </span>
        <p className="auth-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
        {farm ? (
          <dl className="status-facts">
            <div>
              <dt>Farm</dt>
              <dd>{farm.farm_name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{FARM_STATUS[farm.status].label}</dd>
            </div>
            <div>
              <dt>Applied</dt>
              <dd>{formatJoined(farm.created_at)}</dd>
            </div>
          </dl>
        ) : (
          <p className="auth-feedback">
            We couldn't find a farm on this account. Please contact your coordinator.
          </p>
        )}
        <div className="status-actions">
          <button type="button" className="auth-submit" onClick={checkAgain} disabled={checking}>
            {checking ? "Checking..." : "Check status again"}
          </button>
          <button type="button" className="outline-action" onClick={leave}>
            Log out
          </button>
        </div>
        {note && (
          <p className="auth-feedback" role="status">
            {note}
          </p>
        )}
      </section>
    </AuthLayout>
  )
}

// ── Farmer portal: shared bits ────────────────────────────────────────────────
type Crop = { id: string; name: string; shelf_life_days: number }
type Condition = "fresh" | "good" | "fair"
type Logistics = "pickup" | "deliver"

type FarmerDonation = {
  id: string
  crop_id: string | null
  produce: string
  quantity: number | string | null
  unit: string
  quantity_kg: number | string
  status: DonationStatus
  harvested_at: string | null
  shelf_life_days: number | null
  farmer_shelf_life_days: number | null
  expires_at: string | null
  condition: Condition | null
  logistics: Logistics
  use_saved_location: boolean
  pickup_address: string | null
  notes: string | null
  rejection_reason: string | null
  created_at: string
  matched_at: string | null
  delivered_at: string | null
  rejected_at: string | null
  expired_at: string | null
  recipient: { name: string } | null
  pickups: {
    id: string
    scheduled_at: string
    status: string
  }[]
}

type FarmerDashboardData = {
  farm: Farm
  stats: {
    active_donations: number
    delivered_donations: number
    kg_rescued: number
    total_donations: number
    next_pickup_at: string | null
  }
  donations: FarmerDonation[]
}

const CONDITIONS: Record<Condition, string> = {
  fresh: "Fresh",
  good: "Good (minor blemishes)",
  fair: "Fair (use soon)",
}
const CONDITION_SHORT: Record<Condition, string> = { fresh: "Fresh", good: "Good", fair: "Fair" }

// Which donation the farmer opened (to edit, or to show after posting)
const portal = { editId: null as string | null, selectId: null as string | null }

// The farmer's view of a donation's status
type Stage = "Posted" | "Matched" | "Received" | "Rejected" | "Expired" | "Cancelled"
function stageOf(donation: FarmerDonation): Stage {
  switch (donation.status) {
    case "new":
      return "Posted"
    case "matched":
    case "pickup_scheduled":
      return "Matched"
    case "delivered":
      return "Received"
    case "rejected":
      return "Rejected"
    case "expired":
      return "Expired"
    default:
      return "Cancelled"
  }
}

function StagePill({ stage }: { stage: Stage }) {
  return <span className={`stage-pill stage-${stage.toLowerCase()}`}>{stage}</span>
}

// Whole days between two calendar dates (local time)
function daysBetween(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

const toLocalDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00`)
const shortDate = (iso: string | null) =>
  iso ? toLocalDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"
const todayValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function daysText(days: number) {
  if (days < 0) return "Already past"
  if (days === 0) return "Last day today"
  return `${days} ${days === 1 ? "day" : "days"}`
}

function quantityText(donation: FarmerDonation) {
  return `${formatKg(donation.quantity_kg)} kg`
}

// ── Home ──────────────────────────────────────────────────────────────────────
function FarmerDashboardScreen({ go }: { go: (s: Screen) => void }) {
  const { account, setAccount } = useSession()
  const [data, setData] = useState<FarmerDashboardData | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    setError("")
    api
      .get<FarmerDashboardData>("/farmer/dashboard")
      .then((result) => {
        setData(result)
        // A coordinator may have changed this farm's status since login
        if (account && result.farm.status !== account.farmer?.status) {
          setAccount({ ...account, farmer: result.farm })
          if (result.farm.status !== "approved") go("farmer-status")
        }
      })
      .catch((err) => setError(errorText(err)))
  }, [account])

  useEffect(load, [])
  useAutoRefresh(load)

  const stats = data?.stats
  const recent = (data?.donations ?? []).slice(0, 5)
  const firstName = account?.profile.first_name

  const open = (donation: FarmerDonation) => {
    portal.selectId = donation.id
    go("farmer-donations")
  }

  return (
    <AppShell go={go} active="farmer-dashboard" title="Home" nav={FARMER_NAV} live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{data?.farm.farm_name ?? account?.farmer?.farm_name ?? "My farm"}</p>
            <h1>Home</h1>
            <p>
              {greeting()}
              {firstName ? `, ${firstName}` : ""}. Post surplus harvest and follow where it goes.
            </p>
          </div>
          <button type="button" className="primary-action" onClick={() => {
            portal.editId = null
            go("farmer-log")
          }}>
            + Log surplus crop
          </button>
        </section>

        {error && (
          <div className="load-error" role="alert">
            <span>{error}</span>
            <button type="button" className="quiet-action" onClick={load}>
              Try again
            </button>
          </div>
        )}

        <PageMetrics
          items={[
            {
              label: "Active donations",
              value: stats ? String(stats.active_donations) : "…",
              detail: "Posted or matched",
              icon: "gift",
              tone: "lime",
            },
            {
              label: "Next pickup",
              value: stats?.next_pickup_at ? formatTime(stats.next_pickup_at) : stats ? "—" : "…",
              detail: stats?.next_pickup_at ? formatDateTime(stats.next_pickup_at).split(",")[0] : "Nothing scheduled",
              icon: "truck",
              tone: "mint",
            },
            {
              label: "Received",
              value: stats ? String(stats.delivered_donations) : "…",
              detail: `Out of ${stats?.total_donations ?? "…"} posted`,
              icon: "home",
              tone: "cream",
            },
            {
              label: "Food rescued",
              value: stats ? `${formatKg(stats.kg_rescued)} kg` : "…",
              detail: "Reached a recipient",
              icon: "leaf",
              tone: "lime",
            },
          ]}
        />

        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Latest</p>
              <h2>
                Recent donations <span>{data?.donations.length ?? 0}</span>
              </h2>
            </div>
            <button type="button" className="quiet-action" onClick={() => go("farmer-donations")}>
              See all <Icon name="arrow" size={13} />
            </button>
          </div>
          <div className="table-scroll">
            <div className="record-table farmer-home-table">
              <div className="record-table-head">
                <span>Crop</span>
                <span>Qty</span>
                <span>Recipient</span>
                <span>Status</span>
                <span></span>
              </div>
              {recent.map((donation) => (
                <div className="record-row" key={donation.id}>
                  <div className="record-primary">
                    <span className="produce-dot">
                      <Icon name="leaf" size={15} />
                    </span>
                    <div>
                      <strong>{donation.produce}</strong>
                      <small>Posted {formatDateTime(donation.created_at)}</small>
                    </div>
                  </div>
                  <span>{quantityText(donation)}</span>
                  <span>{donation.recipient?.name ?? "—"}</span>
                  <StagePill stage={stageOf(donation)} />
                  <button type="button" className="row-action" onClick={() => open(donation)}>
                    View
                  </button>
                </div>
              ))}
              {data && recent.length === 0 && (
                <p className="empty-state">
                  You haven't posted anything yet. Click “+ Log surplus crop” to post your first donation.
                </p>
              )}
              {!data && !error && <p className="empty-state">Loading…</p>}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

// ── Log surplus crop (also used to edit a Posted donation) ────────────────────
function FarmerLogScreen({ go }: { go: (s: Screen) => void }) {
  const { account } = useSession()
  const editId = portal.editId
  const [crops, setCrops] = useState<Crop[] | null>(null)
  const [farm, setFarm] = useState<Farm | null>(account?.farmer ?? null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  // form
  const [cropId, setCropId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [harvestDate, setHarvestDate] = useState(todayValue())
  const [farmerShelfLifeDays, setFarmerShelfLifeDays] = useState("")
  const [condition, setCondition] = useState<Condition>("fresh")
  const [useSaved, setUseSaved] = useState(true)
  const [pickupAddress, setPickupAddress] = useState("")
  const [logistics, setLogistics] = useState<Logistics>(account?.farmer?.usual_logistics ?? "pickup")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    // Ignore a load that finishes after this form was closed or reloaded,
    // so it can never overwrite what the farmer has already typed.
    let cancelled = false
    Promise.all([
      api.get<Crop[]>("/farmer/crops"),
      api.get<{ farm: Farm }>("/farmer/profile"),
      editId ? api.get<FarmerDonation>(`/farmer/donations/${editId}`) : Promise.resolve(null),
    ])
      .then(([cropRows, profile, donation]) => {
        if (cancelled) return
        setCrops(cropRows)
        setFarm(profile.farm)
        if (donation) {
          if (donation.status !== "new") {
            setError("This donation is no longer Posted, so it can't be edited.")
          }
          setCropId(donation.crop_id ?? cropRows.find((c) => c.name === donation.produce)?.id ?? cropRows[0]?.id ?? "")
          setQuantity(String(Number(donation.quantity_kg)))
          setHarvestDate(donation.harvested_at ?? todayValue())
          setFarmerShelfLifeDays(donation.farmer_shelf_life_days?.toString() ?? "")
          setCondition(donation.condition ?? "fresh")
          setUseSaved(donation.use_saved_location)
          setPickupAddress(donation.use_saved_location ? "" : donation.pickup_address ?? "")
          setLogistics(donation.logistics)
          setNotes(donation.notes ?? "")
        } else {
          setCropId((current) => current || cropRows[0]?.id || "")
          setFarmerShelfLifeDays("")
          setLogistics(profile.farm.usual_logistics ?? "pickup")
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err))
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  const crop = crops?.find((c) => c.id === cropId)
  const remaining = crop && harvestDate ? crop.shelf_life_days - daysBetween(toLocalDate(harvestDate), new Date()) : null

  const leave = () => {
    portal.editId = null
    go(editId ? "farmer-donations" : "farmer-dashboard")
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (remaining !== null && remaining < 0) {
      setError(`This ${crop?.name.toLowerCase()} is already past its ${crop?.shelf_life_days}-day shelf life, so it can't be posted.`)
      return
    }
    setSaving(true)
    setError("")
    const body = {
      crop_id: cropId,
      quantity: Number(quantity),
      unit: "kg",
      harvested_at: harvestDate,
      farmer_shelf_life_days: Number(farmerShelfLifeDays),
      condition,
      logistics,
      use_saved_location: useSaved,
      pickup_address: useSaved ? null : pickupAddress.trim(),
      notes: notes.trim() || null,
    }
    try {
      const saved = editId
        ? await api.patch<FarmerDonation>(`/farmer/donations/${editId}`, body)
        : await api.post<FarmerDonation>("/farmer/donations", body)
      portal.editId = null
      portal.selectId = saved.id
      go("farmer-donations")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell go={go} active="farmer-log" title="Log surplus" nav={FARMER_NAV} live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{editId ? "Edit donation" : "Log surplus"}</p>
            <h1>{editId ? "Edit surplus crop" : "Log surplus crop"}</h1>
            <p>Post excess harvest so the coordinator can match it to a recipient.</p>
          </div>
        </section>

        <div className="log-layout">
          <form className="panel log-form" onSubmit={submit}>
            <div className="log-grid">
              <label className="log-field">
                <span>Crop type</span>
                <select required value={cropId} onChange={(event) => { setCropId(event.target.value); setError("") }}>
                  {!crops && <option value="">Loading crops…</option>}
                  {crops?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <small>
                  List comes from the crop shelf-life table. Typical shelf life:{" "}
                  <strong>{crop ? daysText(crop.shelf_life_days) : "—"}</strong>
                </small>
              </label>

              <div className="log-field">
                <span id="qty-label">Estimated quantity (kg)</span>
                <div className="qty-row">
                  <input
                    required
                    aria-labelledby="qty-label"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                  <span className="qty-unit">kg</span>
                </div>
              </div>

              <label className="log-field">
                <span>Harvest date</span>
                <input
                  required
                  type="date"
                  max={todayValue()}
                  value={harvestDate}
                  onChange={(event) => { setHarvestDate(event.target.value); setError("") }}
                />
              </label>

              <label className="log-field">
                <span>Your shelf life (days)</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={farmerShelfLifeDays}
                  onChange={(event) => setFarmerShelfLifeDays(event.target.value)}
                  placeholder="Enter shelf life in days"
                />
                <small>Enter the shelf life for this harvest. Remaining life is calculated from the crop's typical shelf life and harvest date.</small>
              </label>

              <label className="log-field">
                <span>Condition</span>
                <select value={condition} onChange={(event) => setCondition(event.target.value as Condition)}>
                  {Object.entries(CONDITIONS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="log-section">
              <legend>Farm location</legend>
              <div className="radio-row">
                <label>
                  <input type="radio" name="location" checked={useSaved} onChange={() => setUseSaved(true)} />
                  Use my saved farm location
                </label>
                <label>
                  <input type="radio" name="location" checked={!useSaved} onChange={() => setUseSaved(false)} />
                  Different pickup point
                </label>
              </div>
              {useSaved ? (
                <div className="address-box">
                  <Icon name="home" size={16} />
                  {farm?.location ? (
                    <span>{farm.location}</span>
                  ) : (
                    <span className="address-missing">
                      No saved farm address yet.{" "}
                      <button type="button" className="text-link" onClick={() => go("farmer-profile")}>
                        Add it in Farm profile
                      </button>{" "}
                      or choose a different pickup point.
                    </span>
                  )}
                </div>
              ) : (
                <label className="log-field">
                  <span className="sr-only">Pickup address</span>
                  <input
                    required
                    value={pickupAddress}
                    onChange={(event) => setPickupAddress(event.target.value)}
                    placeholder="Street, barangay, municipality / city"
                  />
                </label>
              )}
            </fieldset>

            <fieldset className="log-section">
              <legend>How will the crop get to the recipient?</legend>
              <div className="choice-cards">
                <label className={`choice-card ${logistics === "pickup" ? "selected" : ""}`}>
                  <input type="radio" name="logistics" checked={logistics === "pickup"} onChange={() => setLogistics("pickup")} />
                  <span>
                    <strong>I need pickup</strong>
                    The recipient collects it
                  </span>
                </label>
                <label className={`choice-card ${logistics === "deliver" ? "selected" : ""}`}>
                  <input type="radio" name="logistics" checked={logistics === "deliver"} onChange={() => setLogistics("deliver")} />
                  <span>
                    <strong>I can deliver</strong>I bring it to the matched recipient
                  </span>
                </label>
              </div>
            </fieldset>

            <label className="log-field log-section">
              <span>Notes (optional)</span>
              <textarea
                rows={3}
                maxLength={500}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. best time to pick up, packaging"
              />
            </label>

            {error && (
              <p className="form-message error" role="alert">
                {error}
              </p>
            )}

            <div className="log-actions">
              <button type="button" className="outline-action" onClick={leave}>
                Cancel
              </button>
              <button type="submit" className="primary-action" disabled={saving || !crops}>
                {saving ? "Saving..." : editId ? "Save changes" : "Post donation"}
              </button>
            </div>
          </form>

          <aside className="panel before-post">
            <h2>Before you post</h2>
            <dl>
              <div>
                <dt>Crop</dt>
                <dd>{crop?.name ?? "—"}</dd>
              </div>
              <div>
                <dt>Farmer-entered shelf life</dt>
                <dd>{farmerShelfLifeDays ? daysText(Number(farmerShelfLifeDays)) : "—"}</dd>
              </div>
              <div>
                <dt>Typical shelf life</dt>
                <dd>{crop ? daysText(crop.shelf_life_days) : "—"}</dd>
              </div>
              <div>
                <dt>Calculated remaining shelf life</dt>
                <dd className={remaining !== null && remaining < 0 ? "warn" : ""}>
                  {remaining === null ? "—" : daysText(remaining)}
                </dd>
              </div>
              <div>
                <dt>Status after posting</dt>
                <dd>Posted</dd>
              </div>
            </dl>
            <p>
              Remaining shelf life and expiry use the crop&apos;s typical shelf life and harvest date. If no recipient
              is matched before it runs out, the donation is marked Expired.
            </p>
          </aside>
        </div>
      </main>
    </AppShell>
  )
}

// ── My donations ──────────────────────────────────────────────────────────────
const STAGE_FILTERS: ("All" | Stage)[] = ["All", "Posted", "Matched", "Received", "Rejected", "Expired"]

function FarmerDonationsScreen({ go }: { go: (s: Screen) => void }) {
  const [donations, setDonations] = useState<FarmerDonation[] | null>(null)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<"All" | Stage>("All")
  const [selectedId, setSelectedId] = useState<string | null>(portal.selectId)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setError("")
    api
      .get<FarmerDashboardData>("/farmer/dashboard")
      .then((result) => setDonations(result.donations))
      .catch((err) => setError(errorText(err)))
  }, [])

  useEffect(load, [load])
  useAutoRefresh(load)
  useEffect(() => {
    portal.selectId = null
  }, [])

  const all = donations ?? []
  const count = (stage: "All" | Stage) => (stage === "All" ? all.length : all.filter((d) => stageOf(d) === stage).length)
  const visible = filter === "All" ? all : all.filter((d) => stageOf(d) === filter)
  const selected = visible.find((d) => d.id === selectedId) ?? visible[0] ?? null
  const stage = selected ? stageOf(selected) : null
  const canChange = stage === "Posted"

  const edit = () => {
    if (!selected) return
    portal.editId = selected.id
    go("farmer-log")
  }

  const remove = async () => {
    if (!selected || !window.confirm(`Delete your ${selected.produce} donation? This can't be undone.`)) return
    setDeleting(true)
    try {
      await api.delete(`/farmer/donations/${selected.id}`)
      setSelectedId(null)
      load()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setDeleting(false)
    }
  }

  const pickup = selected?.pickups.find((p) => p.status === "scheduled" || p.status === "in_progress")
  const finalStep =
    stage === "Received"
      ? { label: "Received", at: selected?.delivered_at }
      : stage === "Rejected"
        ? { label: "Rejected", at: selected?.rejected_at }
        : stage === "Expired"
          ? { label: "Expired", at: selected?.expired_at }
          : stage === "Cancelled"
            ? { label: "Cancelled by coordinator", at: null }
            : null

  return (
    <AppShell go={go} active="farmer-donations" title="My donations" nav={FARMER_NAV} live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Your harvest</p>
            <h1>My donations</h1>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              portal.editId = null
              go("farmer-log")
            }}
          >
            + Log surplus crop
          </button>
        </section>

        <div className="stage-filters" role="group" aria-label="Filter donations">
          {STAGE_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={filter === option ? "selected" : ""}
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
            >
              {option} ({count(option)})
            </button>
          ))}
        </div>

        {error && (
          <div className="load-error" role="alert">
            <span>{error}</span>
            <button type="button" className="quiet-action" onClick={load}>
              Try again
            </button>
          </div>
        )}

        <div className="donations-layout">
          <section className="panel records-panel my-donations">
            <div className="table-scroll">
              <div className="record-table my-donations-table" role="table">
                <div className="record-table-head" role="row">
                  <span>Crop</span>
                  <span>Qty</span>
                  <span>Harvested</span>
                  <span>Logistics</span>
                  <span>Recipient</span>
                  <span>Status</span>
                </div>
                {visible.map((donation) => (
                  <button
                    type="button"
                    role="row"
                    className={`record-row ${selected?.id === donation.id ? "selected" : ""}`}
                    key={donation.id}
                    onClick={() => setSelectedId(donation.id)}
                  >
                    <strong>{donation.produce}</strong>
                    <span>{quantityText(donation)}</span>
                    <span>{shortDate(donation.harvested_at)}</span>
                    <span>{donation.logistics === "deliver" ? "Deliver" : "Pickup"}</span>
                    <span>{donation.recipient?.name ?? "—"}</span>
                    <StagePill stage={stageOf(donation)} />
                  </button>
                ))}
                {donations && visible.length === 0 && (
                  <p className="empty-state">
                    {all.length ? `No ${filter.toLowerCase()} donations.` : "You haven't posted anything yet."}
                  </p>
                )}
                {!donations && !error && <p className="empty-state">Loading…</p>}
              </div>
            </div>
          </section>

          {selected && stage && (
            <aside className="panel donation-detail" aria-label="Donation details">
              <div className="detail-title">
                <h2>
                  {selected.produce} · {quantityText(selected)}
                </h2>
                <StagePill stage={stage} />
              </div>
              <dl>
                <div>
                  <dt>Harvest date</dt>
                  <dd>{shortDate(selected.harvested_at)}</dd>
                </div>
                <div>
                  <dt>Farmer-entered shelf life</dt>
                  <dd>{selected.farmer_shelf_life_days ? daysText(selected.farmer_shelf_life_days) : "—"}</dd>
                </div>
                <div>
                  <dt>Condition</dt>
                  <dd>{selected.condition ? CONDITION_SHORT[selected.condition] : "—"}</dd>
                </div>
                <div>
                  <dt>Logistics</dt>
                  <dd>{selected.logistics === "deliver" ? "I deliver" : "Needs pickup"}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd title={selected.pickup_address ?? ""}>
                    {selected.use_saved_location ? "Saved farm location" : selected.pickup_address || "Different pickup point"}
                  </dd>
                </div>
                <div>
                  <dt>Recipient</dt>
                  <dd>{selected.recipient?.name ?? "—"}</dd>
                </div>
                {pickup && (
                  <div>
                    <dt>Pickup</dt>
                    <dd>{formatDateTime(pickup.scheduled_at)}</dd>
                  </div>
                )}
                <div>
                  <dt>Notes</dt>
                  <dd>{selected.notes || "—"}</dd>
                </div>
              </dl>

              <h3 className="history-title">Status history</h3>
              <ol className="status-history">
                <li className="done">
                  <strong>Posted</strong>
                  <span>{formatDateTime(selected.created_at)}</span>
                </li>
                <li className={selected.matched_at ? "done" : ""}>
                  <strong>Matched to a recipient</strong>
                  {selected.matched_at && (
                    <span>
                      {formatDateTime(selected.matched_at)}
                      {selected.recipient ? ` · ${selected.recipient.name}` : ""}
                    </span>
                  )}
                </li>
                <li className={finalStep ? "done" : ""}>
                  <strong>{finalStep?.label ?? "Received / Rejected / Expired"}</strong>
                  {finalStep?.at && <span>{formatDateTime(finalStep.at)}</span>}
                </li>
              </ol>

              <div className="detail-actions">
                <button type="button" className="outline-action" disabled={!canChange} onClick={edit}>
                  Edit
                </button>
                <button type="button" className="outline-action danger-outline" disabled={!canChange || deleting} onClick={remove}>
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
              <p className="detail-note">Edit and delete are only available while the donation is Posted.</p>

              {stage === "Rejected" && (
                <div className="rejection-box">
                  <strong>Reason from the recipient:</strong> {selected.rejection_reason || "No reason given."}
                </div>
              )}
            </aside>
          )}
        </div>
      </main>
    </AppShell>
  )
}

// ── Farm profile ──────────────────────────────────────────────────────────────
type ProfileForm = {
  contact_name: string
  phone: string
  email: string
  cooperative: string
  farm_name: string
  location: string
  usual_logistics: Logistics
}

function FarmerProfileScreen({ go }: { go: (s: Screen) => void }) {
  const { account, setAccount } = useSession()
  const [saved, setSaved] = useState<ProfileForm | null>(null)
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [farm, setFarm] = useState<Farm | null>(account?.farmer ?? null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null)

  const fill = (result: { farm: Farm; email: string }) => {
    const values: ProfileForm = {
      contact_name: result.farm.contact_name ?? "",
      phone: result.farm.phone ?? "",
      email: result.email ?? result.farm.email ?? "",
      cooperative: result.farm.cooperative ?? "",
      farm_name: result.farm.farm_name,
      location: result.farm.location ?? "",
      usual_logistics: result.farm.usual_logistics ?? "pickup",
    }
    setFarm(result.farm)
    setSaved(values)
    setForm(values)
  }

  useEffect(() => {
    let cancelled = false
    api
      .get<{ farm: Farm; email: string }>("/farmer/profile")
      .then((result) => {
        if (!cancelled) fill(result)
      })
      .catch((err) => {
        if (!cancelled) setMessage({ kind: "error", text: errorText(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const field = (name: keyof ProfileForm) => ({
    value: form?.[name] ?? "",
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => (current ? { ...current, [name]: event.target.value } : current)),
  })

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    if (password && password !== confirm) {
      setMessage({ kind: "error", text: "The two new passwords don't match." })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const result = await api.patch<{ farm: Farm; email: string; message: string }>("/farmer/profile", {
        ...form,
        cooperative: form.cooperative.trim() || null,
        new_password: password || null,
      })
      fill(result)
      setPassword("")
      setConfirm("")
      setMessage({ kind: "success", text: result.message })
      const latest = await loadAccount().catch(() => null)
      if (latest) setAccount(latest)
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setForm(saved)
    setPassword("")
    setConfirm("")
    setMessage(null)
  }

  const status = farm?.status ?? account?.farmer?.status

  return (
    <AppShell go={go} active="farmer-profile" title="Farm profile" nav={FARMER_NAV} live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">My farm</p>
            <h1>Farm profile</h1>
          </div>
          <span className="account-status">
            Account {status && <span className={`stage-pill stage-${status}`}>{status}</span>}
          </span>
        </section>

        <form className="panel profile-form" onSubmit={save} aria-busy={!form}>
          {/* fields stay locked until the saved details have loaded */}
          <fieldset className="profile-fields" disabled={!form || saving}>
          <h2 className="profile-section">Contact</h2>
          <div className="profile-grid three">
            <label className="log-field">
              <span>Full name</span>
              <input required autoComplete="name" {...field("contact_name")} />
            </label>
            <label className="log-field">
              <span>Mobile number</span>
              <input required minLength={7} type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" {...field("phone")} />
            </label>
            <label className="log-field">
              <span>Email</span>
              <input required type="email" autoComplete="email" {...field("email")} />
            </label>
            <label className="log-field">
              <span>Cooperative / association</span>
              <input placeholder="Optional" {...field("cooperative")} />
            </label>
          </div>

          <h2 className="profile-section">Farm</h2>
          <div className="profile-grid two">
            <label className="log-field">
              <span>Farm name</span>
              <input required {...field("farm_name")} />
            </label>
            <label className="log-field">
              <span>Barangay, municipality / city</span>
              <input required autoComplete="street-address" placeholder="e.g. Brgy. San Jose, Tarlac City" {...field("location")} />
              <small>Used as the saved farm location on new donations.</small>
            </label>
            <label className="log-field">
              <span>Usual logistics</span>
              <select {...field("usual_logistics")}>
                <option value="pickup">I usually need pickup</option>
                <option value="deliver">I can usually deliver</option>
              </select>
            </label>
          </div>

          <h2 className="profile-section">Security</h2>
          <div className="profile-grid two">
            <label className="log-field">
              <span>New password</span>
              <input
                type="password"
                minLength={6}
                autoComplete="new-password"
                placeholder="Leave blank to keep your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="log-field">
              <span>Confirm new password</span>
              <input
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          </div>

          </fieldset>

          {message && (
            <p className={`form-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}

          <div className="log-actions">
            <button type="button" className="outline-action" onClick={cancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-action" disabled={saving || !form}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </main>
    </AppShell>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────────────────────────────
export default function App() {
  // A password-reset link opens the reset page; everything else starts at the splash
  const [screen, setScreen] = useState<Screen>(RECOVERY ? "reset-password" : "splash")
  const [account, setAccount] = useState<Account | null>(null)
  const [pendingFarmers, setPendingFarmers] = useState<number | null>(null)

  const go = (next: Screen) => {
    setScreen(next)
    window.scrollTo(0, 0)
  }

  // Keep people on the screens their account is allowed to see
  let current = screen
  if (!PUBLIC_SCREENS.includes(screen)) {
    if (!account) current = "signin"
    else if (account.profile.role === "farmer") {
      if (!FARMER_SCREENS.includes(screen)) current = homeFor(account)
      else if (screen !== "farmer-status" && account.farmer?.status !== "approved") current = "farmer-status"
    } else if (FARMER_SCREENS.includes(screen)) current = "dashboard"
  }

  const screenMap: Record<Screen, ReactNode> = {
    splash: <SplashScreen go={go} />,
    signin: <SignInScreen go={go} />,
    signup: <SignUpScreen go={go} />,
    dashboard: <DashboardScreen go={go} />,
    donations: <DonationsScreen go={go} />,
    pickups: <PickupsScreen go={go} />,
    farmers: <FarmersScreen go={go} />,
    recipients: <RecipientsScreen go={go} />,
    reports: <ReportsScreen go={go} />,
    "farmer-status": <FarmerStatusScreen go={go} />,
    "farmer-dashboard": <FarmerDashboardScreen go={go} />,
    "farmer-log": <FarmerLogScreen key={portal.editId ?? "new"} go={go} />,
    "farmer-donations": <FarmerDonationsScreen go={go} />,
    "farmer-profile": <FarmerProfileScreen go={go} />,
    "reset-password": <ResetPasswordScreen go={go} />,
  }

  return (
    <SessionContext.Provider value={{ account, setAccount, pendingFarmers, setPendingFarmers }}>
      {screenMap[current]}
    </SessionContext.Provider>
  )
}
