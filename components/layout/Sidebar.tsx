'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  House, Users, Megaphone, CheckSquare, ChartBar,
  Robot, Gear, Lock, CaretLeft, CaretRight, SignOut, CalendarCheck,
  UserPlus, Question,
} from '@phosphor-icons/react'
import { CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPlan, getRole, type Plan, type Role } from '@/lib/plan'

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  /** all pathname prefixes that should make this item active */
  activePaths: string[]
  /** exact match only */
  exact?: boolean
  /** teams-only lock */
  teamsOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Today',
    href: '/dashboard/today',
    icon: CalendarCheck,
    activePaths: ['/dashboard/today'],
    exact: true,
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: House,
    activePaths: ['/dashboard'],
    exact: true,
  },
  {
    name: 'Leads',
    href: '/dashboard/leads',
    icon: Users,
    activePaths: ['/dashboard/leads', '/dashboard/lifecycle'],
  },
  {
    name: 'Outreach',
    href: '/dashboard/outreach/broadcast',
    icon: Megaphone,
    activePaths: ['/dashboard/outreach', '/dashboard/calls'],
  },
  {
    name: 'Tasks',
    href: '/dashboard/tasks',
    icon: CheckSquare,
    activePaths: ['/dashboard/tasks', '/dashboard/team'],
  },
  {
    name: 'Insights',
    href: '/dashboard/analytics',
    icon: ChartBar,
    activePaths: [
      '/dashboard/analytics',
      '/dashboard/team/analytics',
      '/dashboard/calculators',
      '/dashboard/reports',
    ],
  },
  {
    name: 'AI Advisor',
    href: '/dashboard/advisor',
    icon: Robot,
    activePaths: ['/dashboard/advisor'],
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Gear,
    activePaths: [
      '/dashboard/settings',
      '/dashboard/integrations',
      '/dashboard/help',
    ],
  },
]

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn('flex items-center gap-3 px-4 h-14 transition-colors', collapsed && 'justify-center px-0')}
      style={{ borderBottom: '1px solid rgba(0,41,102,0.08)' }}
    >
      {collapsed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/lgc-icon.svg" alt="LGC" style={{ height: 34, width: 34, objectFit: 'contain' }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/lgc-logo.svg" alt="Lead Gap CRM" style={{ height: 38, width: 'auto', objectFit: 'contain', maxWidth: 168 }} />
      )}
    </Link>
  )
}

