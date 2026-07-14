'use client'

import { useEffect, useState, useCallback } from 'react'
import { Building2, Plus, Search, Loader2, Edit2, Trash2, X, Check, MapPin, RefreshCw, Sparkles } from 'lucide-react'
import type { Property } from '@/app/api/crm/properties/route'

const C = {
  bg:      '#F8FAFC',
  panel:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  muted:   '#64748B',
  label:   '#94A3B8',
  blue:    '#a000c8',
  emerald: '#059669',
  amber:   '#be2ed6',
  red:     '#EF4444',
}

const STATUS_META = {
  Available:     { color: C.emerald, bg: 'rgba(5,150,105,0.08)'  },
  'Under Offer': { color: C.amber,   bg: 'rgba(190,46,214,0.08)'  },
  Sold:          { color: C.muted,   bg: 'rgba(100,116,139,0.08)' },
}

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Row House', 'Plot', 'Commercial', 'Studio']

function formatINR(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
type FormData = Partial<Omit<Property, 'id' | 'created_at' | 'updated_at'>>

const BLANK: FormData = {
  title: '', type: 'Apartment', city: '', locality: '',
  price: undefined, bedrooms: undefined, area_sqft: undefined,
  developer: '', rera_number: '', description: '',
  status: 'Available',
}

function PropertyFormModal({
  initial, onSave, onClose, saving,
}: {
  initial: FormData
  onSave: (d: FormData) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<FormData>(initial)
  const set = (k: keyof FormData, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const field = (label: string, key: keyof FormData, opts?: { type?: string; placeholder?: string; half?: boolean }) => (
    <div style={{ gridColumn: opts?.half ? 'span 1' : 'span 2' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={(form[key] as string | number | undefined) ?? ''}
        onChange={e => set(key, opts?.type === 'number' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value)}
        placeholder={opts?.placeholder}
        style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, width: 'min(560px, calc(100vw - 32px))', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{initial.title ? 'Edit Property' : 'Add Property'}</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Title — full width */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title *</label>
              <input value={form.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Prestige Lakeside Habitat 3BHK"
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Type */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
              <select value={form.type ?? 'Apartment'} onChange={e => set('type', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.text, outline: 'none', background: C.panel }}>
                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</label>
              <select value={form.status ?? 'Available'} onChange={e => set('status', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.text, outline: 'none', background: C.panel }}>
                <option>Available</option>
                <option>Under Offer</option>
                <option>Sold</option>
              </select>
            </div>

            {field('City', 'city', { placeholder: 'e.g. Pune', half: true })}
            {field('Locality', 'locality', { placeholder: 'e.g. Baner', half: true })}
            {field('Price (₹) *', 'price', { type: 'number', placeholder: '7500000', half: true })}
            {field('Area (sqft)', 'area_sqft', { type: 'number', placeholder: '1200', half: true })}
            {field('Bedrooms', 'bedrooms', { type: 'number', placeholder: '2', half: true })}
            {field('Bathrooms', 'bathrooms', { type: 'number', placeholder: '2', half: true })}
            {field('Developer', 'developer', { placeholder: 'e.g. Prestige Group', half: true })}
            {field('RERA Number', 'rera_number', { placeholder: 'P51900XXXXX', half: true })}

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
              <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)}
                placeholder="Key highlights, USPs, nearby landmarks…"
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.text, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ flex: '0 0 auto', padding: '11px 20px', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => onSave(form)} disabled={saving || !form.title || !form.price}
              style={{ flex: 1, padding: '11px 0', background: saving || !form.title || !form.price ? '#E2E8F0' : C.blue, border: 'none', borderRadius: 10, color: saving || !form.title || !form.price ? C.label : '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !form.title || !form.price ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {saving ? 'Saving…' : <><Check style={{ width: 14, height: 14 }} /> Save Property</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm]     = useState(false)
  const [editProp, setEditProp]     = useState<Property | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [seeding, setSeeding]       = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch('/api/crm/properties?limit=200')
      const json = await res.json()
      setProperties(json.data?.properties ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (form: FormData) => {
    setSaving(true)
    try {
      const url    = editProp ? `/api/crm/properties/${editProp.id}` : '/api/crm/properties'
      const method = editProp ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json   = await res.json()
      if (json.error) throw new Error(json.error)
      setShowForm(false)
      setEditProp(null)
      fetchData()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleSeedDemo = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed/properties', { method: 'POST' })
      if (!res.ok) throw new Error('Seed failed')
      await fetchData()
    } catch (e) { console.error(e) }
    finally { setSeeding(false) }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/crm/properties/${id}`, { method: 'DELETE' })
    setDeleteId(null)
    fetchData()
  }

  const filtered = properties.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || p.title.toLowerCase().includes(q) || (p.city ?? '').toLowerCase().includes(q) || (p.locality ?? '').toLowerCase().includes(q)
    const matchS = statusFilter === 'all' || p.status === statusFilter
    return matchQ && matchS
  })

  const counts = {
    available:   properties.filter(p => p.status === 'Available').length,
    underOffer:  properties.filter(p => p.status === 'Under Offer').length,
    sold:        properties.filter(p => p.status === 'Sold').length,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 style={{ width: 22, height: 22, color: C.blue, animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14, color: C.muted }}>Loading properties…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div className="max-w-[1200px] mx-auto px-4 pb-20 lg:px-6">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 18px', borderBottom: `1px solid ${C.border}`, marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 className="hidden lg:block" style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Properties</h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
              {counts.available} available · {counts.underOffer} under offer · {counts.sold} sold
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setRefreshing(true); fetchData() }}
              style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer' }}>
              <RefreshCw style={{ width: 15, height: 15, color: C.muted, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button onClick={() => { setEditProp(null); setShowForm(true) }}
              style={{ padding: '9px 18px', background: C.blue, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus style={{ width: 14, height: 14 }} /> Add Property
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px' }}>
            <Search style={{ width: 14, height: 14, color: C.label, flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title, city, locality…"
              style={{ border: 'none', outline: 'none', fontSize: 13, color: C.text, background: 'transparent', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
            {['all', 'Available', 'Under Offer', 'Sold'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: statusFilter === s ? C.blue : 'transparent', color: statusFilter === s ? '#fff' : C.muted, transition: 'all 0.15s' }}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,#a000c815,#7600bc15)', border: '1px solid #a000c820', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Building2 style={{ width: 28, height: 28, color: '#a000c8' }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
              {properties.length === 0 ? 'No properties yet' : 'No results found'}
            </h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              {properties.length === 0
                ? 'Add your property inventory so agents can match leads to the right listings instantly.'
                : 'Try adjusting your search or filters.'}
            </p>
            {properties.length === 0 && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleSeedDemo} disabled={seeding}
                  style={{ padding: '11px 22px', background: 'linear-gradient(135deg,#a000c8,#7600bc)', border: 'none', borderRadius: 11, color: '#fff', fontSize: 13, fontWeight: 700, cursor: seeding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: seeding ? 0.7 : 1, boxShadow: '0 2px 12px rgba(160,0,200,0.3)' }}>
                  {seeding ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
                  {seeding ? 'Loading Demo Data…' : 'Load Demo Properties'}
                </button>
                <button onClick={() => setShowForm(true)}
                  style={{ padding: '11px 22px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Plus style={{ width: 14, height: 14 }} /> Add Manually
                </button>
              </div>
            )}
          </div>
        )}

        {/* Property grid */}
        {filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filtered.map(p => {
              const sm = STATUS_META[p.status] ?? STATUS_META.Available
              return (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>

                  {/* Card header */}
                  <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3 }}>{p.title}</p>
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: sm.color, background: sm.bg, padding: '3px 8px', borderRadius: 20 }}>{p.status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin style={{ width: 11, height: 11, color: C.label, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: C.muted }}>{[p.locality, p.city].filter(Boolean).join(', ') || '—'}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ padding: '12px 18px', display: 'flex', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 11, color: C.label, margin: '0 0 2px' }}>Price</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{formatINR(p.price)}</p>
                    </div>
                    {p.bedrooms && (
                      <div>
                        <p style={{ fontSize: 11, color: C.label, margin: '0 0 2px' }}>Config</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{p.bedrooms}BHK {p.type ?? ''}</p>
                      </div>
                    )}
                    {p.area_sqft && (
                      <div>
                        <p style={{ fontSize: 11, color: C.label, margin: '0 0 2px' }}>Area</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{p.area_sqft.toLocaleString()} sqft</p>
                      </div>
                    )}
                  </div>

                  {p.description && (
                    <div style={{ padding: '0 18px 12px' }}>
                      <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.description}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditProp(p); setShowForm(true) }}
                      style={{ flex: 1, padding: '7px 0', background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <Edit2 style={{ width: 11, height: 11 }} /> Edit
                    </button>
                    <button onClick={() => setDeleteId(p.id)}
                      style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, fontSize: 12, color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Trash2 style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <PropertyFormModal
          initial={editProp ?? BLANK}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditProp(null) }}
          saving={saving}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div style={{ background: C.panel, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, width: 360, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 style={{ width: 20, height: 20, color: C.red }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Delete Property?</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px 0', background: '#F1F5F9', border: 'none', borderRadius: 10, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: '10px 0', background: C.red, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
