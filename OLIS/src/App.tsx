import { FormEvent, useEffect, useState } from 'react'

type IconName = 'grid' | 'gift' | 'truck' | 'shield' | 'users' | 'home' | 'chart' | 'menu' | 'close' | 'arrow' | 'clock' | 'leaf' | 'search' | 'mail' | 'lock' | 'eye'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    gift: <><path d="M4 9h16v11H4zM3 5h18v4H3zM12 5v15"/><path d="M12 5c-1-3-5-3-5-1s3 2 5 1Zm0 0c1-3 5-3 5-1s-3 2-5 1Z"/></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    leaf: <><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z"/><path d="M4 21c2-5 6-8 12-11"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const nav = [
  { label: 'Dashboard', icon: 'grid', group: 'Overview' },
  { label: 'Donations', icon: 'gift', group: 'Food operations' },
  { label: 'Pickups', icon: 'truck' },
  { label: 'Farmers', icon: 'shield', group: 'Community', count: 3 },
  { label: 'Volunteers', icon: 'users' },
  { label: 'Recipients', icon: 'home' },
  { label: 'Reports', icon: 'chart', group: 'Insights' },
] as const

const activity = [
  { title: 'Peaches · 40 kg', farm: 'Navarro Family Farm', partner: 'Hope Kitchen', status: 'Pickup today', tone: 'amber' },
  { title: 'Sweet potatoes · 28 kg', farm: 'Aquino Highland Greens', partner: 'Food Bank 1', status: 'Matched', tone: 'green' },
  { title: 'Tomatoes · 16 kg', farm: 'Santos Organic Farm', partner: 'City Pantry', status: 'New', tone: 'blue' },
  { title: 'Leafy greens · 22 kg', farm: 'Riverside Organics', partner: 'Second Harvest', status: 'Delivered', tone: 'dark' },
]

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState('Dashboard')
  const [range, setRange] = useState('7 days')

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="logo-lockup">
          <span className="logo-tile">s</span>
          <div><strong>silo</strong><small>Food rescue network</small></div>
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close"/></button>
        </div>
        <nav className="side-nav" aria-label="Coordinator navigation">
          {nav.map((item) => <div className="nav-entry" key={item.label}>
            {'group' in item && item.group && <span className="nav-label">{item.group}</span>}
            <button className={active === item.label ? 'active' : ''} onClick={() => { setActive(item.label); setMenuOpen(false) }}>
              <Icon name={item.icon}/><span>{item.label}</span>{'count' in item && item.count && <b>{item.count}</b>}
            </button>
          </div>)}
        </nav>
        <div className="side-bottom">
          <div className="undo-card"><strong>Undo last action</strong><span>Nothing to undo.</span></div>
          <div className="account-card"><span className="avatar">CM</span><div><strong>Carla Men...</strong><small>Coordinator · Admin</small></div><button onClick={onSignOut}>Sign out</button></div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)}/>}

      <div className="workspace">
        <header className="admin-topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button>
          <strong>{active}</strong>
          <div className="jump-field"><Icon name="search" size={16}/><input aria-label="Jump to a page" placeholder="Jump to a page..."/></div>
          <div className="demo-status"><i></i> Demo mode · saved in this browser</div>
        </header>

        <main className="dashboard-main">
          <section className="page-heading">
            <div><p className="eyebrow">Operations overview</p><h1>Dashboard</h1><p>Good morning, Carla. Here’s what needs your attention today.</p></div>
            <button className="primary-action">+ Log donation</button>
          </section>

          <section className="stats-grid" aria-label="Key metrics">
            <article><div className="stat-icon lime"><Icon name="gift"/></div><p>Active donations</p><strong>12</strong><span className="positive">+3 today</span></article>
            <article><div className="stat-icon mint"><Icon name="truck"/></div><p>Pickups today</p><strong>4</strong><span>Next at 10:30 AM</span></article>
            <article><div className="stat-icon cream"><Icon name="shield"/></div><p>Farmers pending</p><strong>3</strong><span className="attention">Needs review</span></article>
            <article className="impact-stat"><div className="stat-icon inverse"><Icon name="leaf"/></div><p>Food rescued</p><strong>1,284 <small>kg</small></strong><span>Across 86 donations</span></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel activity-panel">
              <div className="panel-heading"><div><p className="eyebrow">Live operations</p><h2>Donation activity</h2></div><button>View all <Icon name="arrow" size={15}/></button></div>
              <div className="activity-table">
                <div className="table-head"><span>Donation</span><span>Recipient</span><span>Status</span><span></span></div>
                {activity.map((item) => <div className="activity-row" key={item.title}>
                  <div className="donation-info"><span className="produce-dot"><Icon name="leaf" size={15}/></span><div><strong>{item.title}</strong><small>{item.farm}</small></div></div>
                  <span className="recipient">{item.partner}</span>
                  <span className={`status ${item.tone}`}>{item.status}</span>
                  <button aria-label={`Open ${item.title}`}><Icon name="arrow" size={16}/></button>
                </div>)}
              </div>
            </article>

            <article className="panel queue-panel">
              <div className="panel-heading"><div><p className="eyebrow">Action required</p><h2>Priority queue</h2></div><span className="queue-count">6</span></div>
              <div className="queue-item"><span className="queue-icon"><Icon name="shield"/></span><div><strong>3 farmers waiting</strong><p>Review new account applications</p></div><button><Icon name="arrow" size={15}/></button></div>
              <div className="queue-item"><span className="queue-icon amber-bg"><Icon name="clock"/></span><div><strong>2 pickups unassigned</strong><p>Assign a volunteer before noon</p></div><button><Icon name="arrow" size={15}/></button></div>
              <div className="queue-item"><span className="queue-icon blue-bg"><Icon name="gift"/></span><div><strong>1 donation expiring</strong><p>Find a recipient within 4 hours</p></div><button><Icon name="arrow" size={15}/></button></div>
            </article>

            <article className="panel chart-panel">
              <div className="panel-heading"><div><p className="eyebrow">Network performance</p><h2>Rescue volume</h2></div><div className="range-picker">{['7 days','30 days'].map(r => <button className={range === r ? 'selected' : ''} onClick={() => setRange(r)} key={r}>{r}</button>)}</div></div>
              <div className="volume-chart">
                {[35,52,44,70,61,86,76,58,91,67,80,96].map((height, i) => <div className="chart-column" key={i}><span style={{height: `${range === '7 days' ? height : Math.max(25,height-10)}%`}}></span></div>)}
              </div>
              <div className="chart-meta"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div>
            </article>
          </section>
        </main>
        <div className="sample-bar">Sample data loaded</div>
      </div>
    </div>
  )
}

