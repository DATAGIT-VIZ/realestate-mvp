'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, Plus, ChevronDown, Settings, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { GlobalSearch } from '@/components/layout/GlobalSearch'

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
  '/dashboard/help':     'Help & Support',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.match(/^\/dashboard\/leads\/.+/)) return 'Lead Detail'
  if (pathname.match(/^\/dashboard\/properties\/.+/)) return 'Property Detail'
  if (pathname.match(/^\/dashboard\/deals\/.+/)) return 'Deal Detail'
  return 'RealEdge'
}

const QUICK_ADD_ITEMS = [
  { label: 'New Lead',     shortcut: 'L', action: 'lead' },
  { label: 'New Deal',     shortcut: 'D', action: 'deal' },
  { label: 'New Property', shortcut: 'P', action: 'property' },
  { label: 'Log Activity', shortcut: 'A', action: 'activity' },
]

export function TopBar({
  onMenuClick,
  sidebarCollapsed,
  onNewLead,
}: {
  onMenuClick?: () => void
  sidebarCollapsed?: boolean
  onNewLead?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const title = getPageTitle(pathname)

  const [searchOpen, setSearchOpen] = useState(false)
  const [addOpen, setAddOpen]       = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  const addRef    = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleQuickAdd(action: string) {
    setAddOpen(false)
    if (action === 'lead')     { onNewLead?.() }
    if (action === 'deal')     { router.push('/dashboard/deals') }
    if (action === 'property') { router.push('/dashboard/properties/new') }
    if (action === 'activity') { router.push('/dashboard/leads') }
  }

  return (
    <>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

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
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors group"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-500" />
            <span className="text-[12px] text-slate-400 hidden md:block">Search...</span>
            <kbd className="hidden md:flex items-center text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-medium">
              ⌘K
            </kbd>
          </button>

          {/* Quick Add */}
          <div ref={addRef} className="relative">
            <button
              onClick={() => setAddOpen(o => !o)}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.97] transition-all duration-150 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[12px] font-semibold hidden sm:block">Add</span>
            </button>

            {addOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-lg shadow-black/[0.06] z-50">
                <div className="p-1.5">
                  {QUICK_ADD_ITEMS.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleQuickAdd(item.action)}
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
            )}
          </div>

          {/* Notifications */}
          <NotificationCenter />

          {/* Avatar */}
          <div ref={avatarRef} className="relative">
            <button
              onClick={() => setAvatarOpen(o => !o)}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <span className="text-[11px] font-bold text-blue-600">A</span>
              </div>
              <ChevronDown className={cn('w-3 h-3 text-slate-400 hidden sm:block transition-transform', avatarOpen && 'rotate-180')} />
            </button>

            {avatarOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-lg shadow-black/[0.06] z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-[13px] font-semibold text-slate-800">Abhishek Raikar</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">abhiraikar4@gmail.com</p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => { setAvatarOpen(false); router.push('/dashboard/settings') }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <button
                    onClick={() => { setAvatarOpen(false); router.push('/dashboard/help') }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    Help & Support
                  </button>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </header>
    </>
  )
}
