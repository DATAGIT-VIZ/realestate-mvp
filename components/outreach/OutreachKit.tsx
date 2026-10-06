'use client'

// Shared look for the Outreach pages (Broadcast, Sequences, Power Dialer).
// Same tokens, pills, cards and buttons as the Leads and Pipeline pages.

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import Link from 'next/link'
import {
  CaretLeft, CaretDown, Check, X, Lightbulb, Globe, FacebookLogo, GoogleLogo, Handshake, Megaphone,
  Checks,
} from '@phosphor-icons/react'
import { type CRMLead } from '@/lib/twenty'

export const OUTREACH_TABS = [
  { label: 'Broadcast',    href: '/dashboard/outreach/broadcast' },
  { label: 'Sequences',    href: '/dashboard/outreach/sequences' },
  { label: 'Power Dialer', href: '/dashboard/calls' },
]

// ─── Design tokens (shared with the Leads and Pipeline pages) ─────────────────
export const CANVAS   = '#FFFFFF'
export const SURFACE  = '#F9FAFB'
export const BORDER   = '#EAECF0'
export const BORDER_2 = '#D0D5DD'
export const TEXT     = '#101828'
export const TEXT_2   = '#344054'
export const MUTED    = '#475467'
export const SUBTLE   = '#667085'
export const LABEL    = '#98A2B3'
export const BLUE     = '#1D4ED8'
export const BLUE_BG  = '#EFF4FF'
export const BLUE_LN  = '#B2CCFF'
export const GREEN    = '#17B26A'
export const GREEN_D  = '#079455'
export const RED      = '#F04438'
export const WA       = '#25D366'
export const XS       = '0 1px 2px rgba(16,24,40,0.05)'
export const MONO     = 'ui-monospace, SFMono-Regular, Menlo, monospace'
export const DAY      = 86_400_000
export const HOUR     = 3_600_000

// ─── Stages (LIFECYCLE_SPEC §2) ───────────────────────────────────────────────
export type StageId = 'New' | 'Cold' | 'Warm' | 'Hot' | 'Closed' | 'Disqualified' | 'Hold'
type StageDef = { label: string; meaning: string; color: string; bg: string; border: string; dot: string }
export const STAGE: Record<StageId, StageDef> = {
  New:          { label: 'New',          meaning: 'Not contacted yet',       color: '#344054', bg: '#F9FAFB', border: '#D0D5DD', dot: '#98A2B3' },
  Cold:         { label: 'Cold',         meaning: 'Contact attempted',       color: '#026AA2', bg: '#F0F9FF', border: '#B9E6FE', dot: '#0BA5EC' },
  Warm:         { label: 'Warm',         meaning: 'Requirements confirmed',  color: '#B54708', bg: '#FFFAEB', border: '#FEDF89', dot: '#F79009' },
  Hot:          { label: 'Hot',          meaning: 'EOI received',            color: '#C4320A', bg: '#FFF6ED', border: '#F9DBAF', dot: '#EF6820' },
  Closed:       { label: 'Closed',       meaning: 'Deal done',               color: '#067647', bg: '#ECFDF3', border: '#ABEFC6', dot: '#17B26A' },
  Disqualified: { label: 'Disqualified', meaning: 'Dropped or unreachable',  color: '#C01048', bg: '#FFF1F3', border: '#FECDD6', dot: '#F63D68' },
  Hold:         { label: 'On hold',      meaning: 'Paused until a set date', color: '#5925DC', bg: '#F4F3FF', border: '#D9D6FE', dot: '#7A5AF8' },
}
const LEGACY: Record<string, StageId> = {
  fresh: 'New', attempting: 'Cold', 'vm done': 'Cold', connected: 'Warm', 'virtual meeting': 'Warm',
  'site visit': 'Hot', negotiation: 'Hot', won: 'Closed', lost: 'Disqualified', nc: 'Disqualified', 'on hold': 'Hold',
}
export function stageOf(status: string | null | undefined): StageId {
  const k = (status ?? 'New').trim().toLowerCase()
  return (Object.keys(STAGE) as StageId[]).find(id => id.toLowerCase() === k) ?? LEGACY[k] ?? 'New'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const displayName = (l: CRMLead) => `${l.name?.firstName ?? ''} ${l.name?.lastName ?? ''}`.trim() || 'Unnamed'
export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
export const dealValue = (l: CRMLead) => l.budgetMax ?? l.budgetMin ?? 0
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/** Ten-digit Indian mobile, or null when the number can't be dialled */
export function phone10(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) return d.slice(2)
  if (d.length === 11 && d.startsWith('0')) return d.slice(1)
  return d.length === 10 ? d : null
}
export function formatPhone(raw: string | null | undefined) {
  const n = phone10(raw)
  return n ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : (raw || '—')
}
export const telHref = (raw: string | null | undefined) => `tel:+91${phone10(raw) ?? ''}`
export const waHref = (raw: string | null | undefined, text?: string) =>
  `https://wa.me/91${phone10(raw) ?? ''}${text ? `?text=${encodeURIComponent(text)}` : ''}`

