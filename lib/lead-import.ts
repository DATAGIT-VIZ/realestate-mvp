// Shared types, constants and normalizers for CSV lead import.
// No server-only imports — safe to use in both API routes and client components.

export const TEMPLATE_HEADERS = [
  'Client Name', 'Phone', 'Email', 'Lead Source', 'Location', 'Budget', 'Timeline',
] as const

export type PreviewStatus = 'new' | 'duplicate_phone' | 'duplicate_name_email' | 'error'

export interface ParsedLead {
  name: string
  phone: string | null
  email: string | null
  source: string | null
  city: string | null
  budgetMin: number | null
  budgetMax: number | null
  timeline: string | null
}

export interface PreviewRow {
  rowIndex: number
  raw: Record<string, string>
  parsed: ParsedLead
  status: PreviewStatus
  errors: string[]
  duplicateId?: string
  duplicateReason?: string
}

export interface PreviewStats {
  total: number
  new: number
  duplicates: number
  errors: number
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function normalizePhone(raw: string): { e164: string | null; error: string | null } {
  if (!raw?.trim()) return { e164: null, error: 'Phone is required' }
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10)                              return { e164: `+91${digits}`, error: null }
  if (digits.length === 11 && digits.startsWith('0'))   return { e164: `+91${digits.slice(1)}`, error: null }
  if (digits.length === 12 && digits.startsWith('91'))  return { e164: `+${digits}`, error: null }
  if (digits.length === 13 && digits.startsWith('091')) return { e164: `+91${digits.slice(3)}`, error: null }
  return { e164: null, error: `Invalid phone "${raw.slice(0, 20)}" — expected 10 digits or +91XXXXXXXXXX` }
}

export function parseBudget(raw: string): { min: number | null; max: number | null; error: string | null } {
  if (!raw?.trim()) return { min: null, max: null, error: null }

  const toRupees = (s: string): number | null => {
    const cleaned = s.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '')
    const m = cleaned.match(/^([\d.]+)(cr|l|k)?$/)
    if (!m) return null
    const n = parseFloat(m[1])
    if (isNaN(n)) return null
    if (m[2] === 'cr') return Math.round(n * 10_000_000)
    if (m[2] === 'l')  return Math.round(n * 100_000)
    if (m[2] === 'k')  return Math.round(n * 1_000)
    return Math.round(n)
  }

  const rangeMatch = raw.trim().match(/^([\d.,]+\s*(?:cr|l|k)?)\s*[-–to]\s*([\d.,]+\s*(?:cr|l|k)?)$/i)
  if (rangeMatch) {
    const mn = toRupees(rangeMatch[1])
    const mx = toRupees(rangeMatch[2])
    if (mn !== null && mx !== null) return { min: mn, max: mx, error: null }
  }

  const single = toRupees(raw.trim())
  if (single !== null) return { min: null, max: single, error: null }

  return { min: null, max: null, error: `Cannot parse budget "${raw.slice(0, 20)}" — use "50L", "1Cr", "50-80L"` }
}

export function parseRow(raw: Record<string, string>): { parsed: ParsedLead; errors: string[] } {
  const errors: string[] = []

  const name = raw['Client Name']?.trim() ?? ''
  if (!name) errors.push('"Client Name" is required')

  const { e164, error: phoneErr } = normalizePhone(raw['Phone'] ?? '')
  if (phoneErr) errors.push(phoneErr)

  const emailRaw = raw['Email']?.trim().toLowerCase() ?? ''
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    errors.push(`Invalid email "${emailRaw.slice(0, 40)}"`)
  }

  const { min: budgetMin, max: budgetMax, error: budgetErr } = parseBudget(raw['Budget'] ?? '')
  if (budgetErr) errors.push(budgetErr)

  return {
    parsed: {
      name,
      phone:     e164,
      email:     emailRaw || null,
      source:    raw['Lead Source']?.trim() || null,
      city:      raw['Location']?.trim()   || null,
      budgetMin,
      budgetMax,
      timeline:  raw['Timeline']?.trim()   || null,
    },
    errors,
  }
}
