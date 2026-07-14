'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, HandshakeIcon, Building2,
  Phone, BarChart3, BarChart2, Calculator, Settings,
  ChevronLeft, ChevronRight, LogOut, Loader2, Activity,
  MessageCircle, CreditCard, UserCheck, GitBranch, Sparkles, Plug, Layers, HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPlan, getRole, canAccess, type Plan, type Role } from '@/lib/plan'

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Workspace',
    items: [
      { name: 'Leads',          href: '/dashboard/leads',            icon: Users,         exact: false },
      { name: 'Lifecycle',      href: '/dashboard/lifecycle',        icon: Layers,        exact: false },
      { name: 'Inventory',      href: '/dashboard/properties',       icon: Building2,     exact: false, teamsOnly: true },
      { name: 'Team',           href: '/dashboard/team',             icon: UserCheck,     exact: false, teamsOnly: true },
    ],
  },
  {
    label: 'Engage',
    items: [
      { name: 'AI Advisor',    href: '/dashboard/advisor',            icon: Sparkles,      exact: false },
      { name: 'Broadcast',     href: '/dashboard/outreach/broadcast', icon: MessageCircle, exact: false },
      { name: 'Power Dialer',  href: '/dashboard/calls',              icon: Phone,         exact: false },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Analytics',      href: '/dashboard/analytics',        icon: BarChart3,  exact: false },
      { name: 'Team Analytics', href: '/dashboard/team/analytics',   icon: Users,      exact: false, teamsOnly: true },
      { name: 'Calculators',    href: '/dashboard/calculators',      icon: Calculator, exact: false },
      { name: 'Reports',        href: '/dashboard/reports',          icon: BarChart2,  exact: false },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'Lead Routing',   href: '/dashboard/settings/routing',  icon: GitBranch,  exact: false, teamsOnly: true },
      { name: 'Billing',        href: '/dashboard/settings/billing',  icon: CreditCard, exact: false },
      { name: 'Integrations',   href: '/dashboard/integrations',      icon: Plug,       exact: false },
      { name: 'Help & Support', href: '/dashboard/help',              icon: HelpCircle, exact: false },
    ],
  },
]

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" className={cn('flex items-center gap-3 px-4 h-14 border-b border-slate-100 hover:bg-slate-50 transition-colors', collapsed && 'justify-center px-0')}>
      <div className="relative shrink-0 flex items-center justify-center w-8 h-8 rounded-[9px]" style={{ background: 'linear-gradient(135deg, #7600bc 0%, #b100cd 100%)' }}>
        <span className="text-[11px] font-bold text-white tracking-tight">VP</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-[14px] font-semibold tracking-[-0.02em]" style={{ color: '#4c00b0' }}>Vya Pulse</span>
          <span className="text-[10px] text-slate-400 font-medium">CRM</span>
        </div>
      )}
    </Link>
  )
}

function NavItem({
  item, collapsed, active, onClick, locked = false,
}: {
  item: { name: string; href: string; icon: React.ElementType }
  collapsed: boolean
  active: boolean
  onClick?: () => void
  locked?: boolean
}) {
  const Icon = item.icon
  const tooltip = collapsed ? (locked ? `${item.name} — Teams only` : item.name) : undefined

  if (locked) {
    return (
      <div
        title={tooltip}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium cursor-not-allowed opacity-40',
          collapsed ? 'justify-center w-9 h-9 mx-auto' : 'px-3 py-2',
          'text-slate-400 border-l-2 border-transparent'
        )}
      >
        <Icon className={cn('shrink-0 w-4 h-4', collapsed && 'w-[18px] h-[18px]')} />
        {!collapsed && (
          <span className="flex-1">{item.name}</span>
        )}
        {!collapsed && (
          <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(160,0,200,0.1)', color: '#a000c8' }}>Teams</span>
        )}
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white whitespace-nowrap shadow-lg group-hover:block z-50">
            {item.name} — Teams only
          </span>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={tooltip}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
        collapsed ? 'justify-center w-9 h-9 mx-auto' : 'px-3 py-2',
        active
          ? 'border-l-2'
          : 'text-slate-500 border-l-2 border-transparent hover:bg-slate-50 hover:text-slate-800'
      )}
      style={active ? { background: 'rgba(160,0,200,0.07)', color: '#8a00c2', borderLeftColor: '#a000c8' } : undefined}
    >
      <Icon
        className={cn(
          'shrink-0 transition-colors duration-150',
          collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4',
        )}
        style={{ color: active ? '#a000c8' : undefined }}
      />
      {!collapsed && item.name}

      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white whitespace-nowrap shadow-lg group-hover:block z-50">
          {item.name}
        </span>
      )}
    </Link>
  )
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto w-5 h-px bg-slate-100 my-2" />
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 select-none">
      {label}
    </p>
  )
}

