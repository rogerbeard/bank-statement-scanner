import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  Upload, FileSearch, Grid3X3, BarChart3, Settings,
  Cpu, ChevronRight, Activity
} from 'lucide-react'
import { cn } from '../lib/utils'

const NAV_ITEMS = [
  { to: '/upload', icon: Upload, label: 'Upload', sub: 'PDF Statements' },
  { to: '/grid', icon: Grid3X3, label: 'Data Grid', sub: 'Transactions' },
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard', sub: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings', sub: 'Configuration' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-blueprint overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-blueprint-surface border-r border-blueprint-border relative">
        {/* Corner marks */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-blueprint-accent opacity-60" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-blueprint-accent opacity-60" />

        {/* Logo */}
        <div className="px-5 py-5 border-b border-blueprint-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-blueprint-accent flex items-center justify-center bg-blueprint-bg">
              <Cpu size={16} className="text-blueprint-accent" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blueprint-white leading-none">
                BSS
              </div>
              <div className="text-[10px] font-mono text-blueprint-dim mt-0.5 leading-none">
                STATEMENT SCANNER
              </div>
            </div>
          </div>
          {/* Version tag */}
          <div className="mt-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            <span className="text-[10px] font-mono text-blueprint-dim">v1.1.3 · LOCAL</span>
          </div>
        </div>

        {/* Dimension label */}
        <div className="px-5 pt-4 pb-2">
          <div className="dim-line text-[10px]">NAVIGATION</div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label, sub }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-150 relative',
                  isActive
                    ? 'bg-blueprint-line/20 border border-blueprint-line/40 text-blueprint-bright'
                    : 'text-blueprint-dim hover:text-blueprint-white hover:bg-blueprint-panel border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blueprint-accent rounded-r" />
                  )}
                  <Icon size={16} className={cn(isActive ? 'text-blueprint-accent' : 'text-blueprint-dim group-hover:text-blueprint-bright')} />
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm font-semibold leading-none', isActive ? 'text-blueprint-white' : '')}>
                      {label}
                    </div>
                    <div className="text-[10px] font-mono text-blueprint-dim mt-0.5">{sub}</div>
                  </div>
                  {isActive && <ChevronRight size={12} className="text-blueprint-accent" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Status bar */}
        <div className="px-5 py-4 border-t border-blueprint-border">
          <div className="flex items-center gap-2 text-[10px] font-mono text-blueprint-dim">
            <Activity size={10} className="text-blueprint-accent" />
            <span>SYSTEM READY</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-blueprint-dim/60">
            ALL PROCESSES NOMINAL
          </div>
        </div>

        {/* Bottom corner marks */}
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-blueprint-accent opacity-60" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-blueprint-accent opacity-60" />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-12 bg-blueprint-surface border-b border-blueprint-border flex items-center px-6 gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-mono text-blueprint-dim">
            <span className="text-blueprint-accent">BSS</span>
            <ChevronRight size={10} />
            <span className="text-blueprint-white capitalize">
              {location.pathname.split('/')[1] || 'upload'}
            </span>
          </div>

          <div className="flex-1" />

          {/* Status indicators */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-blueprint-dim">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
              <span>SERVER</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blueprint-accent" />
              <span>LOCAL MODE</span>
            </div>
            <div className="text-blueprint-accent/60 font-bold tracking-widest">v1.1.3</div>
          </div>

          {/* Corner marks */}
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-blueprint-accent/40" />
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