/** Stable CS ID: real one if assigned, else derived from the UUID (same rule as the Leads pages) */
export function getCsId(lead: Pick<CRMLead, 'id' | 'leadPortalId'>): string {
  if (lead.leadPortalId?.startsWith('CS')) return lead.leadPortalId
  const hex = lead.id.replace(/-/g, '')
  let n = 0
  for (const c of hex) n = (n * 31 + parseInt(c, 16)) % 100000
  return `CS${String(n).padStart(5, '0')}`
}

/** ₹ in lakh / crore, the way Indian real estate reads it */
export function inr(n: number) {
  if (!n) return '₹0'
  const fx = (x: number) => (x >= 100 ? Math.round(x).toLocaleString('en-IN') : String(+x.toFixed(1)))
  if (n >= 1e7) return `₹${fx(n / 1e7)} Cr`
  if (n >= 1e5) return `₹${fx(n / 1e5)} L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
export function budgetText(min?: number | null, max?: number | null) {
  if (min && max) return min === max ? inr(max) : `${inr(min)} – ${inr(max)}`
  if (max) return `Up to ${inr(max)}`
  if (min) return `From ${inr(min)}`
  return null
}
export function durLong(ms: number) {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (ms < HOUR) return plural(Math.max(1, Math.round(ms / 60_000)), 'minute')
  if (ms < 2 * DAY) return plural(Math.round(ms / HOUR), 'hour')
  return plural(Math.round(ms / DAY), 'day')
}
export const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// ─── Merge tags ───────────────────────────────────────────────────────────────
export const MERGE_TAGS = [
  { tag: '{{name}}',   label: 'Name' },
  { tag: '{{city}}',   label: 'City' },
  { tag: '{{budget}}', label: 'Budget' },
]
export type MergeData = { name?: string | null; city?: string | null; budget?: string | null }
export const SAMPLE_MERGE: Required<MergeData> = { name: 'Rahul', city: 'Mumbai', budget: '₹1.2 Cr' }
export function personalise(text: string, d: MergeData) {
  return text
    .replace(/\{\{\s*name\s*\}\}/gi, (d.name ?? '').split(' ')[0] || 'there')
    .replace(/\{\{\s*city\s*\}\}/gi, d.city ?? '')
    .replace(/\{\{\s*budget\s*\}\}/gi, d.budget ?? '')
}
export const usesTag = (text: string, tag: 'city' | 'budget') => new RegExp(`\\{\\{\\s*${tag}\\s*\\}\\}`, 'i').test(text)

/** Puts a merge tag at the cursor and keeps the cursor after it */
export function insertAtCursor(el: HTMLTextAreaElement | null, value: string, text: string, set: (v: string) => void) {
  if (!el) { set(text + value); return }
  const start = el.selectionStart ?? text.length
  const end = el.selectionEnd ?? text.length
  const next = text.slice(0, start) + value + text.slice(end)
  set(next)
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + value.length, start + value.length) })
}

export function MergeTagBar({ targetRef, value, onChange }: {
  targetRef: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[12.5px] font-medium" style={{ color: SUBTLE }}>Insert</span>
      {MERGE_TAGS.map(m => (
        <button key={m.tag} type="button" onClick={() => insertAtCursor(targetRef.current, m.tag, value, onChange)}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[7px] border px-2 text-[12.5px] font-semibold transition-colors hover:bg-[#F9FAFB]"
          style={{ borderColor: BORDER_2, color: TEXT_2, background: CANVAS }}>
          <span style={{ color: BLUE }}>+</span>{m.label}
        </button>
      ))}
    </div>
  )
}

/** WhatsApp formatting: *bold*, _italic_, ~strike~ */
export function WaText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>
        if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
        if (/^~[^~\n]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

/** A chat bubble as the lead will see it on WhatsApp */
export function WaBubble({ text, time = '10:02 am' }: { text: string; time?: string }) {
  return (
    <div className="ml-auto w-fit max-w-[88%] rounded-[12px] rounded-tr-[4px] px-3 pb-1.5 pt-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]" style={{ background: '#D9FDD3' }}>
      <p className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-[1.45]" style={{ color: '#111B21' }}><WaText text={text} /></p>
      <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px]" style={{ color: '#667781' }}>
        {time}<Checks size={14} weight="bold" color="#53BDEB" />
      </div>
    </div>
  )
}

/** A phone-shaped WhatsApp chat. Used for live previews. */
export function WaPhone({ contact, children, footer }: { contact: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[22px] border-[6px]" style={{ borderColor: '#101828', boxShadow: '0 12px 24px -8px rgba(16,24,40,0.25)' }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: '#075E54' }}>
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: 'rgba(255,255,255,0.22)' }}>{initialsOf(contact)}</span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-white">{contact}</div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.72)' }}>online</div>
        </div>
      </div>
      <div className="flex min-h-[200px] flex-col gap-2 px-3 py-4" style={{ background: '#EFEAE2' }}>
        <span className="mx-auto rounded-[8px] px-2.5 py-1 text-[11px] font-medium" style={{ background: '#FFFFFF', color: '#54656F' }}>Today</span>
        {children}
      </div>
      {footer}
    </div>
  )
}

/** An email as the lead will see it */
export function EmailCard({ subject, body, to }: { subject: string; body: string; to: string }) {
  return (
    <div className="overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: BORDER }}>
      <div className="border-b px-3.5 py-2.5 text-[12.5px]" style={{ borderColor: BORDER, background: SURFACE, color: SUBTLE }}>
        <div className="truncate"><span style={{ color: LABEL }}>To</span> <span style={{ color: TEXT_2 }}>{to}</span></div>
        <div className="mt-0.5 truncate text-[14px] font-semibold" style={{ color: TEXT }}>{subject || 'No subject yet'}</div>
      </div>
      <p className="m-0 whitespace-pre-wrap break-words px-3.5 py-3 text-[13.5px] leading-relaxed" style={{ color: TEXT_2 }}>{body || 'Your email will appear here.'}</p>
    </div>
  )
}

// ─── Pills ────────────────────────────────────────────────────────────────────
export type Tone = 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'neutral'
export const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  blue:    { color: BLUE,      bg: BLUE_BG,   border: BLUE_LN },
  green:   { color: '#067647', bg: '#ECFDF3', border: '#ABEFC6' },
  red:     { color: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  amber:   { color: '#B54708', bg: '#FFFAEB', border: '#FEDF89' },
  violet:  { color: '#5925DC', bg: '#F4F3FF', border: '#D9D6FE' },
  neutral: { color: TEXT_2,    bg: SURFACE,   border: BORDER },
}

export function Pill({ tone = 'neutral', small, children }: { tone?: Tone; small?: boolean; children: ReactNode }) {
  const t = TONE[tone]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-semibold tabular-nums ${small ? 'px-1.5 py-px text-[11.5px]' : 'px-2 py-0.5 text-[12px]'}`}
      style={{ color: t.color, background: t.bg, borderColor: t.border }}>
      {children}
    </span>
  )
}

