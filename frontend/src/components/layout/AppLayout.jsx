import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { UserButton, useAuth } from '@clerk/react'
import {
  LayoutDashboard,
  Upload,
  AlertTriangle,
  Activity,
  ChevronRight,
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
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
