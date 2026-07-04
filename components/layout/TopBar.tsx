'use client'

import { usePathname } from 'next/navigation'
import { Menu, Search, Plus, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationCenter } from '@/components/layout/NotificationCenter'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/leads': 'Leads',
  '/dashboard/leads/ingestion': 'Ingestion Log',
  '/dashboard/deals': 'Deals',
  '/dashboard/properties': 'Properties',
  '/dashboard/properties/new': 'Add Property',
  '/dashboard/outreach': 'Outreach',
  '/dashboard/outreach/sequences': 'Sequences',
  '/dashboard/outreach/sequences/new': 'New Sequence',
  '/dashboard/outreach/broadcast': 'Bulk Broadcast',
  '/dashboard/calls': 'Power Dialer',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/calculators': 'Calculators',
  '/dashboard/settings': 'Settings',
  '/dashboard/settings/billing': 'Billing & Plan',
  '/dashboard/settings/routing': 'Lead Routing',
  '/dashboard/team': 'Team',
  '/dashboard/reports':  'Reports',
  '/dashboard/advisor':  'AI Advisor',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.match(/^\/dashboard\/leads\/.+/)) return 'Lead Detail'
  if (pathname.match(/^\/dashboard\/properties\/.+/)) return 'Property Detail'
  if (pathname.match(/^\/dashboard\/deals\/.+/)) return 'Deal Detail'
  return 'RealEdge'
}

const QUICK_ADD_ITEMS = [
  { label: 'New Lead',     shortcut: 'L' },
  { label: 'New Deal',     shortcut: 'D' },
  { label: 'New Property', shortcut: 'P' },
  { label: 'Log Activity', shortcut: 'A' },
]

export function TopBar({
  onMenuClick,
  sidebarCollapsed,
}: {
  onMenuClick?: () => void
  sidebarCollapsed?: boolean
}) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between h-14',
        'bg-white/90 backdrop-blur-md border-b border-slate-100',
        'px-4 lg:px-6'
      )}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-[15px] font-semibold text-slate-800 tracking-[-0.01em]">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors group">
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-500" />
          <span className="text-[12px] text-slate-400 hidden md:block">Search...</span>
          <kbd className="hidden md:flex items-center text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-medium">
            ⌘K
          </kbd>
        </button>

        {/* Quick add */}
        <div className="relative group">
          <button className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.97] transition-all duration-150 text-white">
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[12px] font-semibold hidden sm:block">Add</span>
          </button>
          <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-lg shadow-black/[0.06] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 origin-top-right scale-95 group-hover:scale-100 z-50">
            <div className="p-1.5">
              {QUICK_ADD_ITEMS.map((item) => (
                <button
                  key={item.label}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span>{item.label}</span>
                  <kbd className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                    {item.shortcut}
                  </kbd>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <NotificationCenter />

        {/* Avatar */}
        <button className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors group">
          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
            <span className="text-[11px] font-bold text-blue-600">D</span>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 hidden sm:block" />
        </button>
      </div>
    </header>
  )
}
