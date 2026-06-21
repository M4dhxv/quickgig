import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  'Construction & Trades', 'Logistics & Warehousing', 'Hospitality & Cleaning',
  'Field & Industrial', 'Admin & Clerical', 'Finance & Operations',
  'Healthcare Admin', 'Dog Walking & Pet Care', 'Care Home & Elderly',
  'Domestic Cleaning', 'Babysitting & Childcare', 'Events & Bar Work',
  'Delivery & Courier', 'Gardening & Grounds', 'Tutoring',
]

const STEPS = [
  { icon: '📄', label: 'Upload your CV once — or just tell us what you do' },
  { icon: '📍', label: 'We match you to real frontline jobs near you, every minute' },
  { icon: '💬', label: 'Get a WhatsApp ping the moment a match drops' },
  { icon: '🥇', label: 'Apply first — before the gig fills up' },
]

const S: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 40px', borderBottom: '1px solid #e5e7eb', background: '#fff',
    position: 'sticky', top: 0, zIndex: 10,
  },
  logo: { fontWeight: 800, fontSize: 20, color: '#111', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 8 },
  logoMark: {
    width: 28, height: 28, borderRadius: 8, background: 'var(--brand)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
  },
  navLinks: { display: 'flex', alignItems: 'center', gap: 32 },
  navLink: { color: 'var(--muted)', fontSize: 14, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' },
  signIn: {
    background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  hero: {
    display: 'grid', gridTemplateColumns: '1fr 420px', gap: 60, alignItems: 'center',
    maxWidth: 1120, margin: '0 auto', padding: '80px 40px',
  },
  h1: { fontSize: 52, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-1.5px', marginBottom: 20 },
  sub: { fontSize: 17, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 440, marginBottom: 32 },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 100,
    padding: '6px 14px', fontSize: 12, fontWeight: 600, marginBottom: 28, color: 'var(--muted)',
  },
  dot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block' },
  uploadBox: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10,
    padding: '12px 14px 12px 16px', cursor: 'pointer', marginBottom: 12,
    transition: 'border-color 0.2s',
  },
  uploadIcon: { color: 'var(--muted)', fontSize: 18 },
  uploadPlaceholder: { flex: 1, color: '#9ca3af', fontSize: 14 },
  browseBtn: {
    background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7,
    padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  hint: { fontSize: 12, color: '#9ca3af', marginBottom: 28 },
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
  chip: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 100,
    padding: '6px 14px', fontSize: 12.5, fontWeight: 500, color: '#374151', cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  darkCard: {
    background: 'var(--card-bg)', borderRadius: 18, padding: 28, color: '#fff',
  },
  stepRow: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '14px 0', borderBottom: '1px solid #2a2a2a',
  },
  stepIcon: {
    width: 36, height: 36, borderRadius: 8, background: '#2a2a2a',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
  },
  stepLabel: { fontSize: 13.5, color: '#d1d5db', lineHeight: 1.5, paddingTop: 7 },
  statsRow: { display: 'flex', justifyContent: 'space-between', paddingTop: 20, gap: 12 },
  statNum: { fontSize: 26, fontWeight: 800, color: '#fff' },
  statLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
}

