'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Building2,
  LayoutDashboard,
  Users,
  LogOut,
  Loader2,
  Menu,
  X,
  BarChart3,
  Calculator,
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/dashboard/leads', icon: Users },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Calculators', href: '/dashboard/calculators', icon: Calculator },
]

// Design tokens (matching analytics page)
const BG_SIDEBAR = '#080D18'
const BG_PANEL = '#0E1623'
const BORDER = 'rgba(255,255,255,0.06)'
const AMBER = '#F59E0B'
const TEXT = '#F1F5F9'
const MUTED = 'rgba(255,255,255,0.35)'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setUserEmail('demo@example.com')
    setLoading(false)
  }, [router])

  const handleLogout = async () => {
    alert('Login/Logout functionality is temporarily disabled')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG_SIDEBAR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: 28, height: 28, color: AMBER, animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080D18', display: 'flex' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(4px)' }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        style={{
          position: 'fixed', top: 0, left: 0, zIndex: 50, height: '100%', width: 220,
          background: BG_SIDEBAR,
          borderRight: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column',
          transform: sidebarOpen ? 'translateX(0)' : undefined,
          transition: 'transform 0.25s ease',
        }}
        className={`lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58, padding: '0 16px', borderBottom: `1px solid ${BORDER}` }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 style={{ width: 16, height: 16, color: '#000' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, letterSpacing: '-0.2px' }}>PropIQ</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
            className="lg:hidden"
          >
            <X style={{ width: 16, height: 16, color: MUTED }} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10,
                  textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? TEXT : MUTED,
                  background: active ? 'rgba(245,158,11,0.1)' : 'transparent',
                  borderLeft: active ? `2px solid ${AMBER}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <item.icon style={{ width: 16, height: 16, color: active ? AMBER : MUTED, flexShrink: 0 }} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div style={{ padding: 12, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: `1px solid rgba(245,158,11,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: AMBER }}>{userEmail?.charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: TEXT, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
                <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>Agent</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '7px 0', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              {loggingOut ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <LogOut style={{ width: 13, height: 13 }} />}
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, paddingLeft: 220 }} className="lg:pl-[220px]">
        {/* Mobile header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 16px', background: BG_SIDEBAR, borderBottom: `1px solid ${BORDER}` }} className="lg:hidden">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}>
            <Menu style={{ width: 20, height: 20, color: MUTED }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 style={{ width: 13, height: 13, color: '#000' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>PropIQ</span>
          </div>
          <div style={{ width: 32 }} />
        </header>

        <main>{children}</main>
      </div>
    </div>
  )
}
