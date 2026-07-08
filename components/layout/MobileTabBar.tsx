'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Layers, BarChart3, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { name: 'Home',      href: '/dashboard',            icon: LayoutDashboard, exact: true  },
  { name: 'Leads',     href: '/dashboard/leads',      icon: Users,           exact: false },
  { name: 'Lifecycle', href: '/dashboard/lifecycle',  icon: Layers,          exact: false },
  { name: 'Analytics', href: '/dashboard/analytics',  icon: BarChart3,       exact: false },
  { name: 'More',      href: '/dashboard/settings',   icon: MoreHorizontal,  exact: false },
]

export function MobileTabBar() {
  const pathname = usePathname()
  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-100">
      <div className="flex items-center justify-around h-16 pb-safe px-2">
        {TABS.map((tab) => {
          const active = isActive(tab.href, tab.exact)
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
              <Icon className={cn('w-5 h-5 transition-transform', active && 'scale-110')} />
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
