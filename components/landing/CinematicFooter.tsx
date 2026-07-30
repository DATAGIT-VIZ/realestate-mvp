'use client'

import * as React from 'react'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Link from 'next/link'
import { Heart } from '@phosphor-icons/react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

// ── Scoped styles ─────────────────────────────────────────────────────────────
const STYLES = `
.cf-wrapper {
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;

  --pill-bg-1: rgba(255,255,255,0.04);
  --pill-bg-2: rgba(255,255,255,0.01);
  --pill-shadow: rgba(0,0,0,0.5);
  --pill-highlight: rgba(255,255,255,0.08);
  --pill-inset-shadow: rgba(0,0,0,0.6);
  --pill-border: rgba(255,255,255,0.08);

  --pill-bg-1-hover: rgba(255,255,255,0.10);
  --pill-bg-2-hover: rgba(255,255,255,0.03);
  --pill-border-hover: rgba(255,255,255,0.20);
  --pill-shadow-hover: rgba(0,0,0,0.70);
  --pill-highlight-hover: rgba(255,255,255,0.18);
}

@keyframes cf-breathe {
  0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.5; }
  100% { transform: translate(-50%,-50%) scale(1.1); opacity: 0.85; }
}

@keyframes cf-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

@keyframes cf-heartbeat {
  0%,100% { transform: scale(1); }
  15%,45% { transform: scale(1.25); }
  30%     { transform: scale(1); }
}

.cf-breathe   { animation: cf-breathe  8s ease-in-out infinite alternate; }
.cf-marquee   { animation: cf-marquee 38s linear infinite; }
.cf-heartbeat { animation: cf-heartbeat 2s cubic-bezier(0.25,1,0.5,1) infinite; }

.cf-grid {
  background-size: 60px 60px;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}

.cf-aurora {
  background: radial-gradient(
    circle at 50% 50%,
    rgba(0,56,168,0.18) 0%,
    rgba(0,71,171,0.10) 40%,
    transparent 70%
  );
}

.cf-pill {
  background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
  box-shadow:
    0 10px 30px -10px var(--pill-shadow),
    inset 0 1px 1px var(--pill-highlight),
    inset 0 -1px 2px var(--pill-inset-shadow);
  border: 1px solid var(--pill-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  color: rgba(255,255,255,0.55);
}

.cf-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
  border-color: var(--pill-border-hover);
  box-shadow:
    0 20px 40px -10px var(--pill-shadow-hover),
    inset 0 1px 1px var(--pill-highlight-hover);
  color: #fff;
}

.cf-bg-text {
  font-size: 22vw;
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255,255,255,0.04);
  background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 60%);
  -webkit-background-clip: text;
  background-clip: text;
  white-space: nowrap;
}

.cf-heading {
  background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.4) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0px 0px 20px rgba(255,255,255,0.12));
}
`

// ── Magnetic button ───────────────────────────────────────────────────────────
type MagneticProps = {
  as?: React.ElementType
  className?: string
  children: React.ReactNode
  onClick?: () => void
  href?: string
  style?: React.CSSProperties
  [key: string]: unknown
}

