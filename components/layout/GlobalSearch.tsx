'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowRight, User } from 'lucide-react'

type Lead = {
  id: string
  leadPortalId: string | null
  name: { firstName: string; lastName: string }
  phones: { primaryPhoneNumber: string }
  city: string | null
  status: string
  intentScore: number
}

const STATUS_COLOR: Record<string, string> = {
  Fresh: 'bg-blue-50 text-blue-600',
  Attempting: 'bg-amber-50 text-amber-600',
  Connected: 'bg-green-50 text-green-600',
  'VM Done': 'bg-slate-100 text-slate-500',
  'Virtual Meeting': 'bg-purple-50 text-purple-600',
  'Site Visit': 'bg-indigo-50 text-indigo-600',
  Negotiation: 'bg-orange-50 text-orange-600',
  Won: 'bg-emerald-50 text-emerald-700',
  Lost: 'bg-red-50 text-red-500',
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/leads?search=${encodeURIComponent(q)}&limit=8`)
      const json = await res.json()
      setResults(json.data?.leads ?? [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { setSelected(s => Math.min(s + 1, results.length - 1)); e.preventDefault() }
      if (e.key === 'ArrowUp')   { setSelected(s => Math.max(s - 1, 0)); e.preventDefault() }
      if (e.key === 'Enter' && results[selected]) { go(results[selected]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, selected, onClose])

  function go(lead: Lead) {
    onClose()
    router.push(`/dashboard/leads/${lead.id}`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200 overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search leads by name, phone, or CS ID…"
            className="flex-1 text-[14px] text-slate-800 placeholder:text-slate-400 bg-transparent outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-medium">ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="py-1.5 max-h-80 overflow-y-auto">
            {results.map((lead, i) => (
              <li key={lead.id}>
                <button
                  onClick={() => go(lead)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-800 truncate">
                        {lead.name.firstName} {lead.name.lastName}
                      </span>
                      {lead.leadPortalId && (
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">{lead.leadPortalId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400 truncate">{lead.phones.primaryPhoneNumber}</span>
                      {lead.city && <span className="text-[11px] text-slate-300">·</span>}
                      {lead.city && <span className="text-[11px] text-slate-400">{lead.city}</span>}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[lead.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {lead.status}
                  </span>
                  {i === selected && <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {query && !loading && results.length === 0 && (
          <div className="py-8 text-center text-[13px] text-slate-400">No leads found for &quot;{query}&quot;</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-8 text-center text-[13px] text-slate-400">Searching…</div>
        )}

        {/* Hint when empty query */}
        {!query && (
          <div className="px-4 py-3 flex items-center gap-4 text-[11px] text-slate-400">
            <span><kbd className="bg-slate-100 border border-slate-200 rounded px-1 py-0.5 font-medium">↑↓</kbd> navigate</span>
            <span><kbd className="bg-slate-100 border border-slate-200 rounded px-1 py-0.5 font-medium">↵</kbd> open</span>
            <span><kbd className="bg-slate-100 border border-slate-200 rounded px-1 py-0.5 font-medium">ESC</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  )
}
