'use client'

import { useState, useRef } from 'react'
import { X, UploadCloud, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import Papa from 'papaparse'

const BG = '#080D18'
const PANEL = '#0E1623'
const BORDER = 'rgba(255,255,255,0.06)'
const AMBER = '#F59E0B'
const TEXT = '#F1F5F9'
const MUTED = 'rgba(255,255,255,0.35)'

interface CsvUploadModalProps {
    onClose: () => void
    onSuccess: (mappedData: any[]) => void
}

export function CsvUploadModal({ onClose, onSuccess }: CsvUploadModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [parsedData, setParsedData] = useState<any[] | null>(null)
    const [headers, setHeaders] = useState<string[]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({
        name: '',
        email: '',
        phone: '',
        source: '',
        property_type: '',
        budget_min: '',
        budget_max: '',
    })

    const fileInputRef = useRef<HTMLInputElement>(null)

    const REQUIRED_FIELDS = ['name', 'phone']
    const DB_FIELDS = [
        { key: 'name', label: 'Full Name *' },
        { key: 'phone', label: 'Phone Number *' },
        { key: 'email', label: 'Email Address' },
        { key: 'source', label: 'Lead Source (e.g., Website, Referral)' },
        { key: 'property_type', label: 'Property Type (e.g., 2BHK, Villa)' },
        { key: 'budget_min', label: 'Min Budget' },
        { key: 'budget_max', label: 'Max Budget' },
    ]

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (selected) {
            if (!selected.name.endsWith('.csv')) {
                setError('Please select a valid .csv file')
                return
            }
            setFile(selected)
            setError(null)
            parseCsv(selected)
        }
    }

    const parseCsv = (file: File) => {
        setLoading(true)
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setLoading(false)
                if (results.errors.length > 0) {
                    setError(`Error parsing CSV: ${results.errors[0].message}`)
                    return
                }
                if (results.data.length === 0) {
                    setError('The CSV file is empty.')
                    return
                }

                const fileHeaders = Object.keys(results.data[0] as object)
                setHeaders(fileHeaders)
                setParsedData(results.data)

                // Auto-map matching headers (case-insensitive)
                const newMapping = { ...mapping }
                DB_FIELDS.forEach(field => {
                    const match = fileHeaders.find(h => h.toLowerCase().trim() === field.key.toLowerCase().replace('_', '')) ||
                        fileHeaders.find(h => h.toLowerCase().trim().includes(field.key.split('_')[0]))
                    if (match) newMapping[field.key] = match
                })
                setMapping(newMapping)
            },
            error: (err) => {
                setLoading(false)
                setError(`Failed to read file: ${err.message}`)
            }
        })
    }

    const handleImport = () => {
        // Validate required fields are mapped
        const missingFields = REQUIRED_FIELDS.filter(f => !mapping[f])
        if (missingFields.length > 0) {
            setError(`Please map the following required fields: ${missingFields.join(', ')}`)
            return
        }

        if (!parsedData) return

        setLoading(true)

        // Transform original CSV data using the mapping
        const transformedData = parsedData.map(row => {
            const mappedRow: any = {}
            Object.entries(mapping).forEach(([dbKey, csvHeader]) => {
                if (csvHeader && row[csvHeader]) {
                    mappedRow[dbKey] = row[csvHeader]
                }
            })
            return mappedRow
        })

        // Filter out rows missing required data
        const validData = transformedData.filter(row => row.name && row.phone)

        if (validData.length === 0) {
            setError('No valid rows found to import. Check your mapping and data.')
            setLoading(false)
            return
        }

        onSuccess(validData)
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {/* Backdrop */}
            <div
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                onClick={onClose}
            />

            {/* Modal */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 700, maxHeight: '90vh', background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UploadCloud style={{ width: 16, height: 16, color: AMBER }} />
                        </div>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: TEXT, margin: 0 }}>Import CSV</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 8, color: MUTED, cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                        <X style={{ width: 16, height: 16 }} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                    {!file && !parsedData ? (
                        // Upload State
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: `2px dashed ${BORDER}`,
                                borderRadius: 16,
                                padding: '64px 24px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                background: 'rgba(0,0,0,0.2)',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = AMBER; (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.05)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.2)' }}
                        >
                            <input type="file" accept=".csv" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileSelect} />
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <FileText style={{ width: 24, height: 24, color: MUTED }} />
                            </div>
                            <p style={{ fontSize: 15, fontWeight: 500, color: TEXT, margin: '0 0 8px' }}>Click or drag a .csv file here to upload</p>
                            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Must contain columns for Name and Phone minimum.</p>
                        </div>
                    ) : (
                        // Mapping State
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <FileText style={{ width: 16, height: 16, color: AMBER }} />
                                    <div>
                                        <p style={{ fontSize: 14, fontWeight: 500, color: TEXT, margin: 0 }}>{file?.name}</p>
                                        <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>{parsedData?.length} rows detected</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setFile(null); setParsedData(null); setError(null) }}
                                    style={{ fontSize: 12, color: AMBER, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Change File
                                </button>
                            </div>

                            <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 16 }}>Map Columns</h3>
                            <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Match the columns from your CSV to the fields in the CRM database.</p>

                            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.03)' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CRM Field</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CSV Column</span>
                                </div>

                                {DB_FIELDS.map((field, idx) => (
                                    <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '14px 16px', borderBottom: idx < DB_FIELDS.length - 1 ? `1px solid ${BORDER}` : 'none', alignItems: 'center', background: 'transparent' }}>
                                        <div>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{field.label}</span>
                                        </div>
                                        <div>
                                            <select
                                                value={mapping[field.key] || ''}
                                                onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                                style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 13, outline: 'none' }}
                                            >
                                                <option value="">-- Ignore this field --</option>
                                                {headers.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertCircle style={{ width: 14, height: 14, color: '#EF4444' }} />
                            <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '10px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleImport}
                        disabled={loading || !parsedData}
                        style={{ padding: '10px 18px', background: AMBER, border: 'none', borderRadius: 10, color: '#000', fontSize: 13, fontWeight: 600, cursor: (loading || !parsedData) ? 'not-allowed' : 'pointer', opacity: (loading || !parsedData) ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {loading ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Processing...</> : 'Import Leads'}
                    </button>
                </div>
            </div>
        </div>
    )
}