function NavItemEl({
  item, collapsed, active, onClick, locked = false,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  onClick?: () => void
  locked?: boolean
}) {
  const Icon = item.icon

  if (locked) {
    return (
      <div
        title={collapsed ? `${item.name} — Teams only` : undefined}
        className={cn(
          'group relative flex items-center gap-2.5 text-[13px] font-medium cursor-not-allowed select-none',
          collapsed ? 'justify-center w-9 h-9 mx-auto' : 'px-3 py-2',
          'border-l-2 border-transparent'
        )}
        style={{ color: 'rgba(0,56,168,0.30)', opacity: 0.5 }}
      >
        <Icon size={collapsed ? 18 : 16} weight="light" />
        {!collapsed && <span className="flex-1">{item.name}</span>}
        {!collapsed && (
          <span
            className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5"
            style={{ background: 'rgba(0,56,168,0.08)', color: '#0038A8', borderRadius: 2 }}
          >
            Teams
          </span>
        )}
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-3 hidden px-2.5 py-1.5 text-xs whitespace-nowrap z-50 group-hover:block"
            style={{ background: '#0038A8', color: '#fff', borderRadius: 2 }}>
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
      title={collapsed ? item.name : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 text-[13px] font-medium transition-all duration-150',
        collapsed ? 'justify-center w-9 h-9 mx-auto' : 'px-3 py-2',
        'border-l-2',
        active ? '' : 'border-transparent'
      )}
      style={active
        ? { background: 'rgba(0,56,168,0.08)', color: '#0038A8', borderLeftColor: '#0038A8' }
        : { color: 'rgba(0,56,168,0.65)' }
      }
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,56,168,0.05)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '' }}
    >
      <Icon
        size={collapsed ? 18 : 16}
        weight={active ? 'bold' : 'light'}
      />
      {!collapsed && item.name}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 hidden px-2.5 py-1.5 text-xs whitespace-nowrap z-50 group-hover:block"
          style={{ background: '#0038A8', color: '#fff', borderRadius: 2 }}>
          {item.name}
        </span>
      )}
    </Link>
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

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href
    return item.activePaths.some(p => pathname.startsWith(p))
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initial = userEmail?.charAt(0).toUpperCase() ?? 'A'

  // Separate settings from the main nav for bottom-pinned treatment
  const mainItems = NAV_ITEMS.filter(i => i.name !== 'Settings')
  const settingsItem = NAV_ITEMS.find(i => i.name === 'Settings')!

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full flex flex-col',
          'transition-[width,transform] duration-200 ease-out',
          collapsed ? 'w-[60px]' : 'w-[220px]',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ background: '#FFFFFF', boxShadow: '4px 0 24px rgba(0,41,102,0.13)' }}
      >
        <Logo collapsed={collapsed} />

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          {mainItems.map((item) => {
            const locked = Boolean(item.teamsOnly && plan !== 'teams')
            return (
              <NavItemEl
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isActive(item)}
                onClick={onMobileClose}
                locked={locked}
              />
            )
          })}
        </nav>

        {/* Utility links — Invite team + Help center */}
        <div className="px-2 pt-2 pb-1" style={{ borderTop: '1px solid rgba(0,56,168,0.08)' }}>
          {[
            { label: 'Invite team', href: '/dashboard/team',  Icon: UserPlus },
            { label: 'Help center', href: '/dashboard/help',  Icon: Question },
          ].map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'group relative flex items-center gap-2.5 text-[13px] font-medium transition-all duration-150 border-l-2 border-transparent',
                collapsed ? 'justify-center w-9 h-9 mx-auto' : 'px-3 py-2',
              )}
              style={{ color: 'rgba(0,56,168,0.65)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,56,168,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              <Icon size={collapsed ? 18 : 16} weight="light" />
              {!collapsed && label}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-3 hidden px-2.5 py-1.5 text-xs whitespace-nowrap z-50 group-hover:block"
                  style={{ background: '#0038A8', color: '#fff', borderRadius: 2 }}>
                  {label}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Settings pinned above user profile */}
        <div className="px-2 pb-2 pt-1">
          <NavItemEl
            item={settingsItem}
            collapsed={collapsed}
            active={isActive(settingsItem)}
            onClick={onMobileClose}
          />
        </div>

        {/* User profile */}
        <div className={cn('px-2 pb-3 pt-3', collapsed && 'px-1.5')} style={{ borderTop: '1px solid rgba(0,56,168,0.08)' }}>
          {collapsed ? (
            <div className="flex justify-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,56,168,0.1)', border: '1px solid rgba(0,56,168,0.3)' }}
              >
                <span className="text-[11px] font-bold" style={{ color: '#0038A8' }}>{initial}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 group" style={{ cursor: 'default' }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,56,168,0.1)', border: '1px solid rgba(0,56,168,0.3)' }}
              >
                <span className="text-[11px] font-bold" style={{ color: '#0038A8' }}>{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: '#0038A8' }}>{userEmail}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {plan === 'teams' && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide"
                      style={{ background: 'rgba(0,56,168,0.08)', color: '#0038A8', borderRadius: 2 }}
                    >
                      {role === 'admin' ? 'Admin' : 'Agent'}
                    </span>
                  )}
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide"
                    style={{ background: 'rgba(0,56,168,0.06)', color: 'rgba(0,56,168,0.55)', borderRadius: 2 }}
                  >
                    {plan === 'teams' ? 'Teams' : 'Solo'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                title="Sign out"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
              >
                {loggingOut
                  ? <CircleNotch size={14} weight="light" className="animate-spin" style={{ color: 'rgba(0,56,168,0.4)' }} />
                  : <SignOut size={14} weight="light" style={{ color: 'rgba(0,56,168,0.4)' }} />
                }
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center h-8 transition-colors"
          style={{ borderTop: '1px solid rgba(0,56,168,0.08)', color: 'rgba(0,56,168,0.35)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,56,168,0.05)'
            ;(e.currentTarget as HTMLElement).style.color = '#0038A8'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = ''
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(0,56,168,0.35)'
          }}
        >
          {collapsed
            ? <CaretRight size={14} weight="light" />
            : <CaretLeft size={14} weight="light" />
          }
        </button>
      </aside>

      {collapsed && (
        <button
          onClick={toggleCollapsed}
          title="Expand sidebar"
          className="hidden lg:flex fixed top-1/2 left-[60px] -translate-y-1/2 z-50 items-center justify-center w-5 h-10 transition-all"
          style={{
            background: '#0038A8',
            borderRight: '1px solid rgba(0,56,168,0.2)',
            borderTop: '1px solid rgba(0,56,168,0.2)',
            borderBottom: '1px solid rgba(0,56,168,0.2)',
            color: '#fff',
          }}
        >
          <CaretRight size={12} weight="light" />
        </button>
      )}
    </>
  )
}