export function StagePill({ stage, small }: { stage: StageId; small?: boolean }) {
  const s = STAGE[stage]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${small ? 'px-2 py-px text-[12px]' : 'px-2.5 py-0.5 text-[13px]'}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      <span className="size-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

// ─── Avatars ──────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  { from: '#E0EAFF', to: '#C7D7FE', fg: '#2D31A6' },
  { from: '#FEF0C7', to: '#FEDF89', fg: '#93370D' },
  { from: '#DCFAE6', to: '#ABEFC6', fg: '#085D3A' },
  { from: '#F4EBFF', to: '#E9D7FE', fg: '#53389E' },
  { from: '#FDF2FA', to: '#FCCEEE', fg: '#9E165F' },
  { from: '#E0F2FE', to: '#B9E6FE', fg: '#065986' },
  { from: '#FEF6EE', to: '#F9DBAF', fg: '#932F19' },
  { from: '#F0F9FF', to: '#D1E9FF', fg: '#1849A9' },
]
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[Math.abs(h)]
}
// Demo photos, CS ID → public image path (same map as the Leads pages)
const AVATAR_MAP: Record<string, string> = {
  'CS01689': '/avatars/adi.png',
}
export function scoreTone(score: number) {
  if (score >= 70) return { bg: BLUE, fg: '#FFFFFF', label: 'High intent' }
  if (score >= 40) return { bg: '#F79009', fg: '#FFFFFF', label: 'Medium intent' }
  return { bg: '#E4E7EC', fg: MUTED, label: 'Low intent' }
}

