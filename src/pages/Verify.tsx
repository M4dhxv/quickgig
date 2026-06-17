import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../lib/claude'

export default function Verify() {
  const navigate = useNavigate()
  const location  = useLocation()
  const state = location.state as { fileName?: string; sessionId?: string; jobCount?: number } | null
  const sessionId = state?.sessionId ?? ''
  const fileName  = state?.fileName  ?? ''
  const jobCount  = state?.jobCount  ?? 0

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [editEmail, setEditEmail] = useState(false)
  const [editPhone, setEditPhone] = useState(false)

  const [codeSent,  setCodeSent]  = useState(false)
  const [code,      setCode]      = useState('')
  const [sending,   setSending]   = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [sendError, setSendError] = useState('')

  // Poll Supabase until parse-cv has saved the profile (it runs concurrently with the Analyse animation)
  useEffect(() => {
    if (!sessionId) return
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const { data } = await supabase.from('sessions').select('profile').eq('id', sessionId).single()
      if (data?.profile) {
        const p = data.profile as UserProfile
        setProfile(p)
        setName(p.name   ?? '')
        setEmail(p.email ?? '')
        setPhone(p.phone ?? '')
        setProfileLoading(false)
        clearInterval(poll)
      } else if (attempts >= 12) {
        // Give up after ~12s — profile will be empty, user can fill manually
        setProfileLoading(false)
        clearInterval(poll)
      }
    }, 1000)
    return () => clearInterval(poll)
  }, [sessionId])

  async function sendCode() {
    if (!email.trim()) { setSendError('Enter an email address to receive your code.'); return }
    setSendError('')
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setSending(false)
    if (error) { setSendError(error.message); return }
    setCodeSent(true)
    setEditEmail(false)
  }

  async function verify() {
    if (code.trim().length < 6) { setCodeError('Enter the 6-digit code from your email.'); return }
    setCodeError('')
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setVerifying(false)
    if (error) { setCodeError('Invalid or expired code — try again.'); return }
    proceed()
  }

  function proceed() {
    navigate('/results', { state: { fileName, sessionId, jobCount } })
  }

  const initial = name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .fu { animation: fadeUp .35s ease-out both; }
        .d1 { animation-delay:.06s; }
        .d2 { animation-delay:.12s; }
        .d3 { animation-delay:.18s; }
        .d4 { animation-delay:.24s; }
      `}</style>

      {/* Nav */}
      <nav style={{ width:'100%', display:'flex', alignItems:'center', padding:'18px 40px', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
        <div style={{ fontWeight:800, fontSize:20, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
          giggrab
        </div>
      </nav>

      <div style={{ width:'100%', maxWidth:480, padding:'52px 24px 80px' }}>

        {/* Loading state */}
        {profileLoading ? (
          <div style={{ textAlign:'center', paddingTop:40 }}>
            <div style={{ display:'inline-block', width:32, height:32, borderRadius:'50%', border:'3px solid #10b981', borderTopColor:'transparent', animation:'spin 0.9s linear infinite', marginBottom:16 }} />
            <p style={{ color:'#6b7280', fontSize:14 }}>Reading your CV…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="fu" style={{ textAlign:'center', marginBottom:36 }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'#10b981', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:800, margin:'0 auto 16px' }}>
                {initial}
              </div>
              <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>
                {name || 'Your profile'}
              </h1>
              {profile?.currentRole && (
                <p style={{ fontSize:14, color:'#6b7280' }}>{profile.currentRole}</p>
              )}
            </div>

            {/* Extracted details card */}
            <div className="fu d1" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'20px 20px', marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>We extracted these details from your CV</div>

              {/* Email row */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:5 }}>Email</label>
                {editEmail ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={{ flex:1, border:'1.5px solid #10b981', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', color:'#111', background:'#fff' }}
                      autoFocus
                    />
                    <button onClick={() => setEditEmail(false)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151' }}>Done</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'9px 12px' }}>
                    <span style={{ fontSize:13, color: email ? '#111' : '#9ca3af' }}>{email || 'Not found — click Edit to add'}</span>
                    <button onClick={() => setEditEmail(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#10b981', fontWeight:600, padding:0 }}>Edit</button>
                  </div>
                )}
              </div>

              {/* Phone row */}
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:5 }}>Phone</label>
                {editPhone ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+44 7700 900000"
                      style={{ flex:1, border:'1.5px solid #10b981', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', color:'#111', background:'#fff' }}
                      autoFocus
                    />
                    <button onClick={() => setEditPhone(false)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', color:'#374151' }}>Done</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'9px 12px' }}>
                    <span style={{ fontSize:13, color: phone ? '#111' : '#9ca3af' }}>{phone || 'Not found — click Edit to add'}</span>
                    <button onClick={() => setEditPhone(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#10b981', fontWeight:600, padding:0 }}>Edit</button>
                  </div>
                )}
              </div>
            </div>

            {/* OTP section */}
            <div className="fu d2">
              {!codeSent ? (
                <>
                  <button
                    onClick={sendCode}
                    disabled={sending}
                    style={{ width:'100%', background:'#10b981', color:'#fff', border:'none', borderRadius:10, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity: sending ? 0.7 : 1 }}
                  >
                    {sending ? 'Sending…' : 'Send verification code →'}
                  </button>
                  {sendError && <p style={{ fontSize:12, color:'#dc2626', marginTop:8, textAlign:'center' }}>{sendError}</p>}
                  <p style={{ fontSize:12, color:'#9ca3af', textAlign:'center', marginTop:8 }}>
                    We'll send a 6-digit code to your email
                  </p>
                </>
              ) : (
                <div className="fu" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'20px 20px' }}>
                  <p style={{ fontSize:13, color:'#374151', marginBottom:14, lineHeight:1.5 }}>
                    Code sent to <strong>{email}</strong>. Check your inbox.
                  </p>
                  <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:6 }}>Verification code</label>
                  <input
                    value={code}
                    onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    style={{ width:'100%', border:'1.5px solid #10b981', borderRadius:8, padding:'10px 14px', fontSize:22, fontWeight:700, letterSpacing:'0.25em', outline:'none', color:'#111', background:'#fff', textAlign:'center', boxSizing:'border-box' }}
                    autoFocus
                  />
                  {codeError && <p style={{ fontSize:12, color:'#dc2626', marginTop:6 }}>{codeError}</p>}
                  <button
                    onClick={verify}
                    disabled={verifying || code.length < 6}
                    style={{ width:'100%', marginTop:12, background:'#10b981', color:'#fff', border:'none', borderRadius:10, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity: (verifying || code.length < 6) ? 0.6 : 1 }}
                  >
                    {verifying ? 'Verifying…' : 'Verify & see my matches →'}
                  </button>
                  <button onClick={sendCode} style={{ width:'100%', marginTop:8, background:'none', border:'none', color:'#9ca3af', fontSize:12, cursor:'pointer' }}>
                    Resend code
                  </button>
                </div>
              )}
            </div>

            <div className="fu d3" style={{ textAlign:'center', marginTop:20 }}>
              <button onClick={proceed} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>
                Skip for now →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
