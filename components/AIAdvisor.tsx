'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    Bot,
    Send,
    Plus,
    Trash2,
    MessageSquare,
    User,
    Loader2,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Building,
    TrendingUp,
    Phone,
    DollarSign,
} from 'lucide-react'

// ─── Design tokens (match analytics page) ────────────────────────────────────
const C = {
    bg: '#080D18',
    panel: '#0E1623',
    panelAlt: '#111C2D',
    border: 'rgba(255,255,255,0.06)',
    amber: '#F59E0B',
    amberDim: 'rgba(245,158,11,0.10)',
    blue: '#3B82F6',
    muted: 'rgba(255,255,255,0.35)',
    text: '#F1F5F9',
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface Conversation {
    id: string
    title: string
    messages: ChatMessage[]
    createdAt: number
}

export interface AIAdvisorContext {
    totalLeads: number
    hotLeadsCount: number
    hotPipelineValue: string
    avgConversionDays: number
    responseRate: number
    activityDensity: string
    totalActivities: number
    topSource: string
    topSourceRate: number
    bestActivity: string
    bestActivityRate: number
    hotTrend: number
}

const STORAGE_KEY = 'ai_advisor_conversations'
const MAX_CONVERSATIONS = 20

const QUICK_PROMPTS = [
    { icon: <Phone size={14} />, text: 'Which leads should I call today?' },
    { icon: <TrendingUp size={14} />, text: 'Current real estate trends in India?' },
    { icon: <DollarSign size={14} />, text: 'How is my pipeline performing?' },
    { icon: <Building size={14} />, text: 'Best micro-markets to target in 2026?' },
    { icon: <TrendingUp size={14} />, text: 'How can I improve my conversion rate?' },
    { icon: <MessageSquare size={14} />, text: 'How to handle price objections?' },
]

function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function titleFromMessage(msg: string): string {
    return msg.length > 40 ? msg.slice(0, 40) + '…' : msg
}

// ─── Message renderer (lightweight markdown) ─────────────────────────────────
function MessageContent({ content }: { content: string }) {
    if (!content) return null
    const lines = content.split('\n')
    return (
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.75, wordBreak: 'break-word' }}>
            {lines.map((line, i) => {
                if (line.startsWith('### '))
                    return <p key={i} style={{ fontWeight: 700, color: C.amber, margin: '10px 0 4px', fontSize: 13 }}>{line.slice(4)}</p>
                if (line.startsWith('## '))
                    return <p key={i} style={{ fontWeight: 700, color: C.amber, margin: '12px 0 6px', fontSize: 14 }}>{line.slice(3)}</p>
                if (line.startsWith('- ') || line.startsWith('• '))
                    return (
                        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', alignItems: 'flex-start' }}>
                            <span style={{ color: C.amber, flexShrink: 0, marginTop: 3, fontSize: 10 }}>●</span>
                            <span>{line.slice(2)}</span>
                        </div>
                    )
                if (/^\d+\.\s/.test(line))
                    return (
                        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', alignItems: 'flex-start' }}>
                            <span style={{ color: C.amber, flexShrink: 0, fontWeight: 700, fontSize: 12 }}>{line.match(/^\d+/)![0]}.</span>
                            <span>{line.replace(/^\d+\.\s/, '')}</span>
                        </div>
                    )
                if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
                // inline bold **text**
                const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
                return (
                    <p key={i} style={{ margin: '1px 0' }}>
                        {boldParts.map((part, j) =>
                            part.startsWith('**') && part.endsWith('**')
                                ? <strong key={j} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
                                : <span key={j}>{part}</span>
                        )}
                    </p>
                )
            })}
        </div>
    )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
    return (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 2px' }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: C.amber,
                    animation: `pulse 1.3s ease-in-out ${i * 0.15}s infinite`,
                }} />
            ))}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIAdvisor({ context }: { context: AIAdvisorContext }) {
    // Conversations persisted in localStorage
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed: Conversation[] = JSON.parse(saved)
                setConversations(parsed)
                if (parsed.length > 0) setActiveId(parsed[0].id)
            }
        } catch { /* ignore */ }
    }, [])

    // Persist conversations whenever they change
    useEffect(() => {
        if (conversations.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)))
        }
    }, [conversations])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [conversations, loading])

    const activeConversation = conversations.find(c => c.id === activeId) ?? null

    // ── New conversation ─────────────────────────────────────────────────────
    const newConversation = useCallback(() => {
        const conv: Conversation = {
            id: generateId(),
            title: 'New conversation',
            messages: [],
            createdAt: Date.now(),
        }
        setConversations(prev => [conv, ...prev])
        setActiveId(conv.id)
        setInput('')
        setTimeout(() => inputRef.current?.focus(), 50)
    }, [])

    // ── Delete conversation ──────────────────────────────────────────────────
    const deleteConversation = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setConversations(prev => {
            const next = prev.filter(c => c.id !== id)
            if (activeId === id) {
                setActiveId(next.length > 0 ? next[0].id : null)
            }
            if (next.length === 0) localStorage.removeItem(STORAGE_KEY)
            return next
        })
    }, [activeId])

    // ── Send message ─────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || loading) return

        const userMsg: ChatMessage = { role: 'user', content: text.trim() }

        // If no active conversation, create one
        let convId = activeId
        if (!convId) {
            const conv: Conversation = {
                id: generateId(),
                title: titleFromMessage(text.trim()),
                messages: [],
                createdAt: Date.now(),
            }
            setConversations(prev => [conv, ...prev])
            setActiveId(conv.id)
            convId = conv.id
        }

        // Append user message + placeholder assistant
        setConversations(prev => prev.map(c =>
            c.id !== convId ? c : {
                ...c,
                title: c.messages.length === 0 ? titleFromMessage(text.trim()) : c.title,
                messages: [...c.messages, userMsg, { role: 'assistant', content: '' }],
            }
        ))
        setInput('')
        setLoading(true)

        const currentMessages = (conversations.find(c => c.id === convId)?.messages ?? [])
        const allMessages = [...currentMessages, userMsg]

        try {
            const res = await fetch('/api/ai-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: allMessages, context }),
            })
            const data = await res.json()
            const reply = data.content || data.error || 'No response from model.'

            setConversations(prev => prev.map(c => {
                if (c.id !== convId) return c
                const msgs = [...c.messages]
                msgs[msgs.length - 1] = { role: 'assistant', content: reply }
                return { ...c, messages: msgs }
            }))
        } catch {
            setConversations(prev => prev.map(c => {
                if (c.id !== convId) return c
                const msgs = [...c.messages]
                msgs[msgs.length - 1] = { role: 'assistant', content: '⚠️ Failed to connect. Please try again.' }
                return { ...c, messages: msgs }
            }))
        } finally {
            setLoading(false)
        }
    }, [loading, activeId, conversations, context])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage(input)
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            marginTop: 14,
            borderRadius: 20,
            overflow: 'hidden',
            border: `1px solid rgba(245,158,11,0.2)`,
            background: C.panel,
            display: 'flex',
            flexDirection: 'column',
        }}>

            {/* ── Panel title bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: `1px solid ${C.border}`,
                background: 'linear-gradient(90deg, rgba(245,158,11,0.06) 0%, transparent 60%)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.08))',
                        border: '1px solid rgba(245,158,11,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Bot size={16} color={C.amber} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>AI Business Advisor</span>
                            <span style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                                color: C.amber, padding: '2px 8px', borderRadius: 20,
                            }}>GPT</span>
                        </div>
                        <p style={{ fontSize: 11.5, color: C.muted, margin: 0 }}>
                            Knows your live pipeline · Indian RE market · Ask anything
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        onClick={newConversation}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 10,
                            background: C.amberDim, border: `1px solid rgba(245,158,11,0.25)`,
                            color: C.amber, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        <Plus size={13} /> New Chat
                    </button>
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        style={{
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${C.border}`, cursor: 'pointer',
                        }}
                        title={sidebarOpen ? 'Hide history' : 'Show history'}
                    >
                        {sidebarOpen ? <ChevronLeft size={14} color={C.muted} /> : <ChevronRight size={14} color={C.muted} />}
                    </button>
                </div>
            </div>

            {/* ── Main area: sidebar + chat ── */}
            <div style={{ display: 'flex', height: 560 }}>

                {/* ── Sidebar ── */}
                {sidebarOpen && (
                    <div style={{
                        width: 230, borderRight: `1px solid ${C.border}`,
                        display: 'flex', flexDirection: 'column',
                        background: 'rgba(8,13,24,0.6)',
                        flexShrink: 0,
                    }}>
                        <div style={{ padding: '12px 10px 8px', borderBottom: `1px solid ${C.border}` }}>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                                Recent Chats
                            </p>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
                            {conversations.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 12px' }}>
                                    <MessageSquare size={22} color="rgba(255,255,255,0.12)" style={{ margin: '0 auto 8px' }} />
                                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>No conversations yet</p>
                                </div>
                            ) : (
                                conversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        onClick={() => setActiveId(conv.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                                            background: conv.id === activeId ? 'rgba(245,158,11,0.1)' : 'transparent',
                                            border: `1px solid ${conv.id === activeId ? 'rgba(245,158,11,0.2)' : 'transparent'}`,
                                            marginBottom: 3, transition: 'all 0.12s',
                                        }}
                                        onMouseEnter={e => {
                                            if (conv.id !== activeId) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'
                                        }}
                                        onMouseLeave={e => {
                                            if (conv.id !== activeId) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                                        }}
                                    >
                                        <MessageSquare size={13} color={conv.id === activeId ? C.amber : C.muted} style={{ flexShrink: 0 }} />
                                        <span style={{
                                            fontSize: 12.5, color: conv.id === activeId ? C.text : C.muted,
                                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            fontWeight: conv.id === activeId ? 500 : 400,
                                        }}>{conv.title}</span>
                                        <button
                                            onClick={e => deleteConversation(conv.id, e)}
                                            style={{
                                                width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer',
                                                flexShrink: 0, opacity: 0,
                                            }}
                                            className="conv-delete"
                                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                                        >
                                            <Trash2 size={11} color="#EF4444" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ── Chat Area ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '20px 24px',
                        display: 'flex', flexDirection: 'column', gap: 20,
                        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent',
                    }}>
                        {/* Empty state */}
                        {(!activeConversation || activeConversation.messages.length === 0) && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: '20px 0' }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 16,
                                    background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))',
                                    border: '1px solid rgba(245,158,11,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Sparkles size={24} color={C.amber} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
                                        What can I help you with?
                                    </p>
                                    <p style={{ fontSize: 13, color: C.muted, margin: 0, maxWidth: 360 }}>
                                        I know your live pipeline data and the current Indian real estate market inside out.
                                    </p>
                                </div>
                                {/* Quick prompts grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 520 }}>
                                    {QUICK_PROMPTS.map((p, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(p.text)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                                                background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                                                color: C.text, fontSize: 12.5, textAlign: 'left', lineHeight: 1.4,
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => {
                                                const b = e.currentTarget
                                                b.style.background = 'rgba(245,158,11,0.07)'
                                                b.style.borderColor = 'rgba(245,158,11,0.3)'
                                            }}
                                            onMouseLeave={e => {
                                                const b = e.currentTarget
                                                b.style.background = 'rgba(255,255,255,0.03)'
                                                b.style.borderColor = C.border
                                            }}
                                        >
                                            <span style={{ color: C.amber, flexShrink: 0 }}>{p.icon}</span>
                                            <span>{p.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Message thread */}
                        {activeConversation?.messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                    gap: 12, alignItems: 'flex-start',
                                }}
                            >
                                {/* Avatar */}
                                <div style={{
                                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                    background: msg.role === 'user'
                                        ? 'rgba(59,130,246,0.15)'
                                        : 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.08))',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.3)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {msg.role === 'user'
                                        ? <User size={14} color="#60A5FA" />
                                        : <Bot size={14} color={C.amber} />}
                                </div>

                                {/* Bubble */}
                                <div style={{
                                    maxWidth: '78%',
                                    background: msg.role === 'user'
                                        ? 'rgba(59,130,246,0.1)'
                                        : 'rgba(255,255,255,0.035)',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.07)'}`,
                                    borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                                    padding: '12px 16px',
                                }}>
                                    {msg.content === '' && msg.role === 'assistant'
                                        ? <TypingDots />
                                        : <MessageContent content={msg.content} />
                                    }
                                </div>
                            </div>
                        ))}
                        {/* Loading indicator when no placeholder yet */}
                        {loading && activeConversation && activeConversation.messages[activeConversation.messages.length - 1]?.role === 'user' && (
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot size={14} color={C.amber} />
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px 14px 14px 14px', padding: '12px 16px' }}>
                                    <TypingDots />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* ── Input Bar ── */}
                    <div style={{
                        padding: '12px 16px 16px',
                        borderTop: `1px solid ${C.border}`,
                        background: 'rgba(8,13,24,0.4)',
                        flexShrink: 0,
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'flex-end', gap: 10,
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid rgba(255,255,255,0.09)`,
                            borderRadius: 14, padding: '10px 12px',
                            transition: 'border-color 0.15s',
                        }}
                            onFocusCapture={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
                            onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                        >
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about your leads, pipeline, market trends…   (↵ to send, ⇧↵ for newline)"
                                rows={1}
                                disabled={loading}
                                style={{
                                    flex: 1, background: 'transparent', border: 'none',
                                    color: C.text, fontSize: 13.5, resize: 'none', outline: 'none',
                                    fontFamily: 'Inter, system-ui, sans-serif',
                                    lineHeight: 1.55, maxHeight: 140, overflow: 'auto',
                                }}
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || loading}
                                style={{
                                    width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                                    background: input.trim() && !loading ? C.amber : 'rgba(255,255,255,0.07)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {loading
                                    ? <Loader2 size={15} color={C.muted} style={{ animation: 'spin 1s linear infinite' }} />
                                    : <Send size={15} color={input.trim() ? '#000' : C.muted} />
                                }
                            </button>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center', margin: '8px 0 0' }}>
                            AI advisor · Powered by Claude · Responses grounded in your live business data
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
