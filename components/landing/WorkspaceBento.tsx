'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DashboardSquare01Icon,
  UserGroupIcon,
  Message01Icon,
  Folder02Icon,
  Add01Icon,
  CircleArrowUpRight02Icon,
  Search01Icon,
  BarChartIcon,
  Tick01Icon,
  Settings02Icon,
  InformationCircleIcon,
  DatabaseIcon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface TabConfig {
  id: string
  label: string
  icon: any
  badge?: string
  header: string
  description: string
}

const TABS: TabConfig[] = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: DashboardSquare01Icon,
    header: 'Lead Pipeline',
    description: 'Live view of every active enquiry.',
  },
  {
    id: 'team',
    label: 'Team',
    icon: UserGroupIcon,
    badge: '4',
    header: 'Agent Management',
    description: 'Assign leads and track agent workload.',
  },
  {
    id: 'followups',
    label: 'Follow-ups',
    icon: Message01Icon,
    badge: '7',
    header: 'Pending Follow-ups',
    description: 'Leads waiting for your next move.',
  },
  {
    id: 'portals',
    label: 'Portals',
    icon: Folder02Icon,
    header: 'Connected Portals',
    description: 'Synced feeds from all your sources.',
  },
]

export default function WorkspaceBento() {
  const [activeTab, setActiveTab] = useState(TABS[0])

  const content = useMemo(() => {
    switch (activeTab.id) {
      case 'pipeline':  return <PipelineView />
      case 'team':      return <TeamView />
      case 'followups': return <FollowUpsView />
      case 'portals':   return <PortalsView />
      default:          return null
    }
  }, [activeTab.id])

  return (
    <div className="w-full rounded-3xl overflow-hidden"
      style={{ background: 'white', border: '1.5px solid #E8ECF0', boxShadow: '0 12px 48px rgba(0,0,0,0.10)' }}>

      {/* Outer card header */}
      <div className="px-6 pt-6 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: '#A4B1BE' }}>
          Your workspace
        </p>
        <p className="text-[18px] font-extrabold leading-snug" style={{ color: '#1A1F27' }}>
          Not like other CRMs your team ignores.
        </p>
      </div>

      {/* CRM mockup — inset, fills the card */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden flex flex-col"
        style={{ border: '1.5px solid #E8ECF0', height: 380 }}>

        {/* Browser title bar */}
        <div className="px-5 py-3 flex items-center relative shrink-0"
          style={{ borderBottom: '1px solid #E8ECF0', background: '#FAFBFC' }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FDDCDC' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEF0C7' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#D1FAE5' }} />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#A4B1BE' }}>
              Lead Gap CRM CRM
            </span>
          </div>
        </div>

        {/* App layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <div className="shrink-0 flex flex-col pt-4 p-2 gap-0.5" style={{ width: 148, borderRight: '1px solid #E8ECF0', background: '#FAFBFC' }}>
            <LayoutGroup>
              {TABS.map((tab) => {
                const isActive = activeTab.id === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab)}
                    className="relative flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors"
                    style={{ color: isActive ? '#263238' : '#78889B' }}
                  >
                    <HugeiconsIcon icon={tab.icon} size={13} className="z-20 shrink-0 relative" />
                    <span className="truncate z-20 relative font-semibold text-[11px]">{tab.label}</span>
                    {tab.badge && (
                      <span className="ml-auto text-[8px] leading-none py-0.5 px-1.5 rounded-md tabular-nums z-20 relative"
                        style={isActive
                          ? { background: 'rgba(0,71,171,0.08)', color: '#0047AB', border: '1px solid rgba(0,71,171,0.18)' }
                          : { background: '#F0F3F7', color: '#78889B' }
                        }>
                        {tab.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div layoutId="sidebar-pill"
                        className="absolute left-0 w-[2.5px] h-5 rounded-full z-30"
                        style={{ background: '#0047AB' }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    {isActive && (
                      <motion.div layoutId="bg-pill"
                        className="absolute inset-0 rounded-xl z-10"
                        style={{ background: '#F0F3F7' }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                  </button>
                )
              })}
            </LayoutGroup>
          </div>

          {/* Content panel */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'white' }}>
            {/* Panel header */}
            <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F5F6FA' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#A4B1BE' }}>
                {activeTab.header}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: '#78889B' }}>
                {activeTab.description}
              </p>
            </div>

            {/* Animated content */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeTab.id}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-0 overflow-hidden"
                >
                  {content}
                </motion.div>
              </AnimatePresence>
              {/* Fade out at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-10"
                style={{ background: 'linear-gradient(to top, white, transparent)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Tab panels ──────────────────────────────────────────────────────────── */

function PipelineView() {
  return (
    <div className="p-5 flex flex-col gap-3 h-full">
      <div className="p-4 rounded-xl flex flex-col gap-2.5" style={{ background: '#FAFBFC', border: '1px solid #E8ECF0' }}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#78889B' }}>Monthly Pipeline</span>
          <HugeiconsIcon icon={CircleArrowUpRight02Icon} size={12} style={{ color: '#0047AB' }} />
        </div>
        <span className="text-2xl font-extrabold tracking-tight" style={{ color: '#0047AB' }}>₹8.4 Cr</span>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E8ECF0' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: '72%' }} transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full" style={{ background: '#0047AB' }} />
        </div>
        <span className="text-[9px]" style={{ color: '#78889B' }}>72% of monthly target · 14 active leads</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Hot',          value: '14', color: '#0047AB' },
          { label: 'Warm',         value: '9',  color: '#F59E0B' },
          { label: 'Unresponded',  value: '3',  color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl flex flex-col gap-1" style={{ background: '#FAFBFC', border: '1px solid #E8ECF0' }}>
            <span className="text-[14px] font-extrabold" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[8px] font-semibold uppercase" style={{ color: '#A4B1BE' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {[
          { name: 'Rajesh Sharma', src: '99acres',     budget: '₹1.2 Cr', hot: true  },
          { name: 'Priya Mehta',   src: 'MagicBricks', budget: '₹85 L',   hot: false },
          { name: 'Vikram Singh',  src: 'Housing.com', budget: '₹2.1 Cr', hot: true  },
        ].map((l, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: '#FAFBFC', border: '1px solid #E8ECF0' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
              style={{ background: '#0038A8' }}>
              {l.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold truncate" style={{ color: '#263238' }}>{l.name}</div>
              <div className="text-[8px]" style={{ color: '#A4B1BE' }}>{l.src}</div>
            </div>
            <div className="text-[10px] font-bold shrink-0" style={{ color: '#263238' }}>{l.budget}</div>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: l.hot ? '#0047AB' : '#F59E0B' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamView() {
  const agents = [
    { name: 'Priya Mehta',   role: 'Senior agent · 6 leads',  status: 'active' },
    { name: 'Arjun Patel',   role: 'Agent · 4 leads',         status: 'active' },
    { name: 'Sneha Kapoor',  role: 'Agent · 2 leads',         status: 'idle'   },
    { name: 'Rohan Gupta',   role: 'Agent · 5 leads',         status: 'active' },
  ]
  return (
    <div className="p-4 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#78889B' }}>4 agents active</span>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: '#FAFBFC', border: '1px solid #E8ECF0' }}>
          <HugeiconsIcon icon={Search01Icon} size={9} style={{ color: '#A4B1BE' }} />
          <span className="text-[8px]" style={{ color: '#A4B1BE' }}>Search</span>
        </div>
      </div>
      {agents.map((a, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors"
          style={{ background: '#FAFBFC', border: '1px solid #E8ECF0' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center relative shrink-0"
            style={{ background: '#F0F3F7', border: '1px solid #E8ECF0' }}>
            <HugeiconsIcon icon={UserIcon} size={11} style={{ color: '#78889B' }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: a.status === 'active' ? '#059669' : '#F59E0B', border: '2px solid white' }} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[11px] font-semibold truncate" style={{ color: '#263238' }}>{a.name}</span>
            <span className="text-[8px] truncate" style={{ color: '#78889B' }}>{a.role}</span>
          </div>
          <HugeiconsIcon icon={Settings02Icon} size={12} style={{ color: '#A4B1BE', opacity: 0 }} className="group-hover:opacity-100 transition-opacity" />
        </div>
      ))}
    </div>
  )
}

function FollowUpsView() {
  const items = [
    { name: 'Rajesh Sharma', due: 'Due now',      urgency: '#EF4444' },
    { name: 'Anjali Malik',  due: 'Due in 2h',    urgency: '#F59E0B' },
    { name: 'Vikram Singh',  due: 'Due at 5 PM',  urgency: '#78889B' },
    { name: 'Sneha Kapoor',  due: 'Tomorrow',     urgency: '#78889B' },
  ]
  return (
    <div className="p-4 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#78889B' }}>7 follow-ups pending</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: '#FAFBFC', border: '1px solid #E8ECF0' }}>
          <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: item.urgency }} />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[11px] font-semibold truncate" style={{ color: '#263238' }}>{item.name}</span>
            <span className="text-[8px] font-semibold" style={{ color: item.urgency }}>{item.due}</span>
          </div>
          <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold shrink-0"
            style={{ background: '#F0F3F7', color: '#263238' }}>
            <HugeiconsIcon icon={Add01Icon} size={7} />
            Call
          </button>
        </div>
      ))}
      <div className="mt-auto p-3 rounded-xl flex items-center justify-between"
        style={{ background: 'rgba(0,71,171,0.05)', border: '1px solid rgba(0,71,171,0.15)' }}>
        <span className="text-[9px] font-medium" style={{ color: '#263238' }}>3 more due today</span>
        <HugeiconsIcon icon={CircleArrowUpRight02Icon} size={11} style={{ color: '#0047AB' }} />
      </div>
    </div>
  )
}

function PortalsView() {
  const portals = [
    { name: '99acres',     newCount: 8,  color: '#B91C1C' },
    { name: 'MagicBricks', newCount: 5,  color: '#1D4ED8' },
    { name: 'Housing.com', newCount: 3,  color: '#047857' },
    { name: 'NoBroker',    newCount: 2,  color: '#6D28D9' },
    { name: 'PropTiger',   newCount: 1,  color: '#0038A8' },
  ]
  return (
    <div className="p-4 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#78889B' }}>5 portals synced</span>
        <HugeiconsIcon icon={DatabaseIcon} size={11} style={{ color: '#A4B1BE' }} />
      </div>
      {portals.map((p, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
          style={{ background: '#FAFBFC', border: '1px solid #E8ECF0' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${p.color}14`, border: `1px solid ${p.color}30` }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[11px] font-semibold truncate" style={{ color: '#263238' }}>{p.name}</span>
            <span className="text-[8px] uppercase" style={{ color: '#A4B1BE' }}>Live sync</span>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: '#FEE2E2', color: '#DC2626' }}>
            {p.newCount} new
          </span>
        </div>
      ))}
    </div>
  )
}
