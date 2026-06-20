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
  { icon: '🔍', label: 'Reading your CV for skills, experience and qualifications' },
  { icon: '👤', label: 'Building a profile of your background and career goals' },
  { icon: '📋', label: 'Scanning 48,000 roles across every sector' },
  { icon: '📊', label: 'Ranking matches by fit, location and salary' },
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
          <div style={S.logoMark}>⚡</div>
          giggrab
        </div>
        <div style={S.navLinks}>
          <span style={S.navLink}>How it works</span>
          <span style={S.navLink}>Pricing</span>
          <button style={S.signIn}>Sign In</button>
        </div>
      </nav>

      <div style={S.hero}>
        <div>
          <div className="fade-up">
            <div style={S.badge}>
              <span style={S.dot} />
              48,000+ active roles
              <span style={{ color: '#d1d5db' }}>·</span>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>Matched in seconds</span>
            </div>
          </div>
          <h1 style={S.h1} className="fade-up d1">
            Upload your CV.<br />
            Sarah finds your<br />
            next role.
          </h1>
          <p style={S.sub} className="fade-up d2">
            Sarah reads your CV, understands your background,
            and matches you with real roles across every sector
            — in seconds.
          </p>

          <div className="fade-up d3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
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
            <p style={S.hint}>PDF, DOC or DOCX · Free to match</p>
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
    </div>
  )
}