export function Avatar({ name, score, size = 36, photo }: { name: string; score?: number | null; size?: number; photo?: string }) {
  const av = avatarColor(name)
  const tone = scoreTone(score ?? 0)
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="size-full rounded-full object-cover" style={{ boxShadow: '0 0 0 2px #fff, 0 0 0 3px #EAECF0' }} />
      ) : (
        <span className="grid size-full place-items-center rounded-full font-semibold"
          style={{ fontSize: Math.round(size * 0.36), background: `linear-gradient(140deg, ${av.from} 0%, ${av.to} 100%)`, color: av.fg, boxShadow: '0 0 0 2px #fff, 0 0 0 3px #EAECF0' }}>
          {initialsOf(name)}
        </span>
      )}
      {score != null && (
        <span title={`Intent score ${score} · ${tone.label}`}
          className="absolute -bottom-1 -right-1.5 grid h-[16px] min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums"
          style={{ background: tone.bg, color: tone.fg, boxShadow: '0 0 0 2px #fff' }}>
          {score}
        </span>
      )}
    </span>
  )
}
export function LeadAvatar({ lead, size = 36, badge = true }: { lead: CRMLead; size?: number; badge?: boolean }) {
  return <Avatar name={displayName(lead)} score={badge ? lead.intentScore : null} size={size} photo={AVATAR_MAP[getCsId(lead)]} />
}

