'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from '@phosphor-icons/react'
import { getPlan } from '@/lib/plan'
import { useEffect, useState } from 'react'

export type PageTab = {
  label: string
  href: string
  /** match exact pathname or startsWith */
  exact?: boolean
  /** if true, only Teams plan users can access */
  teamsOnly?: boolean
  /** optional badge count */
  badge?: number
}

export function PageTabBar({ tabs, module }: { tabs: PageTab[]; module?: string }) {
  const pathname = usePathname()
  const [plan, setPlan] = useState<string>('solo')

  useEffect(() => {
    setPlan(getPlan())
    const sync = () => setPlan(getPlan())
    window.addEventListener('plan-changed', sync)
    return () => window.removeEventListener('plan-changed', sync)
  }, [])

  const isActive = (tab: PageTab) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)

  return (
    <div
      className="flex items-center gap-1 px-6 pt-4 pb-0"
      style={{ borderBottom: '1px solid #E8ECF0' }}
    >
      {module && (
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em] mr-3 shrink-0"
          style={{ color: 'rgba(0,56,168,0.35)' }}
        >
          {module}
        </span>
      )}

      {tabs.map((tab) => {
        const active = isActive(tab)
        const locked = tab.teamsOnly && plan !== 'teams'

        if (locked) {
          return (
            <div
              key={tab.href}
              title={`${tab.label} — Teams only`}
              className="relative flex items-center gap-1.5 px-3 py-2 cursor-not-allowed select-none"
              style={{ color: 'rgba(0,56,168,0.3)' }}
            >
              <span className="text-[13px] font-medium">{tab.label}</span>
              <Lock size={11} weight="light" />
            </div>
          )
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="relative flex items-center gap-1.5 px-3 py-2 transition-colors group"
            style={{
              color: active ? '#0038A8' : 'rgba(0,56,168,0.5)',
              borderBottom: active ? '2px solid #0038A8' : '2px solid transparent',
              marginBottom: -1,
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#0038A8' }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(0,56,168,0.5)' }}
          >
            <span className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
              {tab.label}
            </span>
            {tab.badge != null && tab.badge > 0 && (
              <span
                className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                style={active
                  ? { background: 'rgba(0,56,168,0.12)', color: '#0038A8' }
                  : { background: '#F1F5F9', color: '#78889B' }
                }
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
