'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { LayoutDashboard, Users, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [leadsCount, setLeadsCount] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
        
        // Fetch leads count
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', session.user.id)
        
        setLeadsCount(count || 0)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Welcome Card */}
      <div className="relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl mb-8">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/20">
            <LayoutDashboard className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Here&apos;s an overview of your real estate business.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link 
          href="/dashboard/leads"
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl p-5 hover:bg-slate-800/50 hover:border-slate-700 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/20">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">View all →</span>
          </div>
          <p className="text-3xl font-bold text-white">{leadsCount}</p>
          <p className="text-sm text-slate-400 mt-1">Total Leads</p>
        </Link>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20 mb-3">
            <TrendingUp className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white">0</p>
          <p className="text-sm text-slate-400 mt-1">Active Deals</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 mb-3">
            <Clock className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">0</p>
          <p className="text-sm text-slate-400 mt-1">Pending Tasks</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/20 mb-3">
            <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-white">$0</p>
          <p className="text-sm text-slate-400 mt-1">Revenue MTD</p>
        </div>
      </div>

      {/* Getting Started Section */}
      <div className="relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-white mb-4">Getting Started</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-xs font-bold">✓</span>
            </div>
            <span className="text-sm">Create your account</span>
          </div>
          <Link 
            href="/dashboard/leads"
            className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${leadsCount > 0 ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
              <span className={`text-xs font-bold ${leadsCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {leadsCount > 0 ? '✓' : '2'}
              </span>
            </div>
            <span className="text-sm group-hover:text-emerald-400 transition-colors">
              {leadsCount > 0 ? 'Add your first lead' : 'Add your first lead →'}
            </span>
          </Link>
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
              <span className="text-slate-500 text-xs font-bold">3</span>
            </div>
            <span className="text-sm">Track lead activities</span>
          </div>
        </div>
      </div>
    </div>
  )
}
