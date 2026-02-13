'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // TEMPORARILY BYPASSING LOGIN - Go directly to dashboard
    router.push('/dashboard')
    
    // TODO: Re-enable login check when needed
    // const checkAuth = async () => {
    //   try {
    //     const { data: { session } } = await supabase.auth.getSession()
    //     if (session) {
    //       router.push('/dashboard')
    //     } else {
    //       router.push('/login')
    //     }
    //   } catch (error) {
    //     router.push('/login')
    //   }
    // }
    // checkAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 mb-4 animate-pulse">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <p className="text-slate-400 text-sm">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}