export function Sidebar({
  onMobileClose, mobileOpen,
}: {
  onMobileClose?: () => void
  mobileOpen?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [plan, setPlanState] = useState<Plan>('solo')
  const [role, setRoleState] = useState<Role>('admin')

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  useEffect(() => {
    const sync = () => { setPlanState(getPlan()); setRoleState(getRole()) }
    sync()
    window.addEventListener('plan-changed', sync)
    return () => window.removeEventListener('plan-changed', sync)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null)
    })
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    window.dispatchEvent(new CustomEvent('sidebar-collapsed-change', { detail: next }))
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initial = userEmail?.charAt(0).toUpperCase() ?? 'A'

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full flex flex-col',
          'bg-white border-r border-slate-100',
          'transition-[width,transform] duration-200 ease-out',
          collapsed ? 'w-[60px]' : 'w-[220px]',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <Logo collapsed={collapsed} />

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          {NAV_SECTIONS.map((section, si) => {
            const visibleItems = section.items.filter(item => canAccess(item.href, plan, role))
            if (visibleItems.length === 0) return null
            return (
              <div key={si}>
                {section.label && <SectionLabel label={section.label} collapsed={collapsed} />}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isTeamsLocked = Boolean('teamsOnly' in item && item.teamsOnly && plan !== 'teams')
                    return (
                      <NavItem
                        key={item.href}
                        item={item}
                        collapsed={collapsed}
                        active={isActive(item.href, item.exact)}
                        onClick={onMobileClose}
                        locked={isTeamsLocked}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="px-2 pb-2 border-t border-slate-100 pt-2">
          <NavItem
            item={{ name: 'Settings', href: '/dashboard/settings', icon: Settings }}
            collapsed={collapsed}
            active={isActive('/dashboard/settings', false)}
            onClick={onMobileClose}
          />
        </div>

        <div className={cn('px-2 pb-3 border-t border-slate-100 pt-3', collapsed && 'px-1.5')}>
          {collapsed ? (
            <div className="flex justify-center">
              <div
                className="w-8 h-8 rounded-full border flex items-center justify-center"
                style={{ background: 'rgba(160,0,200,0.08)', borderColor: '#e8bcf0' }}
              >
                <span className="text-[11px] font-bold" style={{ color: '#8a00c2' }}>{initial}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group">
              <div
                className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0"
                style={{ background: 'rgba(160,0,200,0.08)', borderColor: '#e8bcf0' }}
              >
                <span className="text-[11px] font-bold" style={{ color: '#8a00c2' }}>{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-700 truncate">{userEmail}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {plan === 'teams' && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                      style={{ background: 'rgba(160,0,200,0.1)', color: '#8a00c2' }}
                    >
                      {role === 'admin' ? 'Admin' : 'Agent'}
                    </span>
                  )}
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                    style={plan === 'teams'
                      ? { background: 'rgba(160,0,200,0.1)', color: '#a000c8' }
                      : { background: '#F1F5F9', color: '#64748B' }
                    }
                  >
                    {plan === 'teams' ? 'Teams' : 'Solo'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                title="Sign out"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100"
              >
                {loggingOut
                  ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                  : <LogOut className="w-3.5 h-3.5 text-slate-400" />
                }
              </button>
            </div>
          )}
        </div>

        {/* Collapse strip at bottom */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center h-8 border-t border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Floating expand pill — only visible when sidebar is collapsed */}
      {collapsed && (
        <button
          onClick={toggleCollapsed}
          title="Expand sidebar"
          className="hidden lg:flex fixed top-1/2 left-[60px] -translate-y-1/2 z-50 items-center justify-center w-5 h-10 bg-white border border-slate-200 rounded-r-lg shadow-md text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </>
  )
}
