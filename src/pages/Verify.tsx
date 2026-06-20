import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../lib/claude'

type Tab = 'email' | 'phone'

const COUNTRY_CODES = [
  { flag: '🇬🇧', name: 'United Kingdom', code: '+44' },
  { flag: '🇺🇸', name: 'United States',  code: '+1'  },
  { flag: '🇨🇦', name: 'Canada',          code: '+1'  },
  { flag: '🇮🇳', name: 'India',           code: '+91' },
  { flag: '🇵🇰', name: 'Pakistan',        code: '+92' },
  { flag: '🇳🇬', name: 'Nigeria',         code: '+234'},
  { flag: '🇵🇱', name: 'Poland',          code: '+48' },
  { flag: '🇷🇴', name: 'Romania',         code: '+40' },
  { flag: '🇧🇩', name: 'Bangladesh',      code: '+880'},
  { flag: '🇵🇭', name: 'Philippines',     code: '+63' },
  { flag: '🇿🇦', name: 'South Africa',    code: '+27' },
  { flag: '🇮🇪', name: 'Ireland',         code: '+353'},
  { flag: '🇦🇺', name: 'Australia',       code: '+61' },
  { flag: '🇩🇪', name: 'Germany',         code: '+49' },
  { flag: '🇫🇷', name: 'France',          code: '+33' },
  { flag: '🇪🇸', name: 'Spain',           code: '+34' },
  { flag: '🇮🇹', name: 'Italy',           code: '+39' },
  { flag: '🇵🇹', name: 'Portugal',        code: '+351'},
  { flag: '🇧🇷', name: 'Brazil',          code: '+55' },
  { flag: '🇲🇽', name: 'Mexico',          code: '+52' },
  { flag: '🇦🇪', name: 'UAE',             code: '+971'},
  { flag: '🇸🇦', name: 'Saudi Arabia',    code: '+966'},
  { flag: '🇨🇳', name: 'China',           code: '+86' },
  { flag: '🇯🇵', name: 'Japan',           code: '+81' },
]

