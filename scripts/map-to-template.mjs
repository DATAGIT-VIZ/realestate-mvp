/**
 * Converts a raw leads export (from Supabase, Zoho, LeadSquared, 99acres, etc.)
 * to the RealEdge locked import template format.
 *
 * Usage:
 *   node scripts/map-to-template.mjs input.csv output.csv
 *
 * The script auto-detects common column names from Indian CRM exports.
 * Review COLUMN_MAP below and adjust if your export uses different headers.
 */

import fs from 'fs'
import { createReadStream, createWriteStream } from 'fs'
import { createInterface } from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Column mapping ────────────────────────────────────────────────────────────
// Maps common source column names → template column names.
// Keys are lowercase. Adjust to match your actual CSV headers.
const COLUMN_MAP = {
  // Client Name
  'client name':    'Client Name',
  'name':           'Client Name',
  'full name':      'Client Name',
  'lead name':      'Client Name',
  'contact name':   'Client Name',
  'customer name':  'Client Name',

  // Phone
  'phone':          'Phone',
  'mobile':         'Phone',
  'phone number':   'Phone',
  'mobile number':  'Phone',
  'contact number': 'Phone',
  'phone no':       'Phone',
  'mobile no':      'Phone',

  // Email
  'email':          'Email',
  'email address':  'Email',
  'email id':       'Email',

  // Lead Source
  'lead source':    'Lead Source',
  'source':         'Lead Source',
  'portal':         'Lead Source',
  'channel':        'Lead Source',
  'utm_source':     'Lead Source',
  'campaign':       'Lead Source',

  // Location
  'location':       'Location',
  'city':           'Location',
  'area':           'Location',
  'locality':       'Location',
  'preferred location': 'Location',

  // Budget — handled specially below (budget_min + budget_max merged)
  'budget':         'Budget',
  'budget min':     '__budget_min',
  'budget_min':     '__budget_min',
  'min budget':     '__budget_min',
  'budget max':     '__budget_max',
  'budget_max':     '__budget_max',
  'max budget':     '__budget_max',

  // Timeline
  'timeline':       'Timeline',
  'purchase timeline': 'Timeline',
  'move in':        'Timeline',
  'possession':     'Timeline',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw) {
  if (!raw?.trim()) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10)                              return `+91${digits}`
  if (digits.length === 11 && digits.startsWith('0'))   return `+91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91'))  return `+${digits}`
  return raw.trim() // return as-is; preview API will flag it
}

function formatBudgetFromMinMax(min, max) {
  const toUnit = (n) => {
    const num = parseFloat(String(n).replace(/,/g, ''))
    if (isNaN(num)) return null
    if (num >= 10_000_000) return `${+(num / 10_000_000).toFixed(1)}Cr`
    if (num >= 100_000)    return `${+(num / 100_000).toFixed(1)}L`
    if (num >= 1_000)      return `${+(num / 1_000).toFixed(1)}K`
    return String(Math.round(num))
  }
  const minStr = min ? toUnit(min) : null
  const maxStr = max ? toUnit(max) : null
  if (minStr && maxStr) return `${minStr}-${maxStr}`
  return minStr ?? maxStr ?? ''
}

function parseCsvLine(line) {
  const result = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuote = !inQuote }
    else if (c === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
    else cur += c
  }
  result.push(cur.trim())
  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, inputFile, outputFile] = process.argv
if (!inputFile || !outputFile) {
  console.error('Usage: node scripts/map-to-template.mjs input.csv output.csv')
  process.exit(1)
}

const TEMPLATE = ['Client Name', 'Phone', 'Email', 'Lead Source', 'Location', 'Budget', 'Timeline']

const rl = createInterface({ input: createReadStream(inputFile) })
const out = createWriteStream(outputFile)

let headers = null
let lineNum = 0
let converted = 0, skipped = 0
const errors = []

// Write template header
out.write(TEMPLATE.join(',') + '\n')

rl.on('line', (line) => {
  if (!line.trim()) return
  lineNum++

  if (!headers) {
    // First line = headers
    headers = parseCsvLine(line).map(h => h.replace(/^﻿/, '').trim()) // strip BOM
    const mappedHeaders = headers.map(h => {
      const key = h.toLowerCase().trim()
      return COLUMN_MAP[key] ?? null
    })
    console.log('\n── Header mapping ──────────────────')
    headers.forEach((h, i) => {
      const m = mappedHeaders[i]
      console.log(`  "${h}" → ${m ?? '(ignored)'}`)
    })
    console.log('────────────────────────────────────\n')
    return
  }

  const cells = parseCsvLine(line)
  const row = {}
  headers.forEach((h, i) => {
    const key = h.toLowerCase().trim()
    const target = COLUMN_MAP[key]
    if (target) row[target] = cells[i] ?? ''
  })

  // Merge budget_min + budget_max if both present
  if (row['__budget_min'] || row['__budget_max']) {
    row['Budget'] = formatBudgetFromMinMax(row['__budget_min'], row['__budget_max'])
    delete row['__budget_min']
    delete row['__budget_max']
  }

  // Normalize phone
  if (row['Phone']) row['Phone'] = normalizePhone(row['Phone'])

  // Skip rows with no name AND no phone
  if (!row['Client Name'] && !row['Phone']) { skipped++; return }

  // Write to output
  const outRow = TEMPLATE.map(col => {
    const val = (row[col] ?? '').replace(/"/g, '""')
    return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val
  })
  out.write(outRow.join(',') + '\n')
  converted++
})

rl.on('close', () => {
  out.end()
  console.log(`✓ Done.`)
  console.log(`  Converted : ${converted.toLocaleString()} rows`)
  console.log(`  Skipped   : ${skipped.toLocaleString()} rows (no name + no phone)`)
  console.log(`  Output    : ${outputFile}`)
  console.log('\nNext step: drag the output CSV into the RealEdge Import modal.')
})
