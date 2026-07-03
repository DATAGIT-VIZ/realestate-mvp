'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, HandshakeIcon, Building2,
  Megaphone, Phone, BarChart3, Calculator, Settings,
  ChevronLeft, ChevronRight, LogOut, Loader2, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Workspace',
    items: [
      { name: 'Leads',          href: '/dashboard/leads',            icon: Users,         exact: false },
      { name: 'Ingestion Log',  href: '/dashboard/leads/ingestion',  icon: Activity,      exact: false },
      { name: 'Deals',          href: '/dashboard/deals',            icon: HandshakeIcon, exact: false },
      { name: 'Properties',     href: '/dashboard/properties',       icon: Building2,     exact: false },
    ],
  },
  {
    label: 'Engage',
    items: [
      { name: 'Outreach', href: '/dashboard/outreach', icon: Megaphone, exact: false },
      { name: 'Calls',    href: '/dashboard/calls',    icon: Phone,      exact: false },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Analytics',   href: '/dashboard/analytics',   icon: BarChart3,  exact: false },
      { name: 'Calculators', href: '/dashboard/calculators', icon: Calculator, exact: false },
    ],
  },
]

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 px-4 h-14 border-b border-slate-100', collapsed && 'justify-center px-0')}>
      <div className="relative shrink-0 flex items-center justify-center w-8 h-8 rounded-[9px] bg-gradient-to-br from-blue-500 to-violet-600">
        <span className="text-[11px] font-bold text-white tracking-tight">RE</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-[14px] font-semibold text-slate-800 tracking-[-0.02em]">RealEdge</span>
          <span className="text-[10px] text-slate-400 font-medium">CRM</span>
        </div>
      )}
    </div>
  )
}

function NavItem({
  item, collapsed, active, onClick,
}: {
  item: { name: string; href: string; icon: React.ElementType }
  collapsed: boolean
  active: boolean
  onClick?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
        collapsed ? 'justify-center w-9 h-9 mx-auto' : 'px-3 py-2',
        active
          ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500'
          : 'text-slate-500 border-l-2 border-transparent hover:bg-slate-50 hover:text-slate-800'
      )}
    >
      <Icon
        className={cn(
          'shrink-0 transition-colors duration-150',
          collapsed ? 'w-[18px] h-[18px]' : 'w-4 h-4',
          active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
        )}
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

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  useEffect(() => { setUserEmail('demo@realedge.in') }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    window.dispatchEvent(new StorageEvent('storage', { key: 'sidebar-collapsed', newValue: String(next) }))
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
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && <SectionLabel label={section.label} collapsed={collapsed} />}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    active={isActive(item.href, item.exact)}
                    onClick={onMobileClose}
                  />
                ))}
              </div>
            </div>
          ))}
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
              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <span className="text-[11px] font-bold text-blue-600">{initial}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group">
              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-blue-600">{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-700 truncate">{userEmail}</p>
                <p className="text-[10px] text-slate-400">Agent</p>
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

        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center h-8 border-t border-slate-100 text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>
    </>
  )
}
