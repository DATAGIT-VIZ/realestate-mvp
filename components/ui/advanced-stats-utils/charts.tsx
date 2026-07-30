'use client'
import React from 'react'
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts'

const REVENUE_DATA = [
  { month: 'Jan', revenue: 62 },
  { month: 'Feb', revenue: 78 },
  { month: 'Mar', revenue: 71 },
  { month: 'Apr', revenue: 95 },
  { month: 'May', revenue: 112 },
  { month: 'Jun', revenue: 134 },
  { month: 'Jul', revenue: 158 },
  { month: 'Aug', revenue: 142 },
  { month: 'Sep', revenue: 175 },
  { month: 'Oct', revenue: 198 },
  { month: 'Nov', revenue: 221 },
  { month: 'Dec', revenue: 240 },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900">₹{payload[0].value}L</p>
      <p className="text-zinc-400">{label}</p>
    </div>
  )
}

export function ClippedAreaChart() {
  return (
    <div className="w-full h-full">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 mb-1">Monthly Revenue</p>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-black tracking-tight text-zinc-900">₹2.4 Cr</span>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+12.5%</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <AreaChart data={REVENUE_DATA} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0047AB" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#0047AB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 9, fill: '#A1A1AA' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#0047AB"
            strokeWidth={2}
            fill="url(#revGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#0047AB', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