// ─── Source logos ─────────────────────────────────────────────────────────────
type SourceMeta = { label: string; logo?: string; Icon?: typeof Globe; color?: string }
const SOURCE_META: Record<string, SourceMeta> = {
  OPT99ACRES:     { label: '99acres', logo: '/portals/99acres.png' },
  '99ACRES':      { label: '99acres', logo: '/portals/99acres.png' },
  MAGICBRICKS:    { label: 'MagicBricks', logo: '/portals/magicbricks.png' },
  HOUSINGCOM:     { label: 'Housing.com', logo: '/portals/housing.png' },
  HOUSING:        { label: 'Housing.com', logo: '/portals/housing.png' },
  MAKAAN:         { label: 'Makaan', logo: '/portals/makaan.png' },
  NOBROKER:       { label: 'NoBroker', logo: '/portals/nobroker.png' },
  PROPTIGER:      { label: 'PropTiger', logo: '/portals/proptiger.png' },
  SQUAREYARDS:    { label: 'Square Yards', logo: '/portals/squareyards.png' },
  COMMONFLOOR:    { label: 'CommonFloor', logo: '/portals/commonfloor.png' },
  FACEBOOK:       { label: 'Facebook', Icon: FacebookLogo, color: '#1877F2' },
  GOOGLE:         { label: 'Google Ads', Icon: GoogleLogo, color: '#EA4335' },
  CHANNELPARTNER: { label: 'Channel Partner', Icon: Handshake, color: '#7A5AF8' },
  MARKETING:      { label: 'Marketing', Icon: Megaphone, color: '#DD2590' },
}
export function sourceMeta(raw: string | null | undefined): SourceMeta {
  if (!raw) return { label: 'Direct', Icon: Globe, color: SUBTLE }
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (SOURCE_META[key]) return SOURCE_META[key]
  const label = raw.length > 3 && raw === raw.toUpperCase()
    ? raw.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : raw
  return { label, Icon: Globe, color: SUBTLE }
}
export function SourceMark({ raw, size = 20 }: { raw: string | null | undefined; size?: number }) {
  const m = sourceMeta(raw)
  if (m.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.logo} alt="" width={size} height={size} className="shrink-0 rounded-[5px]" style={{ width: size, height: size }} />
  }
  const Icon = m.Icon ?? Globe
  return (
    <span className="grid shrink-0 place-items-center rounded-[5px] border bg-white" style={{ width: size, height: size, borderColor: BORDER }}>
      <Icon size={size * 0.62} weight="fill" color={m.color} />
    </span>
  )
}

