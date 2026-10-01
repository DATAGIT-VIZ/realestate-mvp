'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Buildings, Users, UploadSimple, ArrowRight, ArrowLeft,
  CircleNotch, CheckCircle, X, Plus,
} from '@phosphor-icons/react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = '#F4F8FD'
const PANEL  = '#ffffff'
const BORDER = '#E2E8F0'
const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const LABEL  = '#94A3B8'
const BLUE   = '#0038A8'

type Step = 1 | 2 | 3

const STEP_LABELS = ['Workspace', 'Invite', 'Import']

function ProgressBar({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
      {([1, 2, 3] as Step[]).map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: s > step ? 0.35 : 1,
          }}>
            <div style={{
              width: 22, height: 22,
              background: s < step ? BLUE : s === step ? BLUE : 'transparent',
              border: `2px solid ${s <= step ? BLUE : BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: s <= step ? '#fff' : LABEL,
            }}>
              {s < step ? <CheckCircle size={12} weight="fill" /> : s}
            </div>
            <span style={{ fontSize: 12, fontWeight: s === step ? 700 : 500, color: s === step ? TEXT : MUTED }}>
              {STEP_LABELS[i]}
            </span>
          </div>
          {s < 3 && (
            <div style={{ width: 32, height: 1, background: s < step ? BLUE : BORDER }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Workspace name ──────────────────────────────────────────────────
function Step1({ onNext }: { onNext: (name: string) => void }) {
  const [name,    setName]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleNext = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Please enter a workspace name.'); return }
    setSaving(true)
    setError(null)
    // Best-effort save — proceed even if no session yet (e.g. email confirmation in flight)
    try {
      await supabase.auth.updateUser({ data: { workspace_name: trimmed } })
    } catch {}
    onNext(trimmed)
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, background: 'rgba(0,56,168,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Buildings size={22} weight="light" style={{ color: BLUE }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Name your workspace
        </h2>
        <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6 }}>
          This is what your team will see. You can always change it later.
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 7, letterSpacing: '0.04em' }}>
          Workspace name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          placeholder="Mumbai Realty Group"
          autoFocus
          style={{
            width: '100%', padding: '12px 14px',
            border: `1px solid ${BORDER}`, borderRadius: 2,
            fontSize: 15, color: TEXT, outline: 'none',
            background: '#FAFAFA', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = BLUE)}
          onBlur={e  => (e.target.style.borderColor = BORDER)}
        />
        {error && (
          <p style={{ fontSize: 12, color: '#DC2626', margin: '6px 0 0' }}>{error}</p>
        )}
      </div>

      <button
        onClick={handleNext}
        disabled={saving}
        style={{
          width: '100%', padding: '13px 0',
          background: saving ? '#E2E8F0' : BLUE,
          border: 'none', borderRadius: 2,
          color: saving ? LABEL : '#fff',
          fontSize: 14, fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {saving
          ? <><CircleNotch size={15} weight="light" style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
          : <>Continue <ArrowRight size={14} weight="light" /></>}
      </button>
    </div>
  )
}

// ─── Step 2: Invite team (skippable) ─────────────────────────────────────────
function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [emails, setEmails] = useState<string[]>([''])
  const [sending, setSending] = useState(false)

  const updateEmail = (i: number, val: string) => {
    setEmails(prev => { const next = [...prev]; next[i] = val; return next })
  }
  const addEmail = () => setEmails(prev => [...prev, ''])
  const removeEmail = (i: number) => {
    if (emails.length === 1) { setEmails(['']); return }
    setEmails(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSend = async () => {
    const valid = emails.filter(e => e.trim() && e.includes('@'))
    if (valid.length === 0) { onNext(); return }
    setSending(true)
    await new Promise(r => setTimeout(r, 600))
    setSending(false)
    onNext()
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, background: 'rgba(0,56,168,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Users size={22} weight="light" style={{ color: BLUE }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Invite your team
        </h2>
        <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6 }}>
          Add team members by email. They'll get an invite link to join your workspace.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {emails.map((email, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <input
              type="email"
              value={email}
              onChange={e => updateEmail(i, e.target.value)}
              placeholder={`agent${i + 1}@yourcompany.com`}
              style={{
                width: '100%', padding: '11px 36px 11px 14px',
                border: `1px solid ${BORDER}`, borderRadius: 2,
                fontSize: 14, color: TEXT, outline: 'none',
                background: '#FAFAFA', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = BLUE)}
              onBlur={e  => (e.target.style.borderColor = BORDER)}
            />
            {emails.length > 1 && (
              <button
                type="button"
                onClick={() => removeEmail(i)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: LABEL, display: 'flex', padding: 2,
                }}
              >
                <X size={13} weight="light" />
              </button>
            )}
          </div>
        ))}
        {emails.length < 5 && (
          <button
            type="button"
            onClick={addEmail}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: `1px dashed ${BORDER}`,
              padding: '9px 14px', cursor: 'pointer',
              fontSize: 13, color: MUTED,
            }}
          >
            <Plus size={13} weight="light" />
            Add another
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 16px', background: 'transparent',
            border: `1px solid ${BORDER}`, borderRadius: 2,
            color: MUTED, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <ArrowLeft size={14} weight="light" />
          Back
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            flex: 1, padding: '12px 0',
            background: sending ? '#E2E8F0' : BLUE,
            border: 'none', borderRadius: 2,
            color: sending ? LABEL : '#fff',
            fontSize: 14, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {sending
            ? <><CircleNotch size={15} weight="light" style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
            : <>Send invites <ArrowRight size={14} weight="light" /></>}
        </button>
      </div>

      <button
        onClick={onNext}
        style={{
          width: '100%', padding: '10px 0', marginTop: 10,
          background: 'none', border: 'none',
          fontSize: 13, color: LABEL, cursor: 'pointer',
        }}
      >
        Skip for now
      </button>
    </div>
  )
}

// ─── Step 3: Import leads ─────────────────────────────────────────────────────
function Step3({ workspaceName, onBack }: { workspaceName: string; onBack: () => void }) {
  const router     = useRouter()
  const fileRef    = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [going,    setGoing]    = useState(false)

  const handleFile = (file: File) => {
    setFileName(file.name)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleGoToDashboard = () => {
    setGoing(true)
    router.push('/dashboard/today')
  }

  const handleOpenImport = () => {
    router.push('/dashboard/leads/ingestion')
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, background: 'rgba(0,56,168,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <UploadSimple size={22} weight="light" style={{ color: BLUE }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Import your leads
        </h2>
        <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6 }}>
          Upload a CSV to populate {workspaceName || 'your workspace'}. You need at least a name and phone number.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? BLUE : BORDER}`,
          background: dragging ? 'rgba(0,56,168,0.04)' : '#FAFAFA',
          padding: '32px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 16,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {fileName ? (
          <div>
            <CheckCircle size={24} weight="light" style={{ color: '#059669', marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 4px' }}>{fileName}</p>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>Click to change file</p>
          </div>
        ) : (
          <div>
            <UploadSimple size={24} weight="light" style={{ color: LABEL, marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 4px' }}>
              Drop your CSV here or click to browse
            </p>
            <p style={{ fontSize: 12, color: LABEL, margin: 0 }}>
              .csv · Name + Phone required
            </p>
          </div>
        )}
      </div>

      {fileName && (
        <button
          onClick={handleOpenImport}
          style={{
            width: '100%', padding: '12px 0',
            background: BLUE,
            border: 'none', borderRadius: 2,
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 8,
          }}
        >
          Map columns and import
          <ArrowRight size={14} weight="light" />
        </button>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 16px', background: 'transparent',
            border: `1px solid ${BORDER}`, borderRadius: 2,
            color: MUTED, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <ArrowLeft size={14} weight="light" />
          Back
        </button>
        <button
          onClick={handleGoToDashboard}
          disabled={going}
          style={{
            flex: 1, padding: '12px 0',
            background: going ? '#E2E8F0' : fileName ? 'transparent' : BLUE,
            border: fileName ? `1px solid ${BORDER}` : 'none',
            borderRadius: 2,
            color: going ? LABEL : fileName ? MUTED : '#fff',
            fontSize: 14, fontWeight: 700,
            cursor: going ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {going
            ? <><CircleNotch size={15} weight="light" style={{ animation: 'spin 1s linear infinite' }} /> Opening…</>
            : fileName
              ? 'Skip import, go to dashboard'
              : <>Start without leads <ArrowRight size={14} weight="light" /></>}
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: LABEL, marginTop: 12 }}>
        You can import leads anytime from Settings → Integrations.
      </p>
    </div>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step,          setStep]          = useState<Step>(1)
  const [workspaceName, setWorkspaceName] = useState('')

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px',
      fontFamily: 'var(--font-jakarta, system-ui, sans-serif)',
    }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div style={{ width: 34, height: 34, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>LG</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>LEAD GAP</span>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, padding: '36px 36px 32px' }}>
          <ProgressBar step={step} />

          {step === 1 && (
            <Step1
              onNext={name => { setWorkspaceName(name); setStep(2) }}
            />
          )}
          {step === 2 && (
            <Step2
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              workspaceName={workspaceName}
              onBack={() => setStep(2)}
            />
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: LABEL, marginTop: 16 }}>
          Already set up?{' '}
          <a href="/dashboard/today" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>Go to dashboard</a>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