function MagneticButton({ as: Tag = 'button', className = '', children, ...rest }: MagneticProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ctx = gsap.context(() => {
      const onMove = (e: MouseEvent) => {
        const r = el.getBoundingClientRect()
        const x = e.clientX - r.left - r.width / 2
        const y = e.clientY - r.top - r.height / 2
        gsap.to(el, { x: x * 0.4, y: y * 0.4, rotationX: -y * 0.15, rotationY: x * 0.15, scale: 1.05, ease: 'power2.out', duration: 0.4 })
      }
      const onLeave = () => {
        gsap.to(el, { x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1, ease: 'elastic.out(1,0.3)', duration: 1.2 })
      }
      el.addEventListener('mousemove', onMove as EventListener)
      el.addEventListener('mouseleave', onLeave)
      return () => {
        el.removeEventListener('mousemove', onMove as EventListener)
        el.removeEventListener('mouseleave', onLeave)
      }
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <Tag ref={ref} className={`cursor-pointer ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

// ── Marquee strip content ─────────────────────────────────────────────────────
function MarqueeItem() {
  return (
    <div className="flex items-center gap-12 px-6 text-xs font-bold tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.28)' }}>
      <span>Portal Sync</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
      <span>AI Lead Scoring</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
      <span>Zero Manual Entry</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
      <span>Auto Follow-ups</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
      <span>Real-time Pipeline</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
      <span>Smart Assignment</span>
      <span style={{ color: 'rgba(255,255,255,0.12)' }}>✦</span>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CinematicFooter() {
  const wrapperRef   = useRef<HTMLDivElement>(null)
  const giantTextRef = useRef<HTMLDivElement>(null)
  const headingRef   = useRef<HTMLHeadingElement>(null)
  const linksRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !wrapperRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(giantTextRef.current,
        { y: '10vh', scale: 0.85, opacity: 0 },
        { y: '0vh', scale: 1, opacity: 1, ease: 'power1.out',
          scrollTrigger: { trigger: wrapperRef.current, start: 'top 80%', end: 'bottom bottom', scrub: 1 } }
      )
      gsap.fromTo([headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.15, ease: 'power3.out',
          scrollTrigger: { trigger: wrapperRef.current, start: 'top 40%', end: 'bottom bottom', scrub: 1 } }
      )
    }, wrapperRef)
    return () => ctx.revert()
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* Curtain-reveal wrapper — sits in normal flow, clip-path shows the fixed footer beneath */}
      <div
        ref={wrapperRef}
        className="relative h-screen w-full"
        style={{ clipPath: 'polygon(0% 0, 100% 0%, 100% 100%, 0 100%)' }}
      >
        <footer
          className="fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden cf-wrapper"
          style={{ background: '#0C0C0B' }}
        >
          {/* Aurora glow */}
          <div className="cf-aurora cf-breathe absolute left-1/2 top-1/2 h-[60vh] w-[80vw] rounded-[50%] blur-[80px] pointer-events-none z-0" />

          {/* Grid */}
          <div className="cf-grid absolute inset-0 z-0 pointer-events-none" />

          {/* Giant bg text */}
          <div
            ref={giantTextRef}
            className="cf-bg-text absolute -bottom-[5vh] left-1/2 -translate-x-1/2 z-0 pointer-events-none select-none"
          >
            LEAD GAP
          </div>

          {/* ── Diagonal marquee ── */}
          <div
            className="absolute top-10 left-0 w-full overflow-hidden py-4 z-10 -rotate-2 scale-110"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(12,12,11,0.7)', backdropFilter: 'blur(12px)' }}
          >
            <div className="cf-marquee flex w-max">
              <MarqueeItem /><MarqueeItem />
            </div>
          </div>

          {/* ── Centre content ── */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 mt-20 w-full max-w-5xl mx-auto">
            <h2
              ref={headingRef}
              className="cf-heading text-5xl md:text-8xl font-black tracking-tighter mb-12 text-center"
            >
              Start closing more.
            </h2>

            <div ref={linksRef} className="flex flex-col items-center gap-5 w-full">
              {/* Primary CTAs */}
              <div className="flex flex-wrap justify-center gap-4">
                <MagneticButton
                  as={Link}
                  href="/signup"
                  className="px-10 py-5 rounded-full text-[15px] font-bold text-white flex items-center gap-2"
                  style={{ background: '#0038A8', boxShadow: '0 0 40px rgba(0,56,168,0.35)' } as React.CSSProperties}
                >
                  Get started free
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </MagneticButton>

                <MagneticButton
                  as={Link}
                  href="/login"
                  className="cf-pill px-10 py-5 rounded-full text-[15px] font-bold flex items-center gap-2"
                >
                  Talk to sales
                </MagneticButton>
              </div>

              {/* Secondary pill links */}
              <div className="flex flex-wrap justify-center gap-3 mt-1">
                {['Privacy Policy', 'Terms of Service', 'Contact'].map(label => (
                  <MagneticButton key={label} as="a" href="#" className="cf-pill px-5 py-2.5 rounded-full text-xs font-semibold">
                    {label}
                  </MagneticButton>
                ))}
              </div>
            </div>
          </div>

          {/* ── Bottom bar ── */}
          <div
            className="relative z-20 w-full pb-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-5"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Copyright */}
            <span className="text-[10px] md:text-[11px] font-semibold tracking-widest uppercase order-2 md:order-1" style={{ color: 'rgba(255,255,255,0.22)' }}>
              © 2026 Lead Gap CRM · All rights reserved.
            </span>

            {/* Crafted by badge */}
            <div className="cf-pill px-5 py-2.5 rounded-full flex items-center gap-2 order-1 md:order-2 cursor-default">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Crafted with</span>
              <span className="cf-heartbeat inline-flex text-red-500">
                <Heart size={13} weight="fill" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>by</span>
              <span className="text-[12px] font-black tracking-tight text-white ml-0.5">aixture</span>
            </div>

            {/* Back to top */}
            <MagneticButton
              as="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-11 h-11 rounded-full cf-pill flex items-center justify-center group order-3"
            >
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </MagneticButton>
          </div>
        </footer>
      </div>
    </>
  )
}