export default function Landing() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)

  async function handleFile(f: File) {
    setFileName(f.name)
    const sessionId = crypto.randomUUID()
    // This is the canonical session — persist it now so a refresh anywhere
    // in the flow (and the post-payment return) resolves the same identity.
    localStorage.setItem('gg_sid', sessionId)
    const mediaType = f.type || 'application/pdf'

    // Read as base64 so the edge function can send it to Claude as a PDF document
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = (e.target?.result as string) ?? ''
        // DataURL is "data:<type>;base64,<data>" — strip the prefix
        resolve(result.includes(',') ? result.split(',')[1] : result)
      }
      reader.onerror = () => resolve('')
      reader.readAsDataURL(f)
    })

    // Store in sessionStorage to avoid bloating navigate state
    sessionStorage.setItem(`cv-${sessionId}`, JSON.stringify({ base64, mediaType }))

    // Upload the raw file to Supabase Storage (best-effort — bucket must exist)
    supabase.storage.from('cvs').upload(`${sessionId}/${f.name}`, f, { upsert: true })
      .then(({ error }) => { if (error) console.warn('CV storage upload:', error.message) })

    navigate('/analyse', { state: { fileName: f.name, sessionId } })
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  return (
    <div>
      <nav style={S.nav}>
        <div style={S.logo}>
          <div style={S.logoMark}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
          GigNearby
        </div>
        <div style={S.navLinks}>
          <span style={S.navLink} onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</span>
          <span style={S.navLink} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</span>
          <button style={S.signIn} onClick={() => fileRef.current?.click()}>Get started</button>
        </div>
      </nav>

      <div style={S.hero}>
        <div>
          <div className="fade-up">
            <div style={S.badge}>
              <span style={S.dot} />
              48,000+ live jobs
              <span style={{ color: '#d1d5db' }}>·</span>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>Updated every minute</span>
            </div>
          </div>
          <h1 style={S.h1} className="fade-up d1">
            The closest<br />
            jobs, <span style={{ color: 'var(--brand)' }}>first.</span>
          </h1>
          <p style={S.sub} className="fade-up d2">
            Upload your CV once. GigNearby matches you to frontline jobs
            near you and pings you on WhatsApp the moment one opens —
            so you're first in line.
          </p>

          <div className="fade-up d3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.png,.jpg,.jpeg,.webp"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div
              style={{
                ...S.uploadBox,
                borderColor: dragging ? 'var(--brand)' : fileName ? 'var(--brand)' : '#e5e7eb',
                background: dragging ? 'var(--brand-tint)' : '#fff',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span style={S.uploadIcon}>📄</span>
              <span style={{ ...S.uploadPlaceholder, color: fileName ? '#111' : '#9ca3af' }}>
                {fileName || 'Drop your CV or click to browse'}
              </span>
              <button style={S.browseBtn} onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                Browse
              </button>
            </div>
            <p style={S.hint}>PDF, DOC, image &amp; more · Takes 30 seconds</p>
          </div>

          <div style={S.chips} className="fade-up d4">
            {CATEGORIES.map(c => (
              <span
                key={c}
                style={S.chip}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--brand-tint)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'
                  ;(e.currentTarget as HTMLElement).style.background = '#fff'
                }}
                onClick={() => navigate('/analyse', { state: { fileName: `${c} roles.pdf` } })}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div style={S.darkCard} className="fade-up d2">
          {STEPS.map((s, i) => (
            <div key={i} style={{ ...S.stepRow, borderBottom: i === STEPS.length - 1 ? 'none' : '1px solid #2a2a2a' }}>
              <div style={S.stepIcon}>{s.icon}</div>
              <p style={S.stepLabel}>{s.label}</p>
            </div>
          ))}
          <div style={S.statsRow}>
            {[['48k+', 'roles'], ['94%', 'accuracy'], ['12s', 'match time']].map(([n, l]) => (
              <div key={l}>
                <div style={S.statNum}>{n}</div>
                <div style={S.statLabel}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <section id="how" style={{ background: '#fff', borderTop: '1px solid #eef0f5', padding: '72px 40px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--brand-hover)', marginBottom: 12 }}>How it works</div>
          <h2 style={{ fontFamily: 'Archivo, sans-serif', fontSize: 38, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>No forms. No waiting. No chasing.</h2>
          <p style={{ color: 'var(--muted)', fontSize: 17, maxWidth: 560, marginBottom: 40 }}>You do one thing — upload your CV. GigNearby does the rest, and gets you to the closest jobs before anyone else.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {[
              { n: '01', icon: '📄', t: 'Upload once', d: 'Drop your CV — PDF, Word, even a photo. No account, no forms, no fee.' },
              { n: '02', icon: '📍', t: 'Matched nearby', d: 'We read your background and scan live job listings near you, every minute.' },
              { n: '03', icon: '💬', t: 'Pinged on WhatsApp', d: 'The moment a match opens up close to you, your phone buzzes — first.' },
              { n: '04', icon: '🥇', t: 'Apply first', d: "Tap through and apply before the gig fills up. Sarah helps you prep, too." },
            ].map(s => (
              <div key={s.n} style={{ background: 'var(--bg)', border: '1px solid #eef0f5', borderRadius: 16, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon}</div>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: 'var(--brand)', fontWeight: 700 }}>{s.n}</span>
                </div>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{s.t}</div>
                <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: 'var(--ink)', color: '#fff', padding: '72px 40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#ff9c75', marginBottom: 12 }}>Pricing</div>
          <h2 style={{ fontFamily: 'Archivo, sans-serif', fontSize: 38, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>Unlock every job near you.</h2>
          <p style={{ color: '#aab0c4', fontSize: 17, maxWidth: 560, marginBottom: 40 }}>One simple plan gets you every nearby match, instant WhatsApp alerts, and Sarah on call. Cancel anytime.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, maxWidth: 660 }}>
            {[
              { name: 'Weekly', price: '$7.99', period: 'per week', popular: false, feats: ['Every job matched to you', 'Instant WhatsApp alerts', 'Sarah — interview prep & advice'], cta: 'Get Weekly' },
              { name: 'Monthly', price: '$19.99', period: 'per month', popular: true, feats: ['Everything in Weekly', 'New matches the second they post', 'Save 38% vs weekly'], cta: 'Get Monthly' },
            ].map(p => (
              <div key={p.name} style={{ position: 'relative', background: p.popular ? 'var(--brand)' : 'rgba(255,255,255,0.04)', border: `1px solid ${p.popular ? 'var(--brand)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 18, padding: 28 }}>
                {p.popular && <span style={{ position: 'absolute', top: 18, right: 18, background: '#fff', color: 'var(--brand)', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999 }}>Most popular</span>}
                <div style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: 16, color: p.popular ? '#fff' : '#aab0c4', marginBottom: 10 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
                  <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: 40, fontWeight: 900, letterSpacing: '-1px' }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: p.popular ? 'rgba(255,255,255,0.85)' : '#8b91a6' }}>{p.period}</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {p.feats.map(f => (
                    <li key={f} style={{ display: 'flex', gap: 8, fontSize: 14, color: p.popular ? '#fff' : '#d6dae6' }}>
                      <span style={{ color: p.popular ? '#fff' : 'var(--brand)', fontWeight: 800 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none', background: p.popular ? '#fff' : 'var(--brand)', color: p.popular ? 'var(--brand)' : '#fff' }}
                >{p.cta}</button>
              </div>
            ))}
          </div>
          <p style={{ color: '#8b91a6', fontSize: 13, marginTop: 20 }}>Cancel anytime from your profile. No hidden fees.</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#fff', borderTop: '1px solid #eef0f5', padding: '32px 40px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Archivo, sans-serif', fontWeight: 800, fontSize: 18 }}>
            <div style={S.logoMark}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
            GigNearby
          </div>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>The closest jobs, first. · gignearby.com</span>
        </div>
      </footer>
    </div>
  )
}
