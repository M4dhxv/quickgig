import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { isValidPhoneNumber, parsePhoneNumber, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'
import { supabase } from '../lib/supabase'
import { posthog } from '../lib/posthog'

const COUNTRIES: CountryCode[] = ['US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'IN', 'PH', 'NG', 'ZA', 'MX', 'BR', 'ES', 'FR', 'DE', 'IT', 'PL', 'PT', 'NL']
const flag = (cc: string) => cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1.5px solid #d1d5db', borderRadius: 10,
  padding: '11px 13px', fontSize: 15, outline: 'none', color: '#111', background: '#fff', fontFamily: 'Hanken Grotesk, sans-serif',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const nav = location.state as { e164?: string; sent?: boolean } | null

  const [country, setCountry] = useState<CountryCode>('US')
  const [phone, setPhone] = useState('')
  const [e164, setE164] = useState(nav?.e164 ?? '')
  const [codeSent, setCodeSent] = useState(!!nav?.sent)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sendError, setSendError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [noAccount, setNoAccount] = useState(false)

  async function sendCode() {
    setSendError(''); setNoAccount(false)
    let phoneE164 = ''
    try {
      if (!isValidPhoneNumber(phone, country)) { setSendError('Enter a valid phone number for the selected country.'); return }
      phoneE164 = parsePhoneNumber(phone, country).number
    } catch { setSendError('Enter a valid phone number for the selected country.'); return }
    setSending(true)
    // shouldCreateUser:false -> only sends if the account already exists.
    const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164, options: { shouldCreateUser: false } })
    setSending(false)
    if (error) { setNoAccount(true); return }
    setE164(phoneE164); setCodeSent(true)
  }

  async function verifyCode() {
    if (code.trim().length < 6) { setCodeError('Enter the 6-digit code.'); return }
    setCodeError(''); setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' })
    if (error) { setVerifying(false); setCodeError('Invalid or expired code — try again.'); return }
    // Signed in. Go to their most recent session's dashboard (RLS scopes to them).
    const { data } = await supabase.from('sessions').select('id').order('created_at', { ascending: false }).limit(1)
    const sid = data?.[0]?.id
    if (e164) posthog.identify(e164, { phone: e164 })
    posthog.capture('sign_in_completed')
    setVerifying(false)
    if (sid) { localStorage.setItem('gg_sid', sid); navigate('/dashboard', { state: { sessionId: sid } }) }
    else navigate('/')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F5F6FA', display:'flex', flexDirection:'column', alignItems:'center', fontFamily:'Hanken Grotesk, sans-serif' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp .3s ease-out both} .vf:focus{border-color:#FF5A1F !important} select{appearance:none;-webkit-appearance:none}`}</style>

      <nav style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 40px', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
        <div onClick={() => navigate('/')} style={{ fontWeight:800, fontSize:20, display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'#FF5A1F', display:'flex', alignItems:'center', justifyContent:'center' }}><svg viewBox="0 0 24 24" width="64%" height="64%" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2C8.2 2.2 5.2 5.1 5.2 8.8c0 4.7 6.8 12 6.8 12s6.8-7.3 6.8-12c0-3.7-3-6.6-6.8-6.6Z"/><circle cx="12" cy="8.7" r="2.5" fill="#FF5A1F"/></svg></div>
          GigNearby
        </div>
      </nav>

      <div style={{ width:'100%', maxWidth:420, padding:'56px 24px 80px' }}>
        <div className="fu" style={{ marginBottom:24 }}>
          <h1 style={{ fontFamily:'Archivo, sans-serif', fontSize:28, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>Welcome back</h1>
          <p style={{ fontSize:14.5, color:'#5A6178' }}>Sign in with the number you verified to jump back to your matches.</p>
        </div>

        {!codeSent ? (
          <div className="fu" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:'22px 20px' }}>
            <label style={labelStyle}>Phone number</label>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <select value={country} onChange={e => setCountry(e.target.value as CountryCode)} style={{ ...field, width:'auto', padding:'11px 30px 11px 12px', cursor:'pointer' }}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{flag(c)} +{getCountryCallingCode(c)}</option>)}
                </select>
                <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', fontSize:10, color:'#6b7280' }}>▾</span>
              </div>
              <input className="vf" style={{ ...field, flex:1 }} type="tel" inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); setSendError(''); setNoAccount(false) }} placeholder="phone number" />
            </div>
            {sendError && <p style={{ fontSize:12.5, color:'#dc2626', marginTop:10 }}>{sendError}</p>}
            {noAccount && (
              <p style={{ fontSize:13, color:'#374151', marginTop:10, lineHeight:1.5 }}>
                No GigNearby account with that number.{' '}
                <button onClick={() => navigate('/')} style={{ background:'none', border:'none', color:'#FF5A1F', fontWeight:700, cursor:'pointer', padding:0 }}>Upload your CV to get started →</button>
              </p>
            )}
            <button onClick={sendCode} disabled={sending} style={{ width:'100%', marginTop:16, background:'#FF5A1F', color:'#fff', border:'none', borderRadius:11, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity: sending ? 0.7 : 1, fontFamily:'Archivo, sans-serif' }}>
              {sending ? 'Sending…' : 'Send code →'}
            </button>
            <p style={{ textAlign:'center', fontSize:13, color:'#9ca3af', marginTop:16 }}>
              New here?{' '}
              <button onClick={() => navigate('/')} style={{ background:'none', border:'none', color:'#FF5A1F', fontWeight:700, cursor:'pointer', padding:0 }}>Upload your CV</button>
            </p>
          </div>
        ) : (
          <div className="fu" style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:'24px 22px' }}>
            <p style={{ fontSize:13.5, color:'#374151', marginBottom:18 }}>We texted a 6-digit code to <strong style={{ color:'#111' }}>{e164}</strong>.</p>
            <label style={labelStyle}>6-digit code</label>
            <input value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }} onKeyDown={e => e.key === 'Enter' && verifyCode()} placeholder="000000" maxLength={6} inputMode="numeric" autoFocus
              style={{ ...field, fontSize:28, fontWeight:700, letterSpacing:'0.3em', textAlign:'center', borderColor: codeError ? '#fca5a5' : '#d1d5db', marginBottom:8 }} />
            {codeError && <p style={{ fontSize:12.5, color:'#dc2626', marginBottom:10 }}>{codeError}</p>}
            <button onClick={verifyCode} disabled={verifying || code.length < 6} style={{ width:'100%', background:'#FF5A1F', color:'#fff', border:'none', borderRadius:11, padding:'13px 0', fontSize:15, fontWeight:700, cursor:'pointer', opacity:(verifying || code.length < 6) ? 0.6 : 1, fontFamily:'Archivo, sans-serif' }}>
              {verifying ? 'Signing in…' : 'Sign in →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