function Brand() {
  return <div className="auth-brand"><span>s</span><div><strong>silo</strong><small>Food rescue network</small></div></div>
}

function Splash() {
  return <main className="splash-screen">
    <div className="splash-orbit orbit-one"></div>
    <div className="splash-orbit orbit-two"></div>
    <div className="splash-content">
      <div className="splash-mark"><Icon name="leaf" size={42}/></div>
      <strong>silo</strong>
      <p>Every harvest has a home.</p>
      <span className="splash-loader"><i></i></span>
    </div>
    <span className="splash-foot">Food rescue network</span>
  </main>
}

function AuthScreen({ mode, onModeChange, onComplete }: { mode: 'signin' | 'signup'; onModeChange: (mode: 'signin' | 'signup') => void; onComplete: () => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    localStorage.setItem('silo-demo-session', 'active')
    onComplete()
  }

  return <main className="auth-screen">
    <section className="auth-story">
      <Brand/>
      <div className="story-copy">
        <p className="auth-eyebrow">Rescue more. Waste less.</p>
        <h1>Good food belongs on tables, not in landfills.</h1>
        <p>Silo connects local farms, volunteers, and food banks to move surplus harvest where it matters most.</p>
      </div>
      <div className="story-impact">
        <div><strong>1,284</strong><span>kg rescued</span></div>
        <div><strong>86</strong><span>successful donations</span></div>
        <div><strong>12</strong><span>community partners</span></div>
      </div>
      <div className="field-art" aria-hidden="true"><i></i><span></span><b></b></div>
    </section>

    <section className="auth-form-side">
      <div className="mobile-auth-brand"><Brand/></div>
      <div className="auth-card">
        <div className="auth-card-heading">
          <p className="auth-eyebrow">{mode === 'signin' ? 'Welcome back' : 'Join the network'}</p>
          <h2>{mode === 'signin' ? 'Sign in to Silo' : 'Create your account'}</h2>
          <p>{mode === 'signin' ? 'Continue coordinating food rescue in your community.' : 'Start connecting surplus harvest with people who need it.'}</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => onModeChange('signin')}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => onModeChange('signup')}>Sign up</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'signup' && <div className="form-row">
            <label><span>First name</span><input required placeholder="Carla"/></label>
            <label><span>Last name</span><input required placeholder="Mendoza"/></label>
          </div>}
          {mode === 'signup' && <label><span>Organization</span><div className="input-wrap"><Icon name="home" size={17}/><input required placeholder="Community food network"/></div></label>}
          <label><span>Email address</span><div className="input-wrap"><Icon name="mail" size={17}/><input required type="email" placeholder="you@organization.org"/></div></label>
          <label><span>Password</span><div className="input-wrap"><Icon name="lock" size={17}/><input required minLength={6} type={showPassword ? 'text' : 'password'} placeholder="At least 6 characters"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show password"><Icon name="eye" size={17}/></button></div></label>
          {mode === 'signin' ? <div className="form-options"><label className="check-label"><input type="checkbox"/> <span>Keep me signed in</span></label><button type="button">Forgot password?</button></div>
            : <label className="check-label terms"><input required type="checkbox"/><span>I agree to Silo’s <u>Terms</u> and <u>Privacy Policy</u>.</span></label>}
          <button className="auth-submit" type="submit">{mode === 'signin' ? 'Sign in to dashboard' : 'Create account'} <Icon name="arrow" size={17}/></button>
        </form>

        <p className="auth-switch">{mode === 'signin' ? 'New to Silo?' : 'Already have an account?'} <button onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
        <div className="demo-note"><span><Icon name="shield" size={15}/></span><p><strong>UI demo</strong>Any valid details will open the dashboard. No account is created.</p></div>
      </div>
      <p className="auth-copyright">© 2026 Silo Collective · Built for communities</p>
    </section>
  </main>
}

export default function App() {
  const [view, setView] = useState<'splash' | 'signin' | 'signup' | 'dashboard'>('splash')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setView(localStorage.getItem('silo-demo-session') === 'active' ? 'dashboard' : 'signin')
    }, 1700)
    return () => window.clearTimeout(timer)
  }, [])

  if (view === 'splash') return <Splash/>
  if (view === 'dashboard') return <Dashboard onSignOut={() => { localStorage.removeItem('silo-demo-session'); setView('signin') }}/>
  return <AuthScreen mode={view} onModeChange={setView} onComplete={() => setView('dashboard')}/>
}
