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
  | "volunteers"
  | "recipients"
  | "reports"
  | "farmer-status"
  | "farmer-dashboard"

// Screens anyone can open without logging in
const PUBLIC_SCREENS: Screen[] = ["splash", "signin", "signup"]
// Screens for farmer accounts
const FARMER_SCREENS: Screen[] = ["farmer-status", "farmer-dashboard"]

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
  volunteer: "Volunteer · View only",
  farmer: "Farmer",
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
    screen: "volunteers",
    label: "Volunteers",
    icon: "users",
  },
  {
    screen: "recipients",
    label: "Recipients",
    icon: "home",
  },
  {
    screen: "reports",
    label: "Reports",
    icon: "chart",
    group: "Insights",
  },
]

const FARMER_NAV: NavItem[] = [
  {
    screen: "farmer-dashboard",
    label: "My donations",
    icon: "leaf",
    group: "My farm",
  },
]

// ── Sample data ───────────────────────────────────────────────────────────────
const RANGES = ["7 days", "30 days"]

const VOLUME_BARS = [35, 52, 44, 70, 61, 86, 76, 58, 91, 67, 80, 96]

const CHART_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

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
  const { account, setAccount, pendingFarmers } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
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
            <small>Food rescue network</small>
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
        <nav className="side-nav" aria-label="Coordinator navigation">
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
          {profile?.role !== "farmer" && (
            <div className="undo-card">
              <strong>Undo last action</strong>
              <span>Nothing to undo.</span>
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
      setAccount(account)
      go(account ? homeFor(account) : "signin")
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

// ── Sign In Screen ────────────────────────────────────────────────────────────
function SignInScreen({ go }: { go: (s: Screen) => void }) {
  const { setAccount } = useSession()
  const [resetMessage, setResetMessage] = useState("")
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
          <div
            className="login-hero-art"
            aria-label="Illustration of a growing field"
          >
            <div className="hero-sun" />
            <div className="hero-hill hill-back" />
            <div className="hero-hill hill-front" />
            <div className="hero-leaves">
              <i />
              <i />
              <i />
            </div>
            <span>Every harvest has a home.</span>
          </div>
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
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setResetMessage(
                  "Password reset isn't set up yet. Contact your coordinator for help.",
                )
              }
            >
              Forgot password?
            </button>
            {resetMessage && (
              <p className="auth-feedback" role="status">
                {resetMessage}
              </p>
            )}
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
                food bank decides whether to accept produce.
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
      return { label: "Expired", tone: "amber" }
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
  pickups_unassigned: { icon: "clock", className: "amber-bg", screen: "pickups" },
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

// ── Donations Screen ──────────────────────────────────────────────────────────
function DonationsScreen({ go }: { go: (s: Screen) => void }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [showForm, setShowForm] = useState(false)
  const [produce, setProduce] = useState("")
  const [quantity, setQuantity] = useState("")
  const [donations, setDonations] = useState([
    {
      produce: "Peaches",
      farm: "Navarro Family Farm",
      amount: "40 kg",
      recipient: "Hope Kitchen",
      date: "Today, 10:30 AM",
      status: "Pickup today",
      tone: "amber" as ActivityTone,
    },
    {
      produce: "Sweet potatoes",
      farm: "Aquino Highland Greens",
      amount: "28 kg",
      recipient: "Food Bank 1",
      date: "Today, 1:00 PM",
      status: "Matched",
      tone: "green" as ActivityTone,
    },
    {
      produce: "Tomatoes",
      farm: "Santos Organic Farm",
      amount: "16 kg",
      recipient: "City Pantry",
      date: "Oct 29, 9:00 AM",
      status: "New",
      tone: "blue" as ActivityTone,
    },
    {
      produce: "Leafy greens",
      farm: "Riverside Organics",
      amount: "22 kg",
      recipient: "Second Harvest",
      date: "Oct 28, 11:15 AM",
      status: "Delivered",
      tone: "dark" as ActivityTone,
    },
    {
      produce: "Carrots",
      farm: "Navarro Family Farm",
      amount: "35 kg",
      recipient: "—",
      date: "Oct 30, 8:00 AM",
      status: "Available",
      tone: "blue" as ActivityTone,
    },
  ])
  const filters = ["All", "Available", "Matched", "Pickup today", "Delivered"]
  const visibleDonations = donations.filter((donation) => {
    const matchesFilter = filter === "All" || donation.status === filter
    const query = search.toLowerCase()
    const matchesSearch =
      `${donation.produce} ${donation.farm} ${donation.recipient}`
        .toLowerCase()
        .includes(query)
    return matchesFilter && matchesSearch
  })

  const addDonation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!produce.trim() || !quantity.trim()) return
    setDonations((current) => [
      {
        produce: produce.trim(),
        farm: "Carla's Demo Farm",
        amount: `${quantity.trim()} kg`,
        recipient: "—",
        date: "Just now",
        status: "Available",
        tone: "blue",
      },
      ...current,
    ])
    setProduce("")
    setQuantity("")
    setShowForm(false)
    setFilter("All")
    setSearch("")
  }

  return (
    <AppShell go={go} active="donations" title="Donations">
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Food operations</p>
            <h1>Donations</h1>
            <p>Every donation logged by farms in your network.</p>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? "Cancel" : "+ Log donation"}
          </button>
        </section>

        <PageMetrics
          items={[
            {
              label: "Active donations",
              value: String(donations.length),
              detail: "+3 this week",
              icon: "gift",
              tone: "lime",
            },
            {
              label: "Awaiting pickup",
              value: "4",
              detail: "2 due today",
              icon: "clock",
              tone: "cream",
            },
            {
              label: "Matched this month",
              value: "28",
              detail: "Across 12 farms",
              icon: "users",
              tone: "mint",
            },
            {
              label: "Food rescued",
              value: "1,284 kg",
              detail: "This month",
              icon: "leaf",
              tone: "lime",
            },
          ]}
        />

        {showForm && (
          <form className="inline-form" onSubmit={addDonation}>
            <div>
              <p className="eyebrow">Quick entry</p>
              <strong>Log a new donation</strong>
            </div>
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
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="e.g. 25"
              />
            </label>
            <button type="submit" className="primary-action">
              Save donation
            </button>
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
            <div className="record-table donations-table">
              <div className="record-table-head">
                <span>Produce & farm</span>
                <span>Quantity</span>
                <span>Recipient</span>
                <span>Pickup</span>
                <span>Status</span>
              </div>
              {visibleDonations.map((donation) => (
                <div
                  className="record-row"
                  key={`${donation.produce}-${donation.farm}-${donation.date}`}
                >
                  <div className="record-primary">
                    <span className="produce-dot">
                      <Icon name="leaf" size={15} />
                    </span>
                    <div>
                      <strong>{donation.produce}</strong>
                      <small>{donation.farm}</small>
                    </div>
                  </div>
                  <span>{donation.amount}</span>
                  <span>{donation.recipient}</span>
                  <span>{donation.date}</span>
                  <StatusPill label={donation.status} tone={donation.tone} />
                </div>
              ))}
              {visibleDonations.length === 0 && (
                <p className="empty-state">No donations match your search.</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

// ── Pickups Screen ────────────────────────────────────────────────────────────
function PickupsScreen({ go }: { go: (s: Screen) => void }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [assigned, setAssigned] = useState<string[]>([
    "pickup-peaches",
    "pickup-greens",
  ])
  const pickups = [
    {
      id: "pickup-peaches",
      time: "Today · 10:30 AM",
      farm: "Navarro Family Farm",
      goods: "Peaches · 40 kg",
      recipient: "Hope Kitchen",
      volunteer: "Mia Santos",
      status: "Confirmed",
      tone: "green" as ActivityTone,
    },
    {
      id: "pickup-potatoes",
      time: "Today · 1:00 PM",
      farm: "Aquino Highland Greens",
      goods: "Sweet potatoes · 28 kg",
      recipient: "Food Bank 1",
      volunteer: "Unassigned",
      status: "Needs volunteer",
      tone: "amber" as ActivityTone,
    },
    {
      id: "pickup-greens",
      time: "Tomorrow · 9:15 AM",
      farm: "Riverside Organics",
      goods: "Leafy greens · 22 kg",
      recipient: "Second Harvest",
      volunteer: "Leo Cruz",
      status: "Confirmed",
      tone: "green" as ActivityTone,
    },
    {
      id: "pickup-tomatoes",
      time: "Oct 30 · 11:00 AM",
      farm: "Santos Organic Farm",
      goods: "Tomatoes · 16 kg",
      recipient: "City Pantry",
      volunteer: "Unassigned",
      status: "Needs volunteer",
      tone: "amber" as ActivityTone,
    },
  ]
  const filteredPickups = pickups.filter((pickup) => {
    const matchesFilter =
      filter === "All" ||
      (filter === "Needs volunteer"
        ? !assigned.includes(pickup.id)
        : assigned.includes(pickup.id))
    return (
      matchesFilter &&
      `${pickup.farm} ${pickup.goods} ${pickup.recipient} ${pickup.volunteer}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })

  return (
    <AppShell go={go} active="pickups" title="Pickups">
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Food operations</p>
            <h1>Pickups</h1>
            <p>Scheduled pickups and the volunteers assigned to them.</p>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => setFilter("Needs volunteer")}
          >
            + Assign a volunteer
          </button>
        </section>
        <PageMetrics
          items={[
            {
              label: "Scheduled today",
              value: "4",
              detail: "Next pickup at 10:30 AM",
              icon: "truck",
              tone: "mint",
            },
            {
              label: "Need a volunteer",
              value: "2",
              detail: "Assign before noon",
              icon: "users",
              tone: "cream",
            },
            {
              label: "Completed this week",
              value: "18",
              detail: "94% on time",
              icon: "chart",
              tone: "lime",
            },
            {
              label: "Average delivery",
              value: "42 min",
              detail: "Farm to recipient",
              icon: "clock",
              tone: "mint",
            },
          ]}
        />
        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Route coordination</p>
              <h2>
                Pickup schedule <span>{filteredPickups.length}</span>
              </h2>
            </div>
            <span className="date-chip">
              This week <Icon name="arrow" size={13} />
            </span>
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            filters={["All", "Needs volunteer", "Assigned"]}
            activeFilter={filter}
            onFilter={setFilter}
          />
          <div className="table-scroll">
            <div className="record-table pickups-table">
              <div className="record-table-head">
                <span>Pickup</span>
                <span>Donation</span>
                <span>Recipient</span>
                <span>Volunteer</span>
                <span>Status</span>
                <span></span>
              </div>
              {filteredPickups.map((pickup) => {
                const isAssigned = assigned.includes(pickup.id)
                return (
                  <div className="record-row" key={pickup.id}>
                    <div className="record-primary">
                      <span className="date-icon">
                        <Icon name="clock" size={16} />
                      </span>
                      <div>
                        <strong>{pickup.time}</strong>
                        <small>{pickup.farm}</small>
                      </div>
                    </div>
                    <span>{pickup.goods}</span>
                    <span>{pickup.recipient}</span>
                    <span>{isAssigned ? pickup.volunteer : "Unassigned"}</span>
                    <StatusPill
                      label={isAssigned ? "Confirmed" : "Needs volunteer"}
                      tone={isAssigned ? "green" : "amber"}
                    />
                    <button
                      type="button"
                      className="row-action"
                      onClick={() =>
                        setAssigned((current) =>
                          isAssigned
                            ? current.filter((id) => id !== pickup.id)
                            : [...current, pickup.id],
                        )
                      }
                    >
                      {isAssigned ? "Unassign" : "Assign"}
                    </button>
                  </div>
                )
              })}
              {filteredPickups.length === 0 && (
                <p className="empty-state">No pickups match your search.</p>
              )}
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

// ── Volunteers Screen ─────────────────────────────────────────────────────────
function VolunteersScreen({ go }: { go: (s: Screen) => void }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All volunteers")
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [newVolunteerName, setNewVolunteerName] = useState("")
  const [newVolunteerArea, setNewVolunteerArea] = useState("")
  const [selectedVolunteer, setSelectedVolunteer] = useState<{
    name: string
    initials: string
    area: string
    vehicle: string
    shifts: string
    status: string
  } | null>(null)
  const [volunteers, setVolunteers] = useState([
    {
      name: "Mia Santos",
      initials: "MS",
      area: "North District",
      vehicle: "Van · 500 kg",
      shifts: "12 pickups",
      status: "Available",
    },
    {
      name: "Leo Cruz",
      initials: "LC",
      area: "Riverside",
      vehicle: "Pickup · 300 kg",
      shifts: "9 pickups",
      status: "On a pickup",
    },
    {
      name: "Ana Reyes",
      initials: "AR",
      area: "East Valley",
      vehicle: "Car · 80 kg",
      shifts: "7 pickups",
      status: "Available",
    },
    {
      name: "Noah Garcia",
      initials: "NG",
      area: "Highland",
      vehicle: "Van · 450 kg",
      shifts: "4 pickups",
      status: "Off duty",
    },
    {
      name: "Sam Lee",
      initials: "SL",
      area: "South District",
      vehicle: "No vehicle",
      shifts: "3 pickups",
      status: "Available",
    },
  ])
  const addVolunteer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newVolunteerName.trim()
    const area = newVolunteerArea.trim()
    if (!name || !area) return
    setVolunteers((current) => [
      {
        name,
        initials: name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase(),
        area,
        vehicle: "No vehicle",
        shifts: "0 pickups",
        status: "Available",
      },
      ...current,
    ])
    setNewVolunteerName("")
    setNewVolunteerArea("")
    setShowInviteForm(false)
    setFilter("All volunteers")
    setSearch("")
  }
  const filteredVolunteers = volunteers.filter((volunteer) => {
    const matchesFilter =
      filter === "All volunteers" || volunteer.status === filter
    return (
      matchesFilter &&
      `${volunteer.name} ${volunteer.area} ${volunteer.vehicle}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })

  return (
    <AppShell go={go} active="volunteers" title="Volunteers">
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Community</p>
            <h1>Volunteers</h1>
            <p>Drivers and helpers who move food from farms to tables.</p>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => setShowInviteForm((open) => !open)}
          >
            {showInviteForm ? "Cancel" : "+ Invite volunteer"}
          </button>
        </section>
        <PageMetrics
          items={[
            {
              label: "Active volunteers",
              value: "18",
              detail: "Across 6 districts",
              icon: "users",
              tone: "lime",
            },
            {
              label: "Available today",
              value: "7",
              detail: "Ready for assignments",
              icon: "clock",
              tone: "mint",
            },
            {
              label: "Pickups completed",
              value: "142",
              detail: "This month",
              icon: "truck",
              tone: "cream",
            },
            {
              label: "Has a vehicle",
              value: "12",
              detail: "6 vans · 6 cars",
              icon: "home",
              tone: "lime",
            },
          ]}
        />
        {showInviteForm && (
          <form className="inline-form" onSubmit={addVolunteer}>
            <div>
              <p className="eyebrow">New volunteer</p>
              <strong>Add a roster entry</strong>
            </div>
            <label>
              Full name
              <input
                required
                value={newVolunteerName}
                onChange={(event) => setNewVolunteerName(event.target.value)}
                placeholder="e.g. Alex Rivera"
              />
            </label>
            <label>
              Service area
              <input
                required
                value={newVolunteerArea}
                onChange={(event) => setNewVolunteerArea(event.target.value)}
                placeholder="e.g. North District"
              />
            </label>
            <button type="submit" className="primary-action">
              Add volunteer
            </button>
          </form>
        )}
        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">People power</p>
              <h2>
                Volunteer roster <span>{filteredVolunteers.length}</span>
              </h2>
            </div>
            <span className="date-chip">
              <i className="availability-dot" /> 7 available today
            </span>
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            filters={["All volunteers", "Available", "On a pickup", "Off duty"]}
            activeFilter={filter}
            onFilter={setFilter}
          />
          <div className="table-scroll">
            <div className="record-table volunteers-table">
              <div className="record-table-head">
                <span>Volunteer</span>
                <span>Service area</span>
                <span>Vehicle capacity</span>
                <span>Contribution</span>
                <span>Today</span>
                <span></span>
              </div>
              {filteredVolunteers.map((volunteer) => (
                <div className="record-row" key={volunteer.name}>
                  <div className="record-primary">
                    <span className="initial-avatar">{volunteer.initials}</span>
                    <div>
                      <strong>{volunteer.name}</strong>
                      <small>Verified volunteer</small>
                    </div>
                  </div>
                  <span>{volunteer.area}</span>
                  <span>{volunteer.vehicle}</span>
                  <span>{volunteer.shifts}</span>
                  <StatusPill
                    label={volunteer.status}
                    tone={
                      volunteer.status === "Available"
                        ? "green"
                        : volunteer.status === "On a pickup"
                          ? "blue"
                          : "dark"
                    }
                  />
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => setSelectedVolunteer(volunteer)}
                  >
                    View profile
                  </button>
                </div>
              ))}
              {filteredVolunteers.length === 0 && (
                <p className="empty-state">No volunteers match your search.</p>
              )}
            </div>
          </div>
        </section>
        {selectedVolunteer && (
          <div
            className="detail-backdrop"
            role="presentation"
            onClick={() => setSelectedVolunteer(null)}
          >
            <section
              className="detail-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="volunteer-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="detail-close"
                aria-label="Close volunteer profile"
                onClick={() => setSelectedVolunteer(null)}
              >
                ×
              </button>
              <span className="initial-avatar">
                {selectedVolunteer.initials}
              </span>
              <p className="eyebrow">Volunteer profile</p>
              <h2 id="volunteer-detail-title">{selectedVolunteer.name}</h2>
              <dl>
                <div>
                  <dt>Service area</dt>
                  <dd>{selectedVolunteer.area}</dd>
                </div>
                <div>
                  <dt>Vehicle capacity</dt>
                  <dd>{selectedVolunteer.vehicle}</dd>
                </div>
                <div>
                  <dt>Contribution</dt>
                  <dd>{selectedVolunteer.shifts}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{selectedVolunteer.status}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  setSelectedVolunteer(null)
                  go("pickups")
                }}
              >
                View pickup schedule
              </button>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  )
}

// ── Recipients Screen ─────────────────────────────────────────────────────────
function RecipientsScreen({ go }: { go: (s: Screen) => void }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All recipients")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRecipientName, setNewRecipientName] = useState("")
  const [newRecipientArea, setNewRecipientArea] = useState("")
  const [recipients, setRecipients] = useState([
    {
      name: "Hope Kitchen",
      initials: "HK",
      type: "Community kitchen",
      area: "North District",
      people: "120 meals / day",
      needs: "Fruit, vegetables",
      status: "Open",
    },
    {
      name: "Food Bank 1",
      initials: "FB",
      type: "Food bank",
      area: "Central",
      people: "350 households",
      needs: "Root vegetables",
      status: "Open",
    },
    {
      name: "City Pantry",
      initials: "CP",
      type: "Neighborhood pantry",
      area: "East Valley",
      people: "80 households",
      needs: "Fresh produce",
      status: "Open",
    },
    {
      name: "Second Harvest",
      initials: "SH",
      type: "Food rescue partner",
      area: "Riverside",
      people: "200 meals / day",
      needs: "Leafy greens",
      status: "Limited capacity",
    },
    {
      name: "Sunrise Shelter",
      initials: "SS",
      type: "Community shelter",
      area: "South District",
      people: "60 residents",
      needs: "Seasonal produce",
      status: "Open",
    },
  ])
  const addRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newRecipientName.trim()
    const area = newRecipientArea.trim()
    if (!name || !area) return
    setRecipients((current) => [
      {
        name,
        initials: name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase(),
        type: "Community partner",
        area,
        people: "To be confirmed",
        needs: "Fresh produce",
        status: "Open",
      },
      ...current,
    ])
    setNewRecipientName("")
    setNewRecipientArea("")
    setShowAddForm(false)
    setFilter("All recipients")
    setSearch("")
  }
  const filteredRecipients = recipients.filter((recipient) => {
    const matchesFilter =
      filter === "All recipients" || recipient.status === filter
    return (
      matchesFilter &&
      `${recipient.name} ${recipient.type} ${recipient.area} ${recipient.needs}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })

  return (
    <AppShell go={go} active="recipients" title="Recipients">
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Community</p>
            <h1>Recipients</h1>
            <p>Food banks, kitchens, and pantries that receive donations.</p>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => setShowAddForm((open) => !open)}
          >
            {showAddForm ? "Cancel" : "+ Add recipient"}
          </button>
        </section>
        <PageMetrics
          items={[
            {
              label: "Community partners",
              value: "12",
              detail: "Across 6 districts",
              icon: "home",
              tone: "lime",
            },
            {
              label: "People supported",
              value: "2,840",
              detail: "Estimated each week",
              icon: "users",
              tone: "mint",
            },
            {
              label: "Open to donations",
              value: "10",
              detail: "2 at limited capacity",
              icon: "gift",
              tone: "cream",
            },
            {
              label: "Meals delivered",
              value: "6,420",
              detail: "This month",
              icon: "leaf",
              tone: "lime",
            },
          ]}
        />
        {showAddForm && (
          <form className="inline-form" onSubmit={addRecipient}>
            <div>
              <p className="eyebrow">New partner</p>
              <strong>Add a recipient</strong>
            </div>
            <label>
              Organization name
              <input
                required
                value={newRecipientName}
                onChange={(event) => setNewRecipientName(event.target.value)}
                placeholder="e.g. Community Pantry"
              />
            </label>
            <label>
              Location
              <input
                required
                value={newRecipientArea}
                onChange={(event) => setNewRecipientArea(event.target.value)}
                placeholder="e.g. Central District"
              />
            </label>
            <button type="submit" className="primary-action">
              Add recipient
            </button>
          </form>
        )}
        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Where food goes</p>
              <h2>
                Recipient network <span>{filteredRecipients.length}</span>
              </h2>
            </div>
            <button
              type="button"
              className="quiet-action"
              onClick={() => setFilter("Open")}
            >
              Show open partners
            </button>
          </div>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            filters={["All recipients", "Open", "Limited capacity"]}
            activeFilter={filter}
            onFilter={setFilter}
          />
          <div className="table-scroll">
            <div className="record-table recipients-table">
              <div className="record-table-head">
                <span>Organization</span>
                <span>Partner type</span>
                <span>Location</span>
                <span>Capacity</span>
                <span>Priority needs</span>
                <span>Status</span>
              </div>
              {filteredRecipients.map((recipient) => (
                <div className="record-row" key={recipient.name}>
                  <div className="record-primary">
                    <span className="initial-avatar recipient-avatar">
                      {recipient.initials}
                    </span>
                    <div>
                      <strong>{recipient.name}</strong>
                      <small>Verified partner</small>
                    </div>
                  </div>
                  <span>{recipient.type}</span>
                  <span>{recipient.area}</span>
                  <span>{recipient.people}</span>
                  <span>{recipient.needs}</span>
                  <StatusPill
                    label={recipient.status}
                    tone={recipient.status === "Open" ? "green" : "amber"}
                  />
                </div>
              ))}
              {filteredRecipients.length === 0 && (
                <p className="empty-state">No recipients match your search.</p>
              )}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

// ── Reports Screen ────────────────────────────────────────────────────────────
function ReportsScreen({ go }: { go: (s: Screen) => void }) {
  const [range, setRange] = useState("7 days")
  const bars = range === "7 days" ? VOLUME_BARS.slice(5) : VOLUME_BARS
  const labels =
    range === "7 days"
      ? CHART_DAYS
      : [
          "W1",
          "W2",
          "W3",
          "W4",
          "W5",
          "W6",
          "W7",
          "W8",
          "W9",
          "W10",
          "W11",
          "W12",
        ]

  return (
    <AppShell go={go} active="reports" title="Reports">
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
          <span>Reporting period</span>
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
        <PageMetrics
          items={[
            {
              label: "Food rescued",
              value: range === "7 days" ? "312 kg" : "1,284 kg",
              detail: "↑ 18% vs previous period",
              icon: "leaf",
              tone: "lime",
            },
            {
              label: "Successful donations",
              value: range === "7 days" ? "24" : "86",
              detail: "91% matched to a partner",
              icon: "gift",
              tone: "mint",
            },
            {
              label: "Community partners",
              value: "36",
              detail: "24 farms · 12 recipients",
              icon: "users",
              tone: "cream",
            },
            {
              label: "Estimated meals",
              value: range === "7 days" ? "780" : "3,210",
              detail: "From rescued produce",
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
                <i /> Kilograms
              </span>
            </div>
            <div className="report-chart-area">
              <div className="chart-y-labels">
                <span>100 kg</span>
                <span>75 kg</span>
                <span>50 kg</span>
                <span>25 kg</span>
                <span>0</span>
              </div>
              <div className="report-bars">
                {bars.map((height, index) => (
                  <div
                    className="report-bar-column"
                    key={`${labels[index]}-${index}`}
                  >
                    <span
                      style={{ height: `${height}%` }}
                      title={`${height} kg`}
                    />
                    <small>{labels[index]}</small>
                  </div>
                ))}
              </div>
            </div>
          </article>
          <article className="panel impact-card">
            <div className="records-heading">
              <div>
                <p className="eyebrow">Community impact</p>
                <h2>Where it went</h2>
              </div>
            </div>
            <div className="impact-breakdown">
              <div>
                <span className="impact-dot green-dot" />
                <span>Community kitchens</span>
                <strong>42%</strong>
              </div>
              <div className="impact-track">
                <i style={{ width: "42%" }} />
              </div>
              <div>
                <span className="impact-dot yellow-dot" />
                <span>Food banks</span>
                <strong>34%</strong>
              </div>
              <div className="impact-track">
                <i style={{ width: "34%" }} />
              </div>
              <div>
                <span className="impact-dot blue-dot" />
                <span>Neighborhood pantries</span>
                <strong>24%</strong>
              </div>
              <div className="impact-track">
                <i style={{ width: "24%" }} />
              </div>
            </div>
            <div className="impact-foot">
              <Icon name="leaf" size={17} />
              <span>
                <strong>1,284 kg</strong> kept out of landfill this month
              </span>
            </div>
          </article>
        </section>
        <section className="panel report-note">
          <span className="queue-icon">
            <Icon name="chart" />
          </span>
          <div>
            <strong>Rescue is growing in your network</strong>
            <p>
              Food recovery is up 18% compared with the previous period. Thank
              you for helping local food reach local tables.
            </p>
          </div>
          <button type="button" onClick={() => go("donations")}>
            View donations <Icon name="arrow" size={15} />
          </button>
        </section>
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

// ── Farmer dashboard (approved farmers) ───────────────────────────────────────
type FarmerDonation = {
  id: string
  produce: string
  quantity_kg: number | string
  status: DonationStatus
  expires_at: string | null
  notes: string | null
  created_at: string
  recipient: { name: string } | null
  pickups: {
    id: string
    scheduled_at: string
    status: string
    volunteer: { full_name: string; phone: string | null } | null
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

function farmerDonationStatus(donation: FarmerDonation): { label: string; tone: ActivityTone } {
  if (donation.status === "new") return { label: "Waiting for match", tone: "blue" }
  const next = donation.pickups.find((pickup) => pickup.status === "scheduled")
  return donationStatus(donation.status, next?.scheduled_at)
}

function FarmerDashboardScreen({ go }: { go: (s: Screen) => void }) {
  const { account, setAccount } = useSession()
  const [data, setData] = useState<FarmerDashboardData | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [showForm, setShowForm] = useState(true)
  const [produce, setProduce] = useState("")
  const [quantity, setQuantity] = useState("")
  const [useBy, setUseBy] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [formMessage, setFormMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setError("")
    api
      .get<FarmerDashboardData>("/farmer/dashboard")
      .then((result) => {
        setData(result)
        // A coordinator may have changed this farm's status since login
        if (account && result.farm.status !== account.farmer?.status) {
          const updated = { ...account, farmer: result.farm }
          setAccount(updated)
          if (result.farm.status !== "approved") go("farmer-status")
        }
      })
      .catch((err) => setError(errorText(err)))
  }, [account])

  useEffect(load, [])

  const postDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormMessage(null)
    try {
      const created = await api.post<FarmerDonation>("/farmer/donations", {
        produce: produce.trim(),
        quantity_kg: Number(quantity),
        // "use by" date means the end of that day, in this computer's time zone
        expires_at: useBy ? new Date(`${useBy}T23:59:00`).toISOString() : null,
        notes: notes.trim() || null,
      })
      setData((current) =>
        current
          ? {
              ...current,
              donations: [created, ...current.donations],
              stats: {
                ...current.stats,
                active_donations: current.stats.active_donations + 1,
                total_donations: current.stats.total_donations + 1,
              },
            }
          : current,
      )
      setProduce("")
      setQuantity("")
      setUseBy("")
      setNotes("")
      setFilter("All")
      setFormMessage({ kind: "success", text: `Posted ${created.produce}. The coordinator will match it with a food bank.` })
    } catch (err) {
      setFormMessage({ kind: "error", text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const cancelDonation = async (donation: FarmerDonation) => {
    if (!window.confirm(`Cancel your ${donation.produce} donation?`)) return
    setBusyId(donation.id)
    try {
      await api.post(`/farmer/donations/${donation.id}/cancel`)
      load()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  const farm = data?.farm ?? account?.farmer
  const stats = data?.stats
  const filters = ["All", "Waiting for match", "Matched", "Pickup scheduled", "Delivered"]
  const donations = (data?.donations ?? []).filter((donation) => {
    const status = farmerDonationStatus(donation).label
    const matchesFilter =
      filter === "All" ||
      status === filter ||
      (filter === "Pickup scheduled" && status === "Pickup today")
    return matchesFilter && donation.produce.toLowerCase().includes(search.toLowerCase())
  })
  const firstName = account?.profile.first_name
  const today = new Date()
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  return (
    <AppShell go={go} active="farmer-dashboard" title="My farm" nav={FARMER_NAV} live>
      <main className="dashboard-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{farm?.farm_name ?? "My farm"}</p>
            <h1>My donations</h1>
            <p>
              {greeting()}
              {firstName ? `, ${firstName}` : ""}. Post surplus harvest and follow
              where it goes.
            </p>
          </div>
          <button
            type="button"
            className="primary-action"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? "Hide form" : "+ Post surplus"}
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
              detail: "Waiting or on the way",
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
              label: "Delivered",
              value: stats ? String(stats.delivered_donations) : "…",
              detail: `Out of ${stats?.total_donations ?? "…"} posted`,
              icon: "home",
              tone: "cream",
            },
            {
              label: "Food rescued",
              value: stats ? `${formatKg(stats.kg_rescued)} kg` : "…",
              detail: "Reached a food bank",
              icon: "leaf",
              tone: "lime",
            },
          ]}
        />

        {showForm && (
          <form className="inline-form farmer-form" onSubmit={postDonation}>
            <div>
              <p className="eyebrow">Quick entry</p>
              <strong>Post surplus harvest</strong>
            </div>
            <label>
              Produce
              <input
                required
                value={produce}
                onChange={(event) => setProduce(event.target.value)}
                placeholder="e.g. Tomatoes"
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
            <label>
              Use by (optional)
              <input
                type="date"
                min={minDate}
                value={useBy}
                onChange={(event) => setUseBy(event.target.value)}
              />
            </label>
            <label>
              Notes (optional)
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. Ready at the gate after 8 AM"
              />
            </label>
            <button type="submit" className="primary-action" disabled={saving}>
              {saving ? "Posting..." : "Post donation"}
            </button>
            {formMessage && (
              <p className={`form-message ${formMessage.kind}`} role={formMessage.kind === "error" ? "alert" : "status"}>
                {formMessage.text}
              </p>
            )}
          </form>
        )}

        <section className="panel records-panel">
          <div className="records-heading">
            <div>
              <p className="eyebrow">Your harvest</p>
              <h2>
                Donations <span>{donations.length}</span>
              </h2>
            </div>
            <button type="button" className="quiet-action" onClick={load}>
              Refresh
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
            <div className="record-table farmer-donations-table">
              <div className="record-table-head">
                <span>Produce</span>
                <span>Quantity</span>
                <span>Food bank</span>
                <span>Pickup</span>
                <span>Status</span>
                <span></span>
              </div>
              {donations.map((donation) => {
                const status = farmerDonationStatus(donation)
                const pickup =
                  donation.pickups.find((p) => p.status === "scheduled") ??
                  donation.pickups.find((p) => p.status === "completed")
                return (
                  <div className="record-row" key={donation.id}>
                    <div className="record-primary">
                      <span className="produce-dot">
                        <Icon name="leaf" size={15} />
                      </span>
                      <div>
                        <strong>{donation.produce}</strong>
                        <small>
                          Posted {formatDateTime(donation.created_at)}
                          {donation.expires_at ? ` · use by ${new Date(donation.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                        </small>
                      </div>
                    </div>
                    <span>{formatKg(donation.quantity_kg)} kg</span>
                    <span>{donation.recipient?.name ?? "Not matched yet"}</span>
                    <span title={pickup?.volunteer?.phone ?? ""}>
                      {pickup
                        ? `${formatDateTime(pickup.scheduled_at)}${pickup.volunteer ? ` · ${pickup.volunteer.full_name}` : ""}`
                        : "—"}
                    </span>
                    <StatusPill label={status.label} tone={status.tone} />
                    {donation.status === "new" ? (
                      <button
                        type="button"
                        className="row-action danger"
                        disabled={busyId === donation.id}
                        onClick={() => cancelDonation(donation)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </div>
                )
              })}
              {data && donations.length === 0 && (
                <p className="empty-state">
                  {data.donations.length
                    ? "No donations match your search."
                    : "You haven't posted anything yet. Use the form above to post surplus harvest."}
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

// ────────────────────────────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("splash")
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
      else if (screen === "farmer-dashboard" && account.farmer?.status !== "approved") current = "farmer-status"
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
    volunteers: <VolunteersScreen go={go} />,
    recipients: <RecipientsScreen go={go} />,
    reports: <ReportsScreen go={go} />,
    "farmer-status": <FarmerStatusScreen go={go} />,
    "farmer-dashboard": <FarmerDashboardScreen go={go} />,
  }

  return (
    <SessionContext.Provider value={{ account, setAccount, pendingFarmers, setPendingFarmers }}>
      {screenMap[current]}
    </SessionContext.Provider>
  )
}
