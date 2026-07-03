/**
 * Phone normalisation + lead deduplication helpers.
 * All portal ingest routes share this — never duplicate this logic.
 */

/** Strip +91, country code, spaces, dashes → 10-digit Indian mobile */
export function normalisePhone(raw: string): string {
  let n = raw.replace(/\D/g, '') // keep digits only
  if (n.startsWith('91') && n.length === 12) n = n.slice(2)
  if (n.startsWith('0') && n.length === 11) n = n.slice(1)
  return n
}

/** Returns true when two phone strings represent the same Indian number */
export function samePhone(a: string, b: string): boolean {
  return normalisePhone(a) === normalisePhone(b)
}

/**
 * Naive budget string → { min, max } in rupees.
 * Handles "50 Lac", "1.5 Cr", "50L - 1Cr", "₹40L", etc.
 */
export function parseBudget(raw: string | undefined): { budgetMin?: number; budgetMax?: number } {
  if (!raw) return {}
  const clean = raw.toLowerCase().replace(/₹|,|\s/g, '')

  const toRupees = (n: number, unit: string): number =>
    unit.startsWith('c') ? n * 1_00_00_000 : n * 1_00_000

  // Range: "50L-1Cr" or "50L to 1Cr"
  const rangeMatch = clean.match(/^([\d.]+)([lc][a-z]*)(?:[-–to]+([\d.]+)([lc][a-z]*))?$/)
  if (rangeMatch) {
    const min = toRupees(parseFloat(rangeMatch[1]), rangeMatch[2])
    const max = rangeMatch[3] ? toRupees(parseFloat(rangeMatch[3]), rangeMatch[4]) : undefined
    return { budgetMin: min, ...(max ? { budgetMax: max } : {}) }
  }

  // Single value: "80L" or "1.2Cr"
  const singleMatch = clean.match(/^([\d.]+)([lc][a-z]*)$/)
  if (singleMatch) {
    const val = toRupees(parseFloat(singleMatch[1]), singleMatch[2])
    return { budgetMin: val, budgetMax: val }
  }

  return {}
}

/** Attempt to extract a 10-digit phone from any string */
export function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+91|91|0)?[6-9]\d{9}/)
  return match ? normalisePhone(match[0]) : null
}
