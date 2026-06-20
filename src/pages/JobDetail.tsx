import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Job = {
  id: string
  adzuna_id: string
  title: string
  company: string
  location: string
  salary_min: number | null
  salary_max: number | null
  description: string
  contract_time: string | null
  contract_type: string | null
  redirect_url: string
  category: string
  posted_at: string
  score: number
}

function formatSalary(min: number | null, max: number | null) {
  if (!min && !max) return 'Salary not listed'
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

function CompanyInitials({ company, size }: { company: string; size: number }) {
  const initials = company.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
  const hue = [...company].reduce((h, c) => h + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},40%,35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.38, flexShrink: 0, userSelect: 'none',
    }}>{initials}</div>
  )
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showPopup, setShowPopup] = useState(false)

  const isSignedIn = !!localStorage.getItem('gg_sid')

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    supabase.from('job_results').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setJob(data as Job)
        setLoading(false)
      })
  }, [id])

  function handleApply() {
    // Signed-in users can apply directly; everyone else gets the login gate.
    if (isSignedIn && job) {
      window.open(job.redirect_url, '_blank', 'noopener,noreferrer')
    } else {
      setShowPopup(true)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Hanken Grotesk, sans-serif', color: '#9ca3af' }}>
      Loading…
    </div>
  )

  if (notFound || !job) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Hanken Grotesk, sans-serif', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🔍</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: '#111' }}>Job listing not found</div>
      <div style={{ color: '#6b7280', fontSize: 14 }}>This link may have expired or been removed.</div>
      <button onClick={() => navigate('/')} style={{ marginTop: 8, background: '#FF5A1F', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Browse jobs on GigNearby
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'Hanken Grotesk, sans-serif' }}>
      <style>{`
        @keyframes ggFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ggFadeIn { from { opacity:0; } to { opacity:1; } }
        .jd-apply { transition: background .15s, transform .1s; }
        .jd-apply:hover { background: #E8430A !important; transform: translateY(-1px); }
        .jd-apply:active { transform: translateY(0); }
      `}</style>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 17, cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
          GigNearby
        </div>
        <button
          onClick={() => navigate('/')}
          style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
        >
          Find jobs →
        </button>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px 80px' }}>
        <div
          style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: '28px 28px 24px', animation: 'ggFadeUp .3s ease-out both' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
            <CompanyInitials company={job.company} size={60} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#111', lineHeight: 1.2, marginBottom: 4 }}>{job.title}</div>
              <div style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>{job.company}</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📍</span> {job.location}
              </div>
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            {job.contract_time && (
              <span style={{ fontSize: 12, fontWeight: 600, background: job.contract_time === 'full_time' ? '#FFF5F0' : '#fefce8', color: job.contract_time === 'full_time' ? '#E8430A' : '#92400e', border: `1px solid ${job.contract_time === 'full_time' ? '#FFD0BD' : '#fde68a'}`, padding: '3px 10px', borderRadius: 100 }}>
                {job.contract_time === 'full_time' ? 'Full-time' : 'Part-time'}
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, background: '#f3f4f6', color: '#374151', padding: '3px 10px', borderRadius: 100 }}>
              {formatSalary(job.salary_min, job.salary_max)}
            </span>
            {job.category && (
              <span style={{ fontSize: 12, fontWeight: 600, background: '#f3f4f6', color: '#374151', padding: '3px 10px', borderRadius: 100 }}>
                {job.category}
              </span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f3f4f6', marginBottom: 20 }} />

          {/* Description */}
          {job.description && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>About this role</div>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {job.description.length > 1200 ? job.description.slice(0, 1200) + '…' : job.description}
              </div>
            </div>
          )}

          {/* Apply CTA */}
          <button
            className="jd-apply"
            onClick={handleApply}
            style={{ width: '100%', background: '#FF5A1F', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'block' }}
          >
            Apply Now
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
            Powered by <span style={{ color: '#FF5A1F', fontWeight: 700 }}>GigNearby</span> · Free for workers · 32 languages
          </p>
        </div>
      </div>

      {/* Signup popup */}
      {showPopup && (
        <div
          onClick={() => setShowPopup(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'ggFadeIn .2s ease-out' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', maxWidth: 380, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.16)', animation: 'ggFadeUp .25s ease-out' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#111', marginBottom: 8 }}>Log in to apply</div>
              <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                You need a GigNearby account to apply for this role. It's free — Sarah will call you, learn your background, and match you to roles like this one.
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              style={{ width: '100%', background: '#FF5A1F', color: '#fff', border: 'none', borderRadius: 11, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}
            >
              Log in / Sign up — it's free
            </button>
            <button
              onClick={() => setShowPopup(false)}
              style={{ width: '100%', background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
