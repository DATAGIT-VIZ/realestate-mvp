'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LandingPage from '@/components/landing/LandingPage'

export default function Home() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/dashboard')
      } else {
        setReady(true)
      }
    }).catch(() => setReady(true))
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F6FA' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#FF7043] border-t-transparent animate-spin" />
      </div>
    )
  }

  return <LandingPage />
}
