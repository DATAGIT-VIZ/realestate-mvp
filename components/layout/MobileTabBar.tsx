'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, Users, CheckSquare, ChartBar, Gear } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const TABS = [
  {
    name: 'Home',
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
    exact: false,
  },
  {
    name: 'Workspace',
    href: '/dashboard/tasks',
    icon: CheckSquare,
    activePaths: ['/dashboard/tasks', '/dashboard/team'],
    exact: false,
  },
  {
    name: 'Insights',
    href: '/dashboard/analytics',
    icon: ChartBar,
    activePaths: ['/dashboard/analytics', '/dashboard/team/analytics', '/dashboard/calculators', '/dashboard/reports'],
    exact: false,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Gear,
    activePaths: ['/dashboard/settings', '/dashboard/integrations', '/dashboard/help', '/dashboard/outreach', '/dashboard/calls', '/dashboard/advisor'],
    exact: false,
  },
]

export function MobileTabBar() {
  const pathname = usePathname()

  const isActive = (tab: typeof TABS[number]) => {
    if (tab.exact) return pathname === tab.href
    return tab.activePaths.some(p => pathname.startsWith(p))
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-100">
      <div className="flex items-center justify-around h-16 pb-safe px-2">
        {TABS.map((tab) => {
          const active = isActive(tab)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl transition-colors',
                active ? 'text-blue-600' : 'text-slate-400 active:text-slate-600'
              )}
            >
              <Icon
                size={20}
                weight={active ? 'bold' : 'light'}
                className="transition-transform"
                style={{ transform: active ? 'scale(1.1)' : 'scale(1)' }}
              />
              <span className={cn('text-[10px] font-medium tracking-tight', active ? 'text-blue-600' : 'text-slate-400')}>
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
