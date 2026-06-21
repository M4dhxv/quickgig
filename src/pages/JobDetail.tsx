import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { isValidPhoneNumber, parsePhoneNumber, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'
import { supabase } from '../lib/supabase'

// US first (primary market), then common worker markets
const COUNTRIES: CountryCode[] = ['US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'IN', 'PH', 'NG', 'ZA', 'MX', 'BR', 'ES', 'FR', 'DE', 'IT', 'PL', 'PT', 'NL']
const flag = (cc: string) => cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))

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

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
  padding: '11px 13px', fontSize: 15, outline: 'none', color: '#111', fontFamily: 'inherit',
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [signedIn, setSignedIn] = useState(() => !!localStorage.getItem('gg_sid'))
  const [showPopup, setShowPopup] = useState(false)
  const [step, setStep] = useState<'details' | 'verify'>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState<CountryCode>('US')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    supabase.from('job_results').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true)
        else setJob(data as Job)
        setLoading(false)
      })
  }, [id])

  function openJob() {
    if (job) window.open(job.redirect_url, '_blank', 'noopener,noreferrer')
  }

  function handleApply() {
    if (signedIn) openJob()
    else { setStep('details'); setErr(''); setShowPopup(true) }
  }

  async function sendCode() {
    setErr('')
    if (!name.trim()) return setErr('Enter your name')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr('Enter a valid email')
    let e164 = ''
    try {
      if (!isValidPhoneNumber(phone, country)) return setErr('Enter a valid phone number for the selected country')
      e164 = parsePhoneNumber(phone, country).number
    } catch {
      return setErr('Enter a valid phone number for the selected country')
    }
    setBusy(true)
    try {
      // Real OTP over SMS via Supabase Auth (Twilio).
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 })
      if (error) { setErr(error.message); return }
      setPhone(e164)
      setStep('verify')
    } catch {
      setErr('Could not send the code — try again')
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setErr('')
    if (code.replace(/\D/g, '').length !== 6) return setErr('Enter the 6-digit code')
    setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
      if (error) { setErr('Incorrect or expired code'); return }
      const sid = crypto.randomUUID()
      await supabase.from('sessions').insert({
        id: sid,
        search_term: `shared_job:${id}`,
        profile: { name: name.trim(), email: email.trim(), phone },
      })
      localStorage.setItem('gg_sid', sid)
      setSignedIn(true)
      setShowPopup(false)
    } catch {
      setErr('Something went wrong — try again')
    } finally {
      setBusy(false)
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
        .jd-input:focus { border-color: #FF5A1F !important; }
        .wa-cta { transition: background .15s, transform .1s; }
        .wa-cta:hover { background: #E8430A !important; transform: translateY(-1px); }
        .wa-cta:active { transform: translateY(0); }
      `}</style>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 17, cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FF5A1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
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
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: '28px 28px 24px', animation: 'ggFadeUp .3s ease-out both' }}>
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

          {/* Post-signup WhatsApp upsell */}
          {signedIn && (
            <div style={{ marginTop: 16, position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '22px 22px 20px', background: 'radial-gradient(135% 120% at 0% 0%, #18244e 0%, #0E1633 58%)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 12px 30px rgba(14,22,51,0.25)', animation: 'ggFadeUp .3s ease-out both' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,90,31,0.20) 0%, rgba(255,90,31,0) 70%)' }} />

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,90,31,0.14)', border: '1px solid rgba(255,90,31,0.4)', color: '#ff8455', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 999, marginBottom: 16 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF5A1F', display: 'inline-block' }} />
                  You're in. Now stay ahead
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 900, fontSize: 52, color: '#FF5A1F', lineHeight: 0.85, letterSpacing: '-2px', flexShrink: 0 }}>4×</span>
                  <span style={{ color: '#fff', fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: 19, lineHeight: 1.12 }}>more likely to get hired when you apply first.</span>
                </div>

                <p style={{ color: '#a9b0c7', fontSize: 14, lineHeight: 1.6, marginBottom: 18, maxWidth: '95%' }}>
                  The good jobs near you fill in hours, not days. Stop hunting old listings. We text you the second one opens, so you apply before anyone else even sees it.
                </p>

                <button
                  className="wa-cta"
                  onClick={() => navigate('/')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: '#FF5A1F', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 800, fontFamily: 'Archivo, sans-serif', cursor: 'pointer' }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.8A8 8 0 1 1 21 12Z"/></svg>
                  Get jobs sent to my WhatsApp
                </button>
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 14 }}>
            Powered by <span style={{ color: '#FF5A1F', fontWeight: 700 }}>GigNearby</span>
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
            style={{ background: '#fff', borderRadius: 18, padding: '28px 26px', maxWidth: 400, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.16)', animation: 'ggFadeUp .25s ease-out' }}
          >
            {step === 'details' ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#111', marginBottom: 4 }}>Sign up to apply</div>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Quick — we'll text you a code to verify your number.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input className="jd-input" style={inputStyle} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
                  <input className="jd-input" style={inputStyle} placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={country}
                      onChange={e => setCountry(e.target.value as CountryCode)}
                      style={{ ...inputStyle, width: 'auto', flex: 'none', padding: '11px 8px', cursor: 'pointer' }}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c} value={c}>{flag(c)} +{getCountryCallingCode(c)}</option>
                      ))}
                    </select>
                    <input className="jd-input" style={{ ...inputStyle, flex: 1 }} placeholder="Phone number" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</div>}
                <button onClick={sendCode} disabled={busy} style={{ width: '100%', marginTop: 18, background: '#FF5A1F', color: '#fff', border: 'none', borderRadius: 11, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Sending…' : 'Send verification code'}
                </button>
                <button onClick={() => setShowPopup(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', padding: '8px 0 0' }}>Cancel</button>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 20, color: '#111', marginBottom: 4 }}>Verify your number</div>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>Enter the 6-digit code we sent to <b style={{ color: '#111' }}>{phone}</b>.</div>
                <input
                  className="jd-input"
                  style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.4em', fontSize: 22, fontWeight: 700 }}
                  placeholder="••••••"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{err}</div>}
                <button onClick={verify} disabled={busy} style={{ width: '100%', marginTop: 18, background: '#FF5A1F', color: '#fff', border: 'none', borderRadius: 11, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Verifying…' : 'Verify & continue'}
                </button>
                <button onClick={() => { setStep('details'); setErr('') }} style={{ width: '100%', background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', padding: '8px 0 0' }}>← Change details</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
