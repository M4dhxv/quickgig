import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STEPS = [
  { label: 'Reading your CV', sub: 'Extracting skills, experience and qualifications' },
  { label: 'Understanding your profile', sub: 'Building a semantic model of your background' },
  { label: 'Scanning 48,000 roles', sub: 'Searching across every sector and location' },
  { label: 'Ranking your matches', sub: 'Scoring by fit, salary and commute' },
]

export default function Analyse() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { fileName?: string; sessionId?: string } | null
  const fileName  = state?.fileName  ?? 'your CV'
  const sessionId = state?.sessionId ?? crypto.randomUUID()

  const [step, setStep] = useState(0)
  const [done, setDone] = useState<number[]>([])

  useEffect(() => {
    let jobCount = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    // Create session row immediately
    supabase.from('sessions').upsert({ id: sessionId, file_name: fileName }, { onConflict: 'id', ignoreDuplicates: true }).then(() => {})

    // Read base64 from sessionStorage then call parse-cv
    const cvJson = sessionStorage.getItem(`cv-${sessionId}`)
    const { base64, mediaType } = cvJson ? JSON.parse(cvJson) : {}

    supabase.functions.invoke('parse-cv', { body: { fileName, base64, mediaType } })
      .then(({ data }) => {
        if (data?.profile) {
          // Save profile first — separate from cv_path so a missing column can't block it
          supabase.from('sessions').update({ profile: data.profile }).eq('id', sessionId).then(() => {})
          supabase.from('sessions').update({ cv_path: `${sessionId}/${fileName}` }).eq('id', sessionId).then(() => {})
        }
        sessionStorage.removeItem(`cv-${sessionId}`)
      })
      .catch(() => { sessionStorage.removeItem(`cv-${sessionId}`) })

    // Fetch real job count in parallel
    supabase.functions.invoke('search-jobs', { body: { what: 'warehouse logistics', page: 1, perPage: 1 } })
      .then(({ data }) => { if (data?.count) jobCount = data.count }).catch(() => {})

    STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setStep(i)
        if (i > 0) setDone(d => [...d, i - 1])
      }, i * 1400))
    })
    timers.push(setTimeout(() => {
      setDone([0, 1, 2, 3])
      setTimeout(() => navigate('/verify', { state: { fileName, sessionId, jobCount } }), 600)
    }, STEPS.length * 1400 + 200))

    return () => timers.forEach(clearTimeout)
  }, [navigate, fileName, sessionId])

  const progress = Math.min(100, ((step + 1) / STEPS.length) * 100)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fafaf9', padding: 24 }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ring { animation: pulse-ring 1.4s ease-out infinite; }
        .spin { animation: spin 1.2s linear infinite; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 48, fontWeight: 800, fontSize: 20 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
        GigNearby
      </div>

      <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 40 }}>
        <div className="ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #FF5A1F' }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
      </div>

      <div style={{ width: '100%', maxWidth: 420, marginBottom: 36 }}>
        {STEPS.map((s, i) => {
          const isDone = done.includes(i)
          const isActive = step === i && !isDone
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', opacity: i > step ? 0.35 : 1, transition: 'opacity 0.4s' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: isDone ? '#FF5A1F' : isActive ? '#fef3c7' : 'transparent',
                border: isDone ? 'none' : isActive ? '2px solid #f59e0b' : '2px solid #d1d5db',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                transition: 'all 0.3s',
              }}>
                {isDone ? '✓' : isActive ? (
                  <span className="spin" style={{ display: 'inline-block', borderTop: '2px solid #f59e0b', borderRight: '2px solid transparent', width: 10, height: 10, borderRadius: '50%' }} />
                ) : null}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: isDone ? '#374151' : isActive ? '#111' : '#9ca3af' }}>{s.label}</div>
                {isActive && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.sub}</div>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ width: '100%', maxWidth: 420, height: 3, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', background: '#FF5A1F', borderRadius: 2, width: `${progress}%`, transition: 'width 1.2s ease' }} />
      </div>

      <p style={{ fontSize: 12, color: '#9ca3af' }}>
        Analysing <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{fileName}</span>
      </p>
    </div>
  )
}