// ─── Buttons and inputs ───────────────────────────────────────────────────────
type BtnVariant = 'secondary' | 'primary' | 'call' | 'danger' | 'ghost'
const BTN: Record<BtnVariant, { bg: string; fg: string; border: string; hover: string; shadow: string }> = {
  secondary: { bg: CANVAS,  fg: TEXT_2,    border: BORDER_2,      hover: 'hover:bg-[#F9FAFB]', shadow: XS },
  primary:   { bg: BLUE,    fg: '#FFFFFF', border: BLUE,          hover: 'hover:brightness-110', shadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' },
  call:      { bg: GREEN_D, fg: '#FFFFFF', border: GREEN_D,       hover: 'hover:brightness-110', shadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' },
  danger:    { bg: '#D92D20', fg: '#FFFFFF', border: '#D92D20',   hover: 'hover:brightness-110', shadow: '0 1px 2px rgba(16,24,40,0.05), inset 0 -2px 0 rgba(16,24,40,0.12)' },
  ghost:     { bg: 'transparent', fg: SUBTLE, border: 'transparent', hover: 'hover:bg-[#F2F4F7]', shadow: 'none' },
}

export function Btn({ onClick, children, label, variant = 'secondary', size = 'md', disabled, active, type = 'button', className = '', title }: {
  onClick?: () => void; children: ReactNode; label?: string; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'
  disabled?: boolean; active?: boolean; type?: 'button' | 'submit'; className?: string; title?: string
}) {
  const v = BTN[variant]
  const h = size === 'lg' ? 'h-12 px-5 text-[15px] rounded-[12px]' : size === 'sm' ? 'h-8 px-2.5 text-[13px] rounded-[8px]' : 'h-10 px-3.5 text-[14px] rounded-[10px]'
  return (
    <button type={type} onClick={onClick} aria-label={label} title={title ?? label} aria-pressed={active} disabled={disabled}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border font-semibold transition-[background,filter,box-shadow] disabled:cursor-not-allowed ${disabled ? '' : v.hover} ${h} ${className}`}
      style={disabled
        ? { background: variant === 'secondary' || variant === 'ghost' ? CANVAS : '#F2F4F7', borderColor: variant === 'ghost' ? 'transparent' : BORDER, color: LABEL, boxShadow: 'none' }
        : active
          ? { background: BLUE_BG, borderColor: BLUE_LN, color: BLUE, boxShadow: XS }
          : { background: v.bg, borderColor: v.border, color: v.fg, boxShadow: v.shadow }}>
      {children}
    </button>
  )
}

export const inputCls = 'h-10 w-full min-w-0 rounded-[10px] border bg-white px-3 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-[#98A2B3] focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]'
export const textareaCls = 'block w-full min-w-0 resize-y rounded-[12px] border bg-white px-3.5 py-3 text-[14px] leading-relaxed outline-none transition-[border-color,box-shadow] placeholder:text-[#98A2B3] focus:border-[#84ADFF] focus:shadow-[0_0_0_4px_rgba(29,78,216,0.12)]'
export const inputStyle = { borderColor: BORDER_2, color: TEXT, boxShadow: XS }

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold" style={{ color: TEXT_2 }}>{label}</label>
      {children}
      {hint && <p className="m-0 mt-1.5 text-[12.5px] leading-snug" style={{ color: SUBTLE }}>{hint}</p>}
    </div>
  )
}

/** Native select (best on phones) dressed like the rest of the page */
export function Select({ id, value, onChange, children, className = '' }: {
  id?: string; value: string; onChange: (v: string) => void; children: ReactNode; className?: string
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className={`${inputCls} cursor-pointer appearance-none pr-9`} style={inputStyle}>
        {children}
      </select>
      <CaretDown size={14} weight="bold" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: SUBTLE }} />
    </div>
  )
}

/** Small segmented control */
export function Seg<T extends string>({ value, onChange, options, label, full }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode; count?: number }[]; label: string; full?: boolean
}) {
  return (
    <div role="tablist" aria-label={label}
      className={`flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] border p-[3px] [scrollbar-width:none] ${full ? 'w-full' : 'w-fit'}`}
      style={{ background: SURFACE, borderColor: BORDER }}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button key={o.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.id)}
            className={`flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-[13px] font-semibold transition-colors ${full ? 'flex-1' : ''}`}
            style={on
              ? { background: CANVAS, color: TEXT, boxShadow: '0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)' }
              : { background: 'transparent', color: SUBTLE }}>
            {o.label}
            {o.count != null && <span className="text-[12px] font-medium tabular-nums" style={{ color: on ? SUBTLE : LABEL }}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Pill-shaped filter chip with an optional count */
export function Chip({ on, onClick, children, count, icon }: { on: boolean; onClick: () => void; children: ReactNode; count?: number; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors hover:bg-[#F9FAFB]"
      style={on ? { background: BLUE_BG, borderColor: BLUE_LN, color: BLUE } : { background: CANVAS, borderColor: BORDER, color: TEXT_2 }}>
      {icon}{children}
      {count != null && <span className="text-[12px] font-medium tabular-nums" style={{ color: on ? BLUE : LABEL }}>{count}</span>}
    </button>
  )
}

/** On/off switch */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: on ? BLUE : '#E4E7EC' }}>
      <span className="absolute top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.1),0_1px_2px_rgba(16,24,40,0.06)] transition-[left]"
        style={{ left: on ? 22 : 2 }} />
    </button>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export function PageHeader({ title, badge, sub, actions, backHref = '/dashboard', backLabel = 'Back to dashboard' }: {
  title: string; badge?: ReactNode; sub: ReactNode; actions?: ReactNode; backHref?: string; backLabel?: string
}) {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 pb-6 pt-7 lg:px-8">
      <div className="flex min-w-0 items-start gap-4">
        <Link href={backHref} aria-label={backLabel} title={backLabel}
          className="mt-1 hidden size-11 shrink-0 place-items-center rounded-[12px] border bg-white no-underline transition-colors hover:bg-[#F9FAFB] sm:grid"
          style={{ borderColor: BORDER_2, color: TEXT_2, boxShadow: XS }}>
          <CaretLeft size={18} weight="bold" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="m-0 text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[36px]" style={{ color: TEXT }}>{title}</h1>
            {badge}
          </div>
          <p className="m-0 mt-1 max-w-[680px] text-[15px] leading-snug" style={{ color: SUBTLE }}>{sub}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'blue' }: { children: ReactNode; tone?: Tone }) {
  const t = TONE[tone]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold tabular-nums"
      style={{ background: t.bg, borderColor: t.border, color: t.color }}>{children}</span>
  )
}

export function Panel({ icon, title, sub, right, children, className = '', id, step }: {
  icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; id?: string; step?: number
}) {
  return (
    <section id={id} className={`flex min-w-0 scroll-mt-20 flex-col rounded-[16px] border bg-white ${className}`} style={{ borderColor: BORDER, boxShadow: XS }}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          {step != null
            ? <span className="grid size-9 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white" style={{ background: BLUE, boxShadow: '0 0 0 4px #EFF4FF' }}>{step}</span>
            : icon && <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: BORDER, color: TEXT_2, boxShadow: XS }}>{icon}</span>}
          <div className="min-w-0">
            <h3 className="m-0 text-[16px] font-semibold leading-tight" style={{ color: TEXT }}>{title}</h3>
            {sub && <p className="m-0 mt-1 text-[13px] leading-snug" style={{ color: SUBTLE }}>{sub}</p>}
          </div>
        </div>
        {right}
      </header>
      <div className="flex flex-1 flex-col px-4 pb-5 sm:px-5">{children}</div>
    </section>
  )
}

/** Stat tile in the same two-layer style as the Pipeline KPI cards */
export function StatCard({ icon, accent, label, value, unit, pill, sub, children }: {
  icon: ReactNode; accent: string; label: string; value: ReactNode; unit?: string; pill?: ReactNode; sub?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[18px] border p-1.5" style={{ background: SURFACE, borderColor: BORDER, boxShadow: XS }}>
      <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-1.5">
        <span className="hidden size-8 shrink-0 place-items-center rounded-[9px] border bg-white sm:grid" style={{ borderColor: BORDER, color: accent, boxShadow: XS }}>{icon}</span>
        <span className="truncate text-[14px] font-semibold" style={{ color: TEXT_2 }}>{label}</span>
      </div>
      <div className="flex flex-1 flex-col rounded-[13px] border bg-white px-4 pb-3.5 pt-4" style={{ borderColor: BORDER, boxShadow: XS }}>
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="whitespace-nowrap text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[30px]" style={{ color: TEXT }}>{value}</span>
            {unit && <span className="text-[14px]" style={{ color: SUBTLE }}>{unit}</span>}
          </div>
          {pill}
        </div>
        {children && <div className="mt-3.5">{children}</div>}
        {sub && <div className="mt-auto pt-3 text-[13px] leading-snug" style={{ color: SUBTLE }}>{sub}</div>}
      </div>
    </div>
  )
}

/** One thin bar split into parts, with a legend under it */
export function StackBar({ parts, format = n => String(n), legend = true }: {
  parts: { label: string; value: number; color: string }[]; format?: (n: number) => string; legend?: boolean
}) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div>
      <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full" style={{ background: total ? 'transparent' : '#F2F4F7' }}>
        {parts.filter(p => p.value > 0).map(p => (
          <span key={p.label} title={`${p.label}: ${format(p.value)}`} className="h-full rounded-full"
            style={{ flexGrow: p.value, flexBasis: 0, minWidth: 6, background: p.color }} />
        ))}
      </div>
      {legend && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {parts.map(p => (
            <span key={p.label} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
              <span style={{ color: SUBTLE }}>{p.label}</span>
              <span className="font-semibold tabular-nums" style={{ color: TEXT_2 }}>{format(p.value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Insight({ tone = 'blue', title, children, icon }: { tone?: Tone; title: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const t = TONE[tone]
  return (
    <div className="flex gap-3 rounded-[12px] border p-3.5" style={{ background: t.bg, borderColor: t.border }}>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white" style={{ color: t.color, boxShadow: XS }}>
        {icon ?? <Lightbulb size={15} weight="bold" />}
      </span>
      <div className="min-w-0 text-[13.5px] leading-snug" style={{ color: TEXT_2 }}>
        <div className="font-semibold" style={{ color: t.color }}>{title}</div>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, children, actions }: { icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rounded-[16px] border px-6 py-14 text-center" style={{ borderColor: BORDER, boxShadow: XS }}>
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[12px] border" style={{ borderColor: BORDER, boxShadow: XS, color: TEXT_2 }}>{icon}</div>
      <h3 className="m-0 text-[18px] font-semibold" style={{ color: TEXT }}>{title}</h3>
      <p className="mx-auto mb-0 mt-1.5 max-w-[440px] text-[14px] leading-relaxed" style={{ color: SUBTLE }}>{children}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{actions}</div>}
    </div>
  )
}

// ─── Dialog ───────────────────────────────────────────────────────────────────
/** Centred dialog on desktop, bottom sheet on phones. Escape or the backdrop closes it. */
export function Dialog({ open, onClose, title, sub, children, footer, width = 480, icon, full }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode
  width?: number; icon?: ReactNode; full?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-6" style={{ background: 'rgba(16,24,40,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true"
        className={`flex w-full flex-col overflow-hidden bg-white shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] ${full ? 'h-[100dvh] sm:h-[min(860px,92vh)] sm:rounded-[16px]' : 'max-h-[92dvh] rounded-t-[20px] sm:rounded-[16px]'}`}
        style={{ maxWidth: width }}>
        <div className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: BORDER }}>
          {icon && <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: BORDER, color: TEXT_2, boxShadow: XS }}>{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-semibold leading-tight" style={{ color: TEXT }}>{title}</h2>
            {sub && <p className="m-0 mt-1 text-[13.5px] leading-snug" style={{ color: SUBTLE }}>{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-[8px] transition-colors hover:bg-[#F2F4F7]" style={{ color: SUBTLE }}>
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2.5 border-t px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]" style={{ borderColor: BORDER, background: SURFACE }}>{footer}</div>}
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export type ToastMsg = { text: string; tone: 'ok' | 'err'; action?: { label: string; run: () => void } }
export function useToast() {
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((t: ToastMsg) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(t)
    timer.current = setTimeout(() => setToast(null), 6000)
  }, [])
  const hide = useCallback(() => setToast(null), [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { toast, show, hide }
}
export function Toast({ toast, onClose }: { toast: ToastMsg | null; onClose: () => void }) {
  if (!toast) return null
  return (
    <div role="status" className="fixed inset-x-4 bottom-24 z-[220] mx-auto flex w-fit max-w-[560px] items-center gap-3 rounded-[12px] bg-[#101828] py-2 pl-4 pr-2 text-white shadow-[0_20px_24px_-4px_rgba(16,24,40,0.18)] lg:bottom-6">
      {toast.tone === 'ok'
        ? <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#17B26A]"><Check size={11} weight="bold" /></span>
        : <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#F04438]"><X size={11} weight="bold" /></span>}
      <span className="min-w-0 text-[14px] font-medium">{toast.text}</span>
      {toast.action && (
        <button type="button" onClick={() => { toast.action!.run(); onClose() }} className="h-8 shrink-0 cursor-pointer rounded-[8px] px-2.5 text-[14px] font-semibold text-[#84ADFF] transition-colors hover:bg-white/10">{toast.action.label}</button>
      )}
      <button type="button" onClick={onClose} aria-label="Dismiss" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[8px] text-[#98A2B3] transition-colors hover:bg-white/10 hover:text-white">
        <X size={14} weight="bold" />
      </button>
    </div>
  )
}

