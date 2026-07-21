'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Cell,
} from 'recharts'

const INFLOW = [
  { v: 8 }, { v: 14 }, { v: 11 }, { v: 19 }, { v: 16 }, { v: 22 }, { v: 17 },
]
const SOURCES = [
  { name: '99acres', pct: 42 },
  { name: 'MagicBricks', pct: 38 },
  { name: 'Housing', pct: 29 },
]
const LEADS = [
  { init: 'RS', name: 'Rajesh Sharma', budget: '₹1.2 Cr', status: 'Hot' },
  { init: 'PM', name: 'Priya Mehta',   budget: '₹85 L',   status: 'Warm' },
  { init: 'VS', name: 'Vikram Singh',  budget: '₹2.1 Cr', status: 'Hot' },
]

const SATELLITES = [
  { id: 'tl', label: '⚡ 24 leads synced',       delay: '0s',    style: { top: 28,  left: 0   } },
  { id: 'tr', label: '🔒 Workspace isolated',    delay: '1.2s',  style: { top: 28,  right: 0  } },
  { id: 'bl', label: '🤖 AI scored 3 leads',     delay: '2.1s',  style: { bottom: 32, left: 0 } },
  { id: 'br', label: '✅ 2 deals closing today', delay: '3s',    style: { bottom: 32, right: 0 } },
]

/* SVG connecting lines — coords relative to the 680×460 container */
function ConnectorLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 680 460"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <style>{`
          @keyframes dash-flow {
            from { stroke-dashoffset: 20; }
            to   { stroke-dashoffset: 0; }
          }
          .connector { animation: dash-flow 1.2s linear infinite; }
        `}</style>
      </defs>
      {/* TL pill → card top-left */}
      <line x1="148" y1="42"  x2="196" y2="102" stroke="#FF7043" strokeWidth="1.5" strokeDasharray="4 4" className="connector" />
      <circle cx="148" cy="42"  r="4" fill="#FF7043" opacity="0.6" />
      <circle cx="196" cy="102" r="4" fill="#FF7043" opacity="0.6" />
      {/* TR pill → card top-right */}
      <line x1="532" y1="42"  x2="488" y2="102" stroke="#2E66F6" strokeWidth="1.5" strokeDasharray="4 4" className="connector" style={{ animationDelay: '0.4s' }} />
      <circle cx="532" cy="42"  r="4" fill="#2E66F6" opacity="0.6" />
      <circle cx="488" cy="102" r="4" fill="#2E66F6" opacity="0.6" />
      {/* BL pill → card bottom-left */}
      <line x1="148" y1="418" x2="196" y2="362" stroke="#059669" strokeWidth="1.5" strokeDasharray="4 4" className="connector" style={{ animationDelay: '0.8s' }} />
      <circle cx="148" cy="418" r="4" fill="#059669" opacity="0.6" />
      <circle cx="196" cy="362" r="4" fill="#059669" opacity="0.6" />
      {/* BR pill → card bottom-right */}
      <line x1="532" y1="418" x2="488" y2="362" stroke="#9333EA" strokeWidth="1.5" strokeDasharray="4 4" className="connector" style={{ animationDelay: '1.2s' }} />
      <circle cx="532" cy="418" r="4" fill="#9333EA" opacity="0.6" />
      <circle cx="488" cy="362" r="4" fill="#9333EA" opacity="0.6" />
    </svg>
  )
}

/* Main dashboard card */
function DashboardCard({ pipeline }: { pipeline: number }) {
  return (
    <div
      className="absolute rounded-3xl overflow-hidden"
      style={{
        left: '28%', right: '28%',
        top: 60, bottom: 60,
        background: 'white',
        border: '1px solid #E8ECF0',
        boxShadow: '0 32px 80px rgba(0,0,0,0.12)',
      }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid #F0F3F7', background: '#FAFBFC' }}>
        <div>
          <div className="text-[10px] font-bold text-[#A4B1BE] uppercase tracking-widest">Monthly Pipeline</div>
          <div className="text-[26px] font-extrabold text-[#1A1F27] leading-tight" style={{ color: '#FF7043' }}>
            ₹{pipeline.toFixed(1)} Cr
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-600"
          style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-0" style={{ borderBottom: '1px solid #F0F3F7' }}>
        {/* Line chart */}
        <div className="p-3" style={{ borderRight: '1px solid #F0F3F7' }}>
          <div className="text-[9px] font-bold text-[#A4B1BE] uppercase tracking-wider mb-1.5">Lead Inflow</div>
          <div style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INFLOW} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id="fd-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF7043" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#FF7043" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#FF7043" strokeWidth={2} fill="url(#fd-area)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Bar chart */}
        <div className="p-3">
          <div className="text-[9px] font-bold text-[#A4B1BE] uppercase tracking-wider mb-1.5">By Source</div>
          <div style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SOURCES} margin={{ top: 2, right: 2, left: 2, bottom: 2 }} barSize={12}>
                <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                  {SOURCES.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#FF7043' : i === 1 ? '#2E66F6' : '#059669'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lead rows */}
      <div className="flex flex-col">
        {LEADS.map((lead, i) => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-2.5"
            style={{ borderBottom: i < LEADS.length - 1 ? '1px solid #F8FAFB' : 'none' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#FF7043,#2E66F6)' }}>
              {lead.init}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-[#263238] truncate">{lead.name}</div>
            </div>
            <div className="text-[11px] font-bold text-[#1A1F27] shrink-0">{lead.budget}</div>
            <div className="px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0"
              style={lead.status === 'Hot'
                ? { background: 'rgba(255,112,67,0.1)', color: '#FF7043' }
                : { background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
              {lead.status === 'Hot' ? '🔥' : '🌡'} {lead.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Full section */
export default function FloatingDashboard() {
  const [pipeline, setPipeline] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.2 })
    const el = document.getElementById('fd-root')
    if (el) obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let frame: number
    const start = performance.now()
    const dur = 1600
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setPipeline(parseFloat((ease * 8.4).toFixed(1)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visible])

  return (
    <section id="fd-root" className="py-24 overflow-hidden" style={{ background: '#FAFBFC' }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Label */}
        <div className="text-center mb-12">
          <p className="text-[12px] font-bold text-[#A4B1BE] uppercase tracking-[0.16em]">
            Everything in one view
          </p>
          <h2 className="text-[36px] md:text-[44px] font-extrabold text-[#1A1F27] leading-tight tracking-tight mt-3">
            Your entire pipeline,<br className="hidden md:block" /> live on one screen
          </h2>
        </div>

        {/* Illustration container */}
        <div className="relative mx-auto" style={{ maxWidth: 680, height: 460 }}>
          <ConnectorLines />

          {/* Central card */}
          <div
            className="lp-float"
            style={{ position: 'absolute', inset: 0, animationDuration: '7s' }}
          >
            <DashboardCard pipeline={pipeline} />
          </div>

          {/* Satellite pills */}
          {SATELLITES.map((sat) => (
            <div
              key={sat.id}
              className="absolute lp-float"
              style={{
                ...sat.style,
                animationDelay: sat.delay,
                animationDuration: `${4.5 + parseFloat(sat.delay) * 0.4}s`,
              }}
            >
              <div
                className="px-4 py-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap shadow-lg"
                style={{
                  background: 'white',
                  border: '1px solid #E8ECF0',
                  color: '#263238',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                }}
              >
                {sat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
