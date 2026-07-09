'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { AddLeadModal } from '@/components/AddLeadModal'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setSidebarCollapsed(stored === 'true')

    const handler = (e: Event) => setSidebarCollapsed((e as CustomEvent<boolean>).detail)
    window.addEventListener('sidebar-collapsed-change', handler)

    setLoading(false)

    return () => window.removeEventListener('sidebar-collapsed-change', handler)
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
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div
        className={cn(
          'flex flex-col min-h-screen transition-[padding-left] duration-200 ease-out',
          sidebarCollapsed ? 'lg:pl-[60px]' : 'lg:pl-[220px]',
          'pb-16 lg:pb-0'
        )}
      >
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onNewLead={() => setShowAddLead(true)}
        />

        <main className="flex-1">{children}</main>
      </div>

      <MobileTabBar />

      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onSuccess={() => setShowAddLead(false)}
        />
      )}
    </div>
  )
}
