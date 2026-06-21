import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { isValidPhoneNumber, parsePhoneNumber, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../lib/claude'

const COUNTRIES: CountryCode[] = ['US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'IN', 'PH', 'NG', 'ZA', 'MX', 'BR', 'ES', 'FR', 'DE', 'IT', 'PL', 'PT', 'NL']
const flag = (cc: string) => cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1.5px solid #d1d5db', borderRadius: 10,
  padding: '11px 13px', fontSize: 15, outline: 'none', color: '#111', background: '#fff',
  fontFamily: 'Hanken Grotesk, sans-serif',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }

export default function Verify() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { fileName?: string; sessionId?: string; jobCount?: number } | null
  const sessionId = state?.sessionId ?? ''
  const fileName  = state?.fileName  ?? ''
  const jobCount  = state?.jobCount  ?? 0

  const [profileLoading, setProfileLoading] = useState(true)
  const [profileObj, setProfileObj] = useState<UserProfile | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [locationField, setLocationField] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<CountryCode>('US')
  const [agreed, setAgreed] = useState(false)
  const [e164, setE164] = useState('')

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
        setProfileObj(p)
        setName(p.name ?? '')
        setEmail(p.email ?? '')
        setLocationField(p.location ?? '')
        setRole(p.currentRole ?? '')
        // Prefill phone via proper parsing (keeps country + national number correct)
        try {
          const parsed = p.phone ? parsePhoneNumber(p.phone, 'US') : undefined
          if (parsed) { setCountry((parsed.country ?? 'US') as CountryCode); setPhone(parsed.nationalNumber) }
          else setPhone((p.phone ?? '').replace(/\D/g, ''))
        } catch { setPhone((p.phone ?? '').replace(/\D/g, '')) }
        setProfileLoading(false)
        clearInterval(poll)
      } else if (attempts >= 12) {
        setProfileLoading(false)
        clearInterval(poll)
      }
    }, 1000)
    return () => clearInterval(poll)
  }, [sessionId])

  async function sendCode() {
    setSendError('')
    if (!name.trim()) { setSendError('Add your name first.'); return }
    if (!agreed) { setSendError('Please tick the box to get WhatsApp job updates.'); return }
    let phoneE164 = ''
    try {
      if (!isValidPhoneNumber(phone, country)) { setSendError('Enter a valid phone number for the selected country.'); return }
      phoneE164 = parsePhoneNumber(phone, country).number
    } catch { setSendError('Enter a valid phone number for the selected country.'); return }

    setSending(true)
    // signInWithOtp works for both new AND returning numbers (updateUser 422s
    // on an existing phone). After verify we reassign the session to this user.
    const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 })
    setSending(false)
    if (error) { setSendError(error.message); return }
    setE164(phoneE164)
    setCodeSent(true)
  }

  async function verifyCode() {
    if (code.trim().length < 6) { setCodeError('Enter the 6-digit code.'); return }
    setCodeError('')
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' })
    if (error) { setVerifying(false); setCodeError('Invalid or expired code — try again.'); return }

    // Now authenticated as the phone identity. Reassign the anon-created session
    // (and CV) to this user + save the reviewed profile, all server-side.
    const profile = { ...(profileObj ?? {}), name: name.trim(), email: email.trim(), location: locationField.trim(), currentRole: role.trim(), phone: e164 }
    await supabase.functions.invoke('claim-session', { body: { sessionId, profile } })
    localStorage.setItem('gg_sid', sessionId)

    supabase.functions.invoke('send-whatsapp', { body: { phone: e164, name: name.trim(), role: role.trim(), location: locationField.trim() } }).catch(() => {})

    setVerifying(false)
    navigate('/results', { state: { fileName, sessionId, jobCount } })
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F5F6FA', display:'flex', flexDirection:'column', alignItems:'center', fontFamily:'Hanken Grotesk, sans-serif' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform:rotate(360deg); } }
        .fu { animation: fadeUp .3s ease-out both; }
        .vf:focus { border-color:#FF5A1F !important; }
        select { appearance:none; -webkit-appearance:none; }
      `}</style>

      <nav style={{ width:'100%', display:'flex', alignItems:'center', padding:'18px 40px', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
        <div style={{ fontWeight:800, fontSize:20, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'#FF5A1F', display:'flex', alignItems:'center', justifyContent:'center' }}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
          GigNearby
        </div>
      </nav>

      <div style={{ width:'100%', maxWidth:460, padding:'40px 24px 80px' }}>
        {profileLoading ? (
          <div style={{ textAlign:'center', paddingTop:40 }}>
            <div style={{ display:'inline-block', width:32, height:32, borderRadius:'50%', border:'3px solid #FF5A1F', borderTopColor:'transparent', animation:'spin 0.9s linear infinite', marginBottom:16 }} />
            <p style={{ color:'#5A6178', fontSize:14 }}>Reading your CV & building your profile…</p>
          </div>
        ) : !codeSent ? (
          <>
            <div className="fu" style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#E8430A', marginBottom:8 }}>Review your profile</div>
              <h1 style={{ fontFamily:'Archivo, sans-serif', fontSize:28, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>Here's what we pulled from your CV.</h1>
              <p style={{ fontSize:14.5, color:'#5A6178', lineHeight:1.55 }}>Check it's right, then verify your number. We'll match you to jobs near you and send updates to your WhatsApp.</p>
            </div>

            <div className="fu" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:'22px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={labelStyle}>Full name</label>
                <input className="vf" style={field} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label style={labelStyle}>Most recent role</label>
                <input className="vf" style={field} value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Warehouse Operative" />
              </div>
              <div>
                <label style={labelStyle}>Location <span style={{ color:'#9ca3af', fontWeight:400 }}>(we match jobs near here)</span></label>
                <input className="vf" style={field} value={locationField} onChange={e => setLocationField(e.target.value)} placeholder="City, State" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input className="vf" style={field} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>
              <div>
                <label style={labelStyle}>Phone <span style={{ color:'#9ca3af', fontWeight:400 }}>(verified — used for WhatsApp job alerts)</span></label>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <select value={country} onChange={e => setCountry(e.target.value as CountryCode)} style={{ ...field, width:'auto', padding:'11px 30px 11px 12px', cursor:'pointer' }}>
                      {COUNTRIES.map(c => <option key={c} value={c}>{flag(c)} +{getCountryCallingCode(c)}</option>)}
                    </select>
                    <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', fontSize:10, color:'#6b7280' }}>▾</span>
                  </div>
                  <input className="vf" style={{ ...field, flex:1 }} type="tel" inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); setSendError('') }} placeholder="phone number" />
                </div>
              </div>

              {/* Extracted profile (read-only) */}
              {(profileObj?.summary || (profileObj?.skills?.length ?? 0) > 0 || (profileObj?.certifications?.length ?? 0) > 0 || (profileObj?.experience?.length ?? 0) > 0) && (
                <div style={{ borderTop:'1px solid #eef0f5', paddingTop:14, display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em' }}>What we pulled from your CV</div>
                  {profileObj?.summary && <p style={{ fontSize:13.5, color:'#374151', lineHeight:1.55, margin:0 }}>{profileObj.summary}</p>}
                  {(profileObj?.skills?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:'#5A6178', marginBottom:7 }}>Skills</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {profileObj!.skills!.map(s => <span key={s} style={{ fontSize:12, fontWeight:600, background:'#FFF5F0', color:'#E8430A', border:'1px solid #FFD0BD', borderRadius:100, padding:'3px 10px' }}>{s}</span>)}
                      </div>
                    </div>
                  )}
                  {(profileObj?.certifications?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:'#5A6178', marginBottom:7 }}>Certifications</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {profileObj!.certifications!.map(c => <span key={c} style={{ fontSize:12, fontWeight:600, background:'#eef2ff', color:'#2E5BFF', border:'1px solid #c7d2fe', borderRadius:100, padding:'3px 10px' }}>{c}</span>)}
                      </div>
                    </div>
                  )}
                  {(profileObj?.experience?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:'#5A6178', marginBottom:7 }}>Experience</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {profileObj!.experience!.map((e, i) => (
                          <div key={i} style={{ borderLeft:'2px solid #e5e7eb', paddingLeft:10 }}>
                            <div style={{ fontWeight:600, fontSize:13, color:'#111' }}>{e.role}</div>
                            <div style={{ fontSize:12, color:'#5A6178' }}>{e.company}{e.duration ? ` · ${e.duration}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Consent */}
              <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', borderTop:'1px solid #eef0f5', paddingTop:14 }}>
                <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setSendError('') }} style={{ width:18, height:18, marginTop:1, accentColor:'#FF5A1F', flexShrink:0, cursor:'pointer' }} />
                <span style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>You agree to receive job updates via WhatsApp.</span>
              </label>

              {sendError && <p style={{ fontSize:12.5, color:'#dc2626' }}>{sendError}</p>}

              <button onClick={sendCode} disabled={sending} style={{ width:'100%', background:'#FF5A1F', color:'#fff', border:'none', borderRadius:11, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity: sending ? 0.7 : 1, fontFamily:'Archivo, sans-serif' }}>
                {sending ? 'Sending code…' : 'Verify number & continue →'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="fu" style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'#E8430A', marginBottom:8 }}>One last step</div>
              <h1 style={{ fontFamily:'Archivo, sans-serif', fontSize:28, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>Verify your number to continue.</h1>
              <p style={{ fontSize:14.5, color:'#5A6178', lineHeight:1.55 }}>We texted a 6-digit code to <strong style={{ color:'#111' }}>{e164}</strong>.
                <button onClick={() => { setCodeSent(false); setCode(''); setCodeError('') }} style={{ background:'none', border:'none', color:'#FF5A1F', fontSize:14, fontWeight:600, cursor:'pointer', padding:0, marginLeft:6 }}>Change</button>
              </p>
            </div>
            <div className="fu" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:'24px 22px' }}>
              <label style={labelStyle}>6-digit code</label>
              <input
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
                onKeyDown={e => e.key === 'Enter' && verifyCode()}
                placeholder="000000" maxLength={6} inputMode="numeric" autoFocus
                style={{ ...field, fontSize:28, fontWeight:700, letterSpacing:'0.3em', textAlign:'center', borderColor: codeError ? '#fca5a5' : '#d1d5db', marginBottom:8 }}
              />
              {codeError && <p style={{ fontSize:12.5, color:'#dc2626', marginBottom:10 }}>{codeError}</p>}
              <button onClick={verifyCode} disabled={verifying || code.length < 6} style={{ width:'100%', background:'#FF5A1F', color:'#fff', border:'none', borderRadius:11, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity:(verifying || code.length < 6) ? 0.6 : 1, fontFamily:'Archivo, sans-serif' }}>
                {verifying ? 'Verifying…' : 'Confirm & see my matches →'}
              </button>
              <button onClick={sendCode} style={{ width:'100%', marginTop:10, background:'none', border:'none', color:'#9ca3af', fontSize:12, cursor:'pointer' }}>Resend code</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