export default function Verify() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { fileName?: string; sessionId?: string; jobCount?: number } | null
  const sessionId = state?.sessionId ?? ''
  const fileName  = state?.fileName  ?? ''
  const jobCount  = state?.jobCount  ?? 0

  const [profileLoading, setProfileLoading] = useState(true)
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [tab, setTab] = useState<Tab>('email')
  const [countryCode, setCountryCode] = useState('+44')

  const [codeSent,  setCodeSent]  = useState(false)
  const [code,      setCode]      = useState('')
  const [sending,   setSending]   = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    if (!sessionId) { setProfileLoading(false); return }
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const { data } = await supabase.from('sessions').select('profile').eq('id', sessionId).single()
      if (data?.profile) {
        const p = data.profile as UserProfile
        setName(p.name   ?? '')
        setEmail(p.email ?? '')
        setPhone(p.phone ?? '')
        if (!p.email && p.phone) setTab('phone')
        setProfileLoading(false)
        clearInterval(poll)
      } else if (attempts >= 12) {
        setProfileLoading(false)
        clearInterval(poll)
      }
    }, 1000)
    return () => clearInterval(poll)
  }, [sessionId])

  function resetCode() { setCodeSent(false); setCode(''); setCodeError(''); setSendError('') }

  const fullPhone = countryCode + phone.replace(/\s/g, '')

  async function sendCode() {
    setSendError('')
    setSending(true)
    let error: { message: string } | null = null

    if (tab === 'email') {
      if (!email.trim()) { setSendError('Enter an email address.'); setSending(false); return }
      ;({ error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }))
    } else {
      if (!phone.trim()) { setSendError('Enter a phone number.'); setSending(false); return }
      ;({ error } = await supabase.auth.signInWithOtp({ phone: fullPhone, options: { shouldCreateUser: true } }))
    }

    setSending(false)
    if (error) { setSendError(error.message); return }
    setCodeSent(true)
  }

  async function verifyCode() {
    if (code.trim().length < 6) { setCodeError('Enter the 6-digit code.'); return }
    setCodeError('')
    setVerifying(true)
    let error: { message: string } | null = null

    if (tab === 'email') {
      ;({ error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }))
    } else {
      ;({ error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: code.trim(), type: 'sms' }))
    }

    setVerifying(false)
    if (error) { setCodeError('Invalid or expired code — try again.'); return }
    navigate('/results', { state: { fileName, sessionId, jobCount } })
  }

  const initial = name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight:'100vh', background:'#fafaf9', display:'flex', flexDirection:'column', alignItems:'center', fontFamily:'Hanken Grotesk, sans-serif' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform:rotate(360deg); } }
        .fu { animation: fadeUp .3s ease-out both; }
        .d1 { animation-delay:.07s; }
        select { appearance: none; -webkit-appearance: none; }
      `}</style>

      <nav style={{ width:'100%', display:'flex', alignItems:'center', padding:'18px 40px', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
        <div style={{ fontWeight:800, fontSize:20, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'#FF5A1F', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
          GigNearby
        </div>
      </nav>

      <div style={{ width:'100%', maxWidth:440, padding:'56px 24px 80px' }}>
        {profileLoading ? (
          <div style={{ textAlign:'center', paddingTop:40 }}>
            <div style={{ display:'inline-block', width:32, height:32, borderRadius:'50%', border:'3px solid #FF5A1F', borderTopColor:'transparent', animation:'spin 0.9s linear infinite', marginBottom:16 }} />
            <p style={{ color:'#6b7280', fontSize:14 }}>Reading your CV…</p>
          </div>
        ) : (
          <>
            <div className="fu" style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ width:68, height:68, borderRadius:'50%', background:'#FF5A1F', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, margin:'0 auto 14px' }}>
                {initial}
              </div>
              <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.5px', marginBottom:4 }}>
                {name || 'Verify your identity'}
              </h1>
              <p style={{ fontSize:14, color:'#6b7280' }}>We'll send a 6-digit code to confirm it's you</p>
            </div>

            {/* Tab toggle */}
            <div className="fu d1" style={{ display:'flex', background:'#f3f4f6', borderRadius:10, padding:4, marginBottom:24, gap:4 }}>
              {(['email', 'phone'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); resetCode() }} style={{
                  flex:1, padding:'9px 0', borderRadius:8, border:'none', fontSize:13, fontWeight:600, cursor:'pointer',
                  background: tab === t ? '#fff' : 'transparent',
                  color:      tab === t ? '#111' : '#6b7280',
                  boxShadow:  tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition:'all .15s',
                }}>
                  {t === 'email' ? '✉ Email' : '📱 Phone'}
                </button>
              ))}
            </div>

            {!codeSent ? (
              <div className="fu d1">
                {tab === 'email' ? (
                  <>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setSendError('') }}
                      onKeyDown={e => e.key === 'Enter' && sendCode()}
                      placeholder="your@email.com"
                      autoFocus
                      style={{ width:'100%', boxSizing:'border-box', border:'1.5px solid #d1d5db', borderRadius:10, padding:'12px 14px', fontSize:15, outline:'none', color:'#111', background:'#fff', marginBottom:8, transition:'border-color .15s' }}
                      onFocus={e => (e.target.style.borderColor = '#FF5A1F')}
                      onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
                    />
                  </>
                ) : (
                  <>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Phone number</label>
                    <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                      {/* Country code dropdown */}
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <select
                          value={countryCode}
                          onChange={e => setCountryCode(e.target.value)}
                          style={{
                            height:'100%', border:'1.5px solid #d1d5db', borderRadius:10,
                            padding:'12px 36px 12px 12px', fontSize:14, outline:'none',
                            background:'#fff', color:'#111', cursor:'pointer', fontFamily:'Hanken Grotesk, sans-serif',
                          }}
                        >
                          {COUNTRY_CODES.map(c => (
                            <option key={c.flag + c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                        {/* Custom caret */}
                        <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', fontSize:10, color:'#6b7280' }}>▾</span>
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setSendError('') }}
                        onKeyDown={e => e.key === 'Enter' && sendCode()}
                        placeholder="7700 900000"
                        autoFocus
                        style={{ flex:1, border:'1.5px solid #d1d5db', borderRadius:10, padding:'12px 14px', fontSize:15, outline:'none', color:'#111', background:'#fff', transition:'border-color .15s' }}
                        onFocus={e => (e.target.style.borderColor = '#FF5A1F')}
                        onBlur={e  => (e.target.style.borderColor = '#d1d5db')}
                      />
                    </div>
                  </>
                )}

                {sendError && <p style={{ fontSize:12, color:'#dc2626', marginBottom:10 }}>{sendError}</p>}

                <button
                  onClick={sendCode}
                  disabled={sending || !(tab === 'email' ? email.trim() : phone.trim())}
                  style={{ width:'100%', background:'#FF5A1F', color:'#fff', border:'none', borderRadius:10, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity: sending ? 0.7 : 1 }}
                >
                  {sending ? 'Sending…' : 'Send verification code →'}
                </button>

                <div style={{ textAlign:'center', marginTop:20 }}>
                  <button onClick={() => navigate('/results', { state: { fileName, sessionId, jobCount } })} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>
                    Skip for now
                  </button>
                </div>
              </div>
            ) : (
              <div className="fu" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'24px 22px' }}>
                <p style={{ fontSize:13, color:'#374151', marginBottom:20, lineHeight:1.6 }}>
                  {tab === 'email'
                    ? <>Code sent to <strong>{email}</strong>.</>
                    : <>Code sent via SMS to <strong>{fullPhone}</strong>.</>
                  }
                  <button onClick={resetCode} style={{ background:'none', border:'none', color:'#FF5A1F', fontSize:13, fontWeight:600, cursor:'pointer', padding:0, marginLeft:6 }}>
                    Change
                  </button>
                </p>

                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>6-digit code</label>
                <input
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
                  onKeyDown={e => e.key === 'Enter' && verifyCode()}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  style={{ width:'100%', boxSizing:'border-box', border:`1.5px solid ${codeError ? '#fca5a5' : '#d1d5db'}`, borderRadius:10, padding:'12px 14px', fontSize:28, fontWeight:700, letterSpacing:'0.3em', outline:'none', color:'#111', background:'#fff', textAlign:'center', marginBottom:8 }}
                />
                {codeError && <p style={{ fontSize:12, color:'#dc2626', marginBottom:10 }}>{codeError}</p>}

                <button
                  onClick={verifyCode}
                  disabled={verifying || code.length < 6}
                  style={{ width:'100%', background:'#FF5A1F', color:'#fff', border:'none', borderRadius:10, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity: (verifying || code.length < 6) ? 0.6 : 1 }}
                >
                  {verifying ? 'Verifying…' : 'Verify & see my matches →'}
                </button>

                <button onClick={sendCode} style={{ width:'100%', marginTop:10, background:'none', border:'none', color:'#9ca3af', fontSize:12, cursor:'pointer' }}>
                  Resend code
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
