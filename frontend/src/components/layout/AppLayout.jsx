import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { UserButton, useAuth } from '@clerk/react'
import {
  LayoutDashboard,
  Upload,
  AlertTriangle,
  Activity,
  HelpCircle,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload',    icon: Upload,           label: 'Upload Data' },
]

function SidebarLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary">
            <Activity className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">
            DATA<span className="text-primary">Claw</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 p-3 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3 border-t border-border p-3">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'size-7',
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">My Account</p>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden relative">
        {/* Top Navbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-foreground capitalize">
              {/* Route-based title could go here, for now it's just a spacer or breadcrumb area */}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/upload')}
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
            >
              <Plus className="size-3.5" />
              New Upload
            </button>
            <button className="inline-flex items-center justify-center size-8 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <HelpCircle className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
