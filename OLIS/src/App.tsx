import { useState, useEffect, type FormEvent, type ReactNode } from "react"

// ── Screens ───────────────────────────────────────────────────────────────────
// Every screen in the app. Each one has its own component below, so you can
// open that function and edit it on its own.
type Screen = "splash" | "signin" | "signup" | "dashboard" | "donations" | "pickups" | "farmers" | "volunteers" | "recipients" | "reports"

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

type ActivityItem = {
  title: string
  farm: string
  partner: string
  status: string
  tone: ActivityTone
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const SESSION_KEY = "silo-demo-session"

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
    count: 3,
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

// ── Sample data ───────────────────────────────────────────────────────────────
const ACTIVITY: ActivityItem[] = [
  {
    title: "Peaches · 40 kg",
    farm: "Navarro Family Farm",
    partner: "Hope Kitchen",
    status: "Pickup today",
    tone: "amber",
  },
  {
    title: "Sweet potatoes · 28 kg",
    farm: "Aquino Highland Greens",
    partner: "Food Bank 1",
    status: "Matched",
    tone: "green",
  },
  {
    title: "Tomatoes · 16 kg",
    farm: "Santos Organic Farm",
    partner: "City Pantry",
    status: "New",
    tone: "blue",
  },
  {
    title: "Leafy greens · 22 kg",
    farm: "Riverside Organics",
    partner: "Second Harvest",
    status: "Delivered",
    tone: "dark",
  },
]

const RANGES = ["7 days", "30 days"]

const VOLUME_BARS = [35, 52, 44, 70, 61, 86, 76, 58, 91, 67, 80, 96]

const CHART_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

// ────────────────────────────────────────────────────────────────────────────
// Shared pieces
// ────────────────────────────────────────────────────────────────────────────

// ── App shell (sidebar + top bar) ─────────────────────────────────────────────
// Wraps every screen after sign-in. Pass the screen's own content as children.
function AppShell({
  go,
  active,
  title,
  children,
}: {
  go: (s: Screen) => void
  active: Screen
  title: string
  children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [jumpQuery, setJumpQuery] = useState("")
  const matchingPages = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(jumpQuery.trim().toLowerCase()),
  )

  const selectPage = (next: Screen) => {
    setJumpQuery("")
    go(next)
  }

  const handleSignOut = () => {
    localStorage.removeItem(SESSION_KEY)
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
          {NAV_ITEMS.map((item) => (
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
          <div className="undo-card">
            <strong>Undo last action</strong>
            <span>Nothing to undo.</span>
          </div>

          <div className="account-card">
            <span className="avatar">CM</span>

            <div>
              <strong>Carla Men...</strong>
              <small>Coordinator · Admin</small>
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

          <div className="demo-status">
            <i></i> Demo mode · saved in this browser
          </div>
        </header>

        {children}

        <div className="sample-bar">Sample data loaded</div>
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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hasSession = localStorage.getItem(SESSION_KEY) === "active"
      go(hasSession ? "dashboard" : "signin")
    }, 1700)

    return () => window.clearTimeout(timer)
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
  const [resetMessage, setResetMessage] = useState("")
  const submit = (event: FormEvent) => {
    event.preventDefault()
    localStorage.setItem(SESSION_KEY, "active")
    go("dashboard")
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
            <form onSubmit={submit}>
              <label>
                <span>Mobile number or email</span>
                <input
                  required
                  type="text"
                  autoComplete="username"
                  placeholder="09XX XXX XXXX"
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
                />
              </label>
              <button type="submit" className="auth-submit">
                Log in as farmer
              </button>
            </form>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setResetMessage(
                  "Password reset is not available in this demo. Contact your coordinator for help.",
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
            <form onSubmit={submit}>
              <label>
                <span>Username</span>
                <input
                  required
                  type="text"
                  autoComplete="username"
                  placeholder="coordinator"
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
                />
              </label>
              <button type="submit" className="auth-submit">
                Log in as coordinator
              </button>
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
  const [submitted, setSubmitted] = useState(false)

  const submit = (event: FormEvent<HTMLFormElement>) => {
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
    setSubmitted(true)
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
            This demo does not send your application to a coordinator. In the
            live service, the coordinator will verify your details before you
            can post donations.
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
                  />
                </label>
                <label>
                  <span>Mobile number</span>
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    placeholder="09XX XXX XXXX"
                  />
                </label>
                <label>
                  <span>Email (optional)</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  <span>Cooperative / association (optional)</span>
                  <input placeholder="Association name" />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>2 · Your farm</legend>
              <div className="signup-fields">
                <label>
                  <span>Farm name</span>
                  <input required placeholder="Your farm or garden name" />
                </label>
                <label>
                  <span>Farm address</span>
                  <input
                    required
                    autoComplete="street-address"
                    placeholder="Street, barangay, municipality / city"
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
              <button type="submit" className="auth-submit">
                Submit for approval
              </button>
            </div>
          </form>
        </section>
      )}
    </AuthLayout>
  )
}

// ── Dashboard Screen ──────────────────────────────────────────────────────────
function DashboardScreen({ go }: { go: (s: Screen) => void }) {
  const [range, setRange] = useState("7 days")

  return (
    <AppShell go={go} active="dashboard" title="Dashboard">
      <main className="dashboard-main">
        {/* ── Page heading ───────────────────────────────────────────────── */}
        <section className="page-heading">
          <div>
            <p className="eyebrow">Operations overview</p>
            <h1>Dashboard</h1>
            <p>Good morning, Carla. Here’s what needs your attention today.</p>
          </div>

          <button
            type="button"
            className="primary-action"
            onClick={() => go("donations")}
          >
            + Log donation
          </button>
        </section>

        {/* ── Key metrics ────────────────────────────────────────────────── */}
        <section className="stats-grid" aria-label="Key metrics">
          <article>
            <div className="stat-icon lime">
              <Icon name="gift" />
            </div>
            <p>Active donations</p>
            <strong>12</strong>
            <span className="positive">+3 today</span>
          </article>

          <article>
            <div className="stat-icon mint">
              <Icon name="truck" />
            </div>
            <p>Pickups today</p>
            <strong>4</strong>
            <span>Next at 10:30 AM</span>
          </article>

          <article>
            <div className="stat-icon cream">
              <Icon name="shield" />
            </div>
            <p>Farmers pending</p>
            <strong>3</strong>
            <span className="attention">Needs review</span>
          </article>

          <article className="impact-stat">
            <div className="stat-icon inverse">
              <Icon name="leaf" />
            </div>
            <p>Food rescued</p>
            <strong>
              1,284 <small>kg</small>
            </strong>
            <span>Across 86 donations</span>
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

              {ACTIVITY.map((item) => (
                <div key={item.title} className="activity-row">
                  <div className="donation-info">
                    <span className="produce-dot">
                      <Icon name="leaf" size={15} />
                    </span>

                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.farm}</small>
                    </div>
                  </div>

                  <span className="recipient">{item.partner}</span>

                  <span className={`status ${item.tone}`}>{item.status}</span>

                  <button
                    type="button"
                    aria-label={`Open ${item.title}`}
                    onClick={() => go("donations")}
                  >
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </article>

          {/* ── Priority queue ───────────────────────────────────────────── */}
          <article className="panel queue-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Action required</p>
                <h2>Priority queue</h2>
              </div>

              <span className="queue-count">6</span>
            </div>

            <div className="queue-item">
              <span className="queue-icon">
                <Icon name="shield" />
              </span>
              <div>
                <strong>3 farmers waiting</strong>
                <p>Review new account applications</p>
              </div>
              <button type="button" onClick={() => go("farmers")}>
                <Icon name="arrow" size={15} />
              </button>
            </div>

            <div className="queue-item">
              <span className="queue-icon amber-bg">
                <Icon name="clock" />
              </span>
              <div>
                <strong>2 pickups unassigned</strong>
                <p>Assign a volunteer before noon</p>
              </div>
              <button type="button" onClick={() => go("pickups")}>
                <Icon name="arrow" size={15} />
              </button>
            </div>

            <div className="queue-item">
              <span className="queue-icon blue-bg">
                <Icon name="gift" />
              </span>
              <div>
                <strong>1 donation expiring</strong>
                <p>Find a recipient within 4 hours</p>
              </div>
              <button type="button" onClick={() => go("donations")}>
                <Icon name="arrow" size={15} />
              </button>
            </div>
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

            <div className="volume-chart">
              {VOLUME_BARS.map((height, i) => {
                const barHeight =
                  range === "7 days" ? height : Math.max(25, height - 10)

                return (
                  <div key={i} className="chart-column">
                    <span
                      style={{
                        height: `${barHeight}%`,
                      }}
                    ></span>
                  </div>
                )
              })}
            </div>

            <div className="chart-meta">
              {CHART_DAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
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

// ── Farmers Screen ────────────────────────────────────────────────────────────
function FarmersScreen({ go }: { go: (s: Screen) => void }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All farmers")
  const [reviewed, setReviewed] = useState<string[]>([])
  const farmers = [
    {
      id: "navarro",
      name: "Navarro Family Farm",
      initials: "NF",
      area: "North District",
      produce: "Peaches, carrots",
      donations: "18 donations",
      joined: "Mar 2024",
      status: "Active",
    },
    {
      id: "aquino",
      name: "Aquino Highland Greens",
      initials: "AH",
      area: "Highland",
      produce: "Sweet potatoes, greens",
      donations: "12 donations",
      joined: "Jun 2024",
      status: "Active",
    },
    {
      id: "santos",
      name: "Santos Organic Farm",
      initials: "SO",
      area: "East Valley",
      produce: "Tomatoes, peppers",
      donations: "9 donations",
      joined: "Aug 2024",
      status: "Active",
    },
    {
      id: "riverbend",
      name: "Riverbend Growers Co-op",
      initials: "RG",
      area: "Riverside",
      produce: "Seasonal vegetables",
      donations: "New application",
      joined: "Today",
      status: "Pending review",
    },
    {
      id: "greenacres",
      name: "Green Acres Collective",
      initials: "GA",
      area: "South District",
      produce: "Squash, leafy greens",
      donations: "New application",
      joined: "Yesterday",
      status: "Pending review",
    },
    {
      id: "meadow",
      name: "Meadow Lane Produce",
      initials: "ML",
      area: "West District",
      produce: "Apples, root vegetables",
      donations: "New application",
      joined: "Oct 25",
      status: "Pending review",
    },
  ]
  const filteredFarmers = farmers.filter((farmer) => {
    const status = reviewed.includes(farmer.id) ? "Active" : farmer.status
    const matchesFilter =
      filter === "All farmers" ||
      (filter === "Pending review"
        ? status === "Pending review"
        : status === "Active")
    return (
      matchesFilter &&
      `${farmer.name} ${farmer.area} ${farmer.produce}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  })

  return (
    <AppShell go={go} active="farmers" title="Farmers">
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
            Review applications · 3
          </button>
        </section>
        <PageMetrics
          items={[
            {
              label: "Partner farms",
              value: "24",
              detail: "Across 6 districts",
              icon: "shield",
              tone: "lime",
            },
            {
              label: "Applications",
              value: String(Math.max(0, 3 - reviewed.length)),
              detail: "Waiting for review",
              icon: "clock",
              tone: "cream",
            },
            {
              label: "Donations this month",
              value: "86",
              detail: "+12% from last month",
              icon: "gift",
              tone: "mint",
            },
            {
              label: "Top produce",
              value: "Produce",
              detail: "Seasonal harvests",
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
            filters={["All farmers", "Pending review", "Active"]}
            activeFilter={filter}
            onFilter={setFilter}
          />
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
              {filteredFarmers.map((farmer) => {
                const status = reviewed.includes(farmer.id)
                  ? "Active"
                  : farmer.status
                return (
                  <div className="record-row" key={farmer.id}>
                    <div className="record-primary">
                      <span className="initial-avatar">{farmer.initials}</span>
                      <div>
                        <strong>{farmer.name}</strong>
                        <small>Local farm partner</small>
                      </div>
                    </div>
                    <span>{farmer.area}</span>
                    <span>{farmer.produce}</span>
                    <span>{farmer.donations}</span>
                    <span>{farmer.joined}</span>
                    <StatusPill
                      label={status}
                      tone={status === "Active" ? "green" : "amber"}
                    />
                    {status === "Pending review" ? (
                      <button
                        type="button"
                        className="row-action"
                        onClick={() =>
                          setReviewed((current) => [...current, farmer.id])
                        }
                      >
                        Approve
                      </button>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </div>
                )
              })}
              {filteredFarmers.length === 0 && (
                <p className="empty-state">No farmers match your search.</p>
              )}
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
// App
// ────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("splash")

  const go = (next: Screen) => {
    setScreen(next)
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
  }

  return <>{screenMap[screen]}</>
}
