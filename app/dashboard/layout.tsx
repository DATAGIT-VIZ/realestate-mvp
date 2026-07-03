'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    // Read initial collapsed state to sync offset
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setSidebarCollapsed(stored === 'true')

    // Listen for storage changes from sidebar toggle
    const handler = () => {
      const v = localStorage.getItem('sidebar-collapsed')
      setSidebarCollapsed(v === 'true')
    }
    window.addEventListener('storage-sidebar', handler)

    // Auth check — disabled in dev, enable in prod
    // const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    //   if (!session) router.push('/login')
    //   setLoading(false)
    // })
    setLoading(false)

    return () => window.removeEventListener('storage-sidebar', handler)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar — desktop persistent, mobile drawer */}
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content — offset by sidebar width on desktop */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-[padding-left] duration-200 ease-out',
          // On desktop, offset by sidebar width
          sidebarCollapsed ? 'lg:pl-[60px]' : 'lg:pl-[220px]',
          // On mobile, add bottom padding for tab bar
          'pb-16 lg:pb-0'
        )}
      >
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="flex-1">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar />
    </div>
  )
}
