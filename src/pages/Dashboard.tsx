import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { searchJobsMulti, formatSalary, timeAgo, matchScore, getMatchBreakdown, type AdzunaJob } from '../lib/adzuna'
import { textToSpeech, DeepgramSTT } from '../lib/deepgram'
import { askSarah, type UserProfile } from '../lib/claude'

const SARAH_REPLIES: Record<string, string> = {
  default: "I've reviewed your matched roles. Your background looks strong for warehouse management and logistics coordination. Which role would you like me to help you prep for?",
  interview: "For warehouse manager interviews, lead with team size and KPIs you've owned — shrinkage rate, on-time dispatch, pick accuracy. They'll ask about peak trading too. Want a full question bank?",
  salary: "Based on current market rates, warehouse managers in the UK are averaging £32–40k. You're in a strong position to negotiate if you can show cost-saving or efficiency wins. Aim high.",
  apply: "I can help you tailor your application. Focus on measurable outcomes — units processed, error rates reduced, headcount managed. Recruiters screen for numbers, not job duties.",
}

type Message = { from: 'user' | 'sarah'; text: string; ts: string }

function getTime() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function scoreColor(s: number) {
  return s >= 88 ? '#10b981' : s >= 75 ? '#f59e0b' : '#6b7280'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { fileName?: string; sessionId?: string } | null

  const [jobs, setJobs] = useState<(AdzunaJob & { score: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState('All')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([
    { from: 'sarah', text: "Hi! I'm scanning live jobs for your profile. Ask me anything — interview prep, salary advice, or to search a specific role.", ts: getTime() },
  ])
  const [chatInput, setChatInput] = useState('')
  const [voiceMode, setVoiceMode] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'listening' | 'thinking' | 'speaking'>('listening')
  const [sessionId] = useState(() => state?.sessionId ?? crypto.randomUUID())

  const [transcript, setTranscript] = useState('')
  const [speakingReply, setSpeakingReply] = useState('')

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLocation, setProfileLocation] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [cvFileName, setCvFileName] = useState(state?.fileName ?? '')
  const [cvViewUrl, setCvViewUrl] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const dgRef = useRef<DeepgramSTT | null>(null)
  const finalTranscriptRef = useRef('')
  const currentTranscriptRef = useRef('')

  const fetchJobs = useCallback(async (term: string, pg: number) => {
    setLoading(true)
    setError('')
    try {
      const city = profileLocation.split(',')[0].trim()
      const { jobs: raw, count } = await searchJobsMulti(term || 'warehouse logistics', city, pg, 10)
      const local = city
        ? raw.filter(j => j.location.toLowerCase().includes(city.toLowerCase()))
        : raw
      const scored = local.map(j => ({ ...j, score: matchScore(j, profileLocation) }))
        .sort((a, b) => b.score - a.score)
      setJobs(scored)
      setTotal(count)

      // Cache to Supabase
      if (scored.length) {
        await supabase.from('job_results').upsert(
          scored.map(j => ({
            session_id: sessionId,
            adzuna_id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
            salary_min: j.salary_min,
            salary_max: j.salary_max,
            description: j.description,
            contract_time: j.contract_time,
            contract_type: j.contract_type,
            redirect_url: j.redirect_url,
            category: j.category,
            posted_at: j.posted_at,
            score: j.score,
          })),
          { onConflict: 'session_id,adzuna_id', ignoreDuplicates: true }
        )
      }
    } catch (e: any) {
      setError('Could not load jobs. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [sessionId, profileLocation])

  useEffect(() => { fetchJobs(search, page) }, [fetchJobs, search, page])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    supabase.from('sessions').select('profile, file_name, cv_path').eq('id', sessionId).single()
      .then(({ data }) => {
        if (data?.profile) {
          setProfile(data.profile as UserProfile)
          if (data.profile.location) setProfileLocation(data.profile.location)
        }
        if (data?.file_name) setCvFileName(data.file_name)
        if (data?.cv_path) {
          const { data: signed } = supabase.storage.from('cvs').getPublicUrl(data.cv_path)
          if (signed?.publicUrl) setCvViewUrl(signed.publicUrl)
        }
      })
  }, [sessionId])

  async function send(text: string) {
    if (!text.trim()) return
    const userMsg: Message = { from: 'user', text, ts: getTime() }
    setMessages(m => [...m, userMsg])
    setChatInput('')

    await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: text })

    const allMsgs = [...messages, userMsg]
    const firstUserIdx = allMsgs.findIndex(m => m.from === 'user')
    const history = allMsgs.slice(firstUserIdx).map(m => ({
      role: m.from === 'user' ? 'user' as const : 'assistant' as const,
      content: m.text,
    }))

    try {
      const reply = await askSarah(history, profile)
      setMessages(m => [...m, { from: 'sarah', text: reply, ts: getTime() }])
      await supabase.from('chat_messages').insert({ session_id: sessionId, role: 'sarah', content: reply })
    } catch {
      setMessages(m => [...m, { from: 'sarah', text: SARAH_REPLIES.default, ts: getTime() }])
    }
  }

  async function toggleSave(job: AdzunaJob & { score: number }) {
    if (savedIds.has(job.id)) {
      await supabase.from('saved_jobs').delete().match({ session_id: sessionId, adzuna_id: job.id })
      setSavedIds(s => { const n = new Set(s); n.delete(job.id); return n })
    } else {
      await supabase.from('saved_jobs').upsert({
        session_id: sessionId, adzuna_id: job.id, title: job.title,
        company: job.company, location: job.location,
        salary_min: job.salary_min, salary_max: job.salary_max, redirect_url: job.redirect_url,
      }, { onConflict: 'session_id,adzuna_id', ignoreDuplicates: true })
      setSavedIds(s => new Set(s).add(job.id))
    }
  }

  async function startVoice() {
    setVoiceMode(true)
    setVoicePhase('listening')
    setTranscript('')
    finalTranscriptRef.current = ''
    currentTranscriptRef.current = ''

    const dg = new DeepgramSTT()
    dgRef.current = dg
    try {
      await dg.start((text, isFinal) => {
        setTranscript(text)
        currentTranscriptRef.current = text
        if (isFinal) finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + text).trim()
      })
    } catch {
      dgRef.current = null
      setVoiceMode(false)
    }
  }

  async function stopListening() {
    const dg = dgRef.current
    dgRef.current = null
    dg?.stop()

    const spokenText = (finalTranscriptRef.current + ' ' + currentTranscriptRef.current).trim() || 'interview prep'
    setVoicePhase('thinking')
    setTranscript('')

    const allMsgs = [...messages]
    const firstUserIdx = allMsgs.findIndex(m => m.from === 'user')
    const priorHistory = firstUserIdx >= 0
      ? allMsgs.slice(firstUserIdx).map(m => ({
          role: m.from === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text,
        }))
      : []
    const history = [...priorHistory, { role: 'user' as const, content: spokenText }]

    let reply = SARAH_REPLIES.default
    try { reply = await askSarah(history, profile) } catch {}

    setSpeakingReply(reply)
    setVoicePhase('speaking')
    setMessages(m => [...m, { from: 'sarah', text: reply, ts: getTime() }])
    supabase.from('chat_messages').insert({ session_id: sessionId, role: 'sarah', content: reply })

    try { await textToSpeech(reply) } catch {}

    setVoiceMode(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const filters = ['All', 'Full-time', 'Part-time', 'Permanent', 'Contract']
  const visible = jobs.filter(j => {
    if (filter === 'All') return true
    if (filter === 'Full-time') return j.contract_time === 'full_time'
    if (filter === 'Part-time') return j.contract_time === 'part_time'
    if (filter === 'Permanent') return j.contract_type === 'permanent'
    if (filter === 'Contract') return j.contract_type === 'contract'
    return true
  })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes pulse-ring { 0% { transform:scale(1);opacity:.6; } 100% { transform:scale(2.2);opacity:0; } }
        @keyframes wave { 0%,100% { height:8px; } 50% { height:28px; } }
        @keyframes fadeUp { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .gg-in { animation:fadeUp .3s ease-out both; }
        .role-card { transition:box-shadow .15s,border-color .15s; cursor:pointer; }
        .role-card:hover { box-shadow:0 4px 16px rgba(0,0,0,.09); }
        .save-btn:hover { color:#10b981 !important; border-color:#10b981 !important; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:2px; }
      `}</style>

      {/* Nav */}
      <nav style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:800, fontSize:18, cursor:'pointer', flexShrink:0 }} onClick={() => navigate('/')}>
          <div style={{ width:26, height:26, borderRadius:7, background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>⚡</div>
          giggrab
        </div>

        <form onSubmit={handleSearch} style={{ flex:1, maxWidth:440, display:'flex', gap:8 }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search roles, e.g. 'forklift driver'"
            style={{ flex:1, background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:8, padding:'7px 12px', fontSize:13, outline:'none', color:'#111' }}
          />
          <button type="submit" style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'7px 16px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Search
          </button>
        </form>

        <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          {!loading && <span style={{ fontSize:12, color:'#6b7280' }}>{total.toLocaleString()} jobs</span>}
          <div
            title={profile?.name ?? 'Your profile'}
            onClick={() => setProfileOpen(o => !o)}
            style={{ width:32, height:32, borderRadius:'50%', background:'#10b981', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0, userSelect:'none' }}
          >{profile?.name?.[0]?.toUpperCase() ?? 'J'}</div>
        </div>
      </nav>

      {/* Body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Jobs */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 0' }}>
          {/* Filters */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14, flexWrap:'wrap' }}>
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding:'5px 12px', borderRadius:100, fontSize:12, fontWeight:600, cursor:'pointer',
                background: filter === f ? '#10b981' : '#fff',
                color: filter === f ? '#fff' : '#6b7280',
                border: `1px solid ${filter === f ? '#10b981' : '#e5e7eb'}`,
              } as any}>{f}</button>
            ))}
            {savedIds.size > 0 && (
              <span style={{ marginLeft:'auto', fontSize:12, color:'#10b981', fontWeight:600 }}>♥ {savedIds.size} saved</span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#dc2626', marginBottom:12 }}>
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'16px 18px', opacity:1 - i * 0.15 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                    <div>
                      <div style={{ height:14, width:200, background:'#f3f4f6', borderRadius:4, marginBottom:8 }} />
                      <div style={{ height:11, width:140, background:'#f3f4f6', borderRadius:4 }} />
                    </div>
                    <div style={{ height:22, width:44, background:'#f3f4f6', borderRadius:100 }} />
                  </div>
                  <div style={{ height:11, width:160, background:'#f3f4f6', borderRadius:4 }} />
                </div>
              ))}
            </div>
          )}

          {/* Job cards */}
          {!loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:10, paddingBottom:20 }}>
              {visible.length === 0 && (
                <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af', fontSize:14 }}>No jobs match this filter.</div>
              )}
              {visible.map((j, i) => (
                <div
                  key={j.id}
                  className="role-card gg-in"
                  style={{ animationDelay:`${i * 0.04}s`, background:'#fff', border:`1.5px solid ${expanded === j.id ? '#10b981' : '#e5e7eb'}`, borderRadius:12, padding:'14px 16px', boxShadow: expanded === j.id ? '0 0 0 3px rgba(16,185,129,0.08)' : undefined }}
                  onClick={() => setExpanded(expanded === j.id ? null : j.id)}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div style={{ flex:1, paddingRight:12, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{j.title}</div>
                      <div style={{ fontSize:12, color:'#6b7280' }}>{j.company} · {j.location}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                      <div style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:700, background:scoreColor(j.score)+'18', color:scoreColor(j.score), border:`1px solid ${scoreColor(j.score)}40` }}>{j.score}% match</div>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        {j.source && j.source !== 'adzuna' && (
                          <span style={{ fontSize:9, fontWeight:700, color:'#6b7280', background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:4, padding:'1px 5px', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                            {j.source === 'amazon' ? '🟠 Amazon' : j.source === 'workday' ? '🔵 Direct' : j.source === 'greenhouse' ? '🟢 GH' : j.source === 'lever' ? '🟣 Lever' : j.source === 'reed' ? '🔴 Reed' : j.source}
                          </span>
                        )}
                        {j.country && j.country !== 'United Kingdom' && (
                          <span style={{ fontSize:9, fontWeight:700, color:'#6b7280', background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:4, padding:'1px 5px', letterSpacing:'0.02em' }}>
                            {(({'United States':'🇺🇸 US','Canada':'🇨🇦 CA','Australia':'🇦🇺 AU','New Zealand':'🇳🇿 NZ','Germany':'🇩🇪 DE','France':'🇫🇷 FR','Netherlands':'🇳🇱 NL','South Africa':'🇿🇦 ZA','Singapore':'🇸🇬 SG','India':'🇮🇳 IN','Japan':'🇯🇵 JP','Mexico':'🇲🇽 MX','Belgium':'🇧🇪 BE','Austria':'🇦🇹 AT','Italy':'🇮🇹 IT','Poland':'🇵🇱 PL','Brazil':'🇧🇷 BR','Global':'🌐 Global'} as Record<string,string>)[j.country]) ?? j.country}
                          </span>
                        )}
                        <span style={{ fontSize:10, color:'#9ca3af' }}>{timeAgo(j.posted_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#10b981' }}>{formatSalary(j.salary_min, j.salary_max)}</span>
                      {j.contract_time && <span style={{ fontSize:11, background:'#f3f4f6', color:'#6b7280', padding:'2px 8px', borderRadius:100 }}>{j.contract_time.replace('_', '-')}</span>}
                      {j.contract_type && <span style={{ fontSize:11, background:'#f3f4f6', color:'#6b7280', padding:'2px 8px', borderRadius:100 }}>{j.contract_type}</span>}
                      {(() => { const b = getMatchBreakdown(j); return (<>
                        {(() => {
                          const city = profileLocation.split(',')[0].toLowerCase().trim()
                          return city && j.location.toLowerCase().includes(city)
                            ? <span style={{ fontSize:10, fontWeight:700, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', padding:'2px 7px', borderRadius:100 }}>📍 Near you</span>
                            : null
                        })()}
                        {b.skills   && <span style={{ fontSize:10, fontWeight:700, background:'#f0fdf4', color:'#059669', border:'1px solid #a7f3d0', padding:'2px 7px', borderRadius:100 }}>⚙ Skills</span>}
                        {b.certs    && <span style={{ fontSize:10, fontWeight:700, background:'#f0fdf4', color:'#059669', border:'1px solid #a7f3d0', padding:'2px 7px', borderRadius:100 }}>✓ Certs</span>}
                        {b.salary   && <span style={{ fontSize:10, fontWeight:700, background:'#f0fdf4', color:'#059669', border:'1px solid #a7f3d0', padding:'2px 7px', borderRadius:100 }}>£ Salary</span>}
                      </>)})()}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button
                        className="save-btn"
                        style={{ fontSize:12, fontWeight:600, color: savedIds.has(j.id) ? '#10b981' : '#6b7280', background:'none', border:`1px solid ${savedIds.has(j.id) ? '#a7f3d0' : '#e5e7eb'}`, borderRadius:7, padding:'4px 10px', cursor:'pointer', transition:'all .15s' }}
                        onClick={e => { e.stopPropagation(); toggleSave(j) }}
                      >{savedIds.has(j.id) ? '♥ Saved' : '♡ Save'}</button>
                      <button
                        style={{ fontSize:12, fontWeight:600, color:'#10b981', background:'none', border:'1px solid #a7f3d0', borderRadius:7, padding:'4px 10px', cursor:'pointer' }}
                        onClick={e => { e.stopPropagation(); send(`Help me prep for the ${j.title} role at ${j.company} (${j.location}). Salary: ${formatSalary(j.salary_min, j.salary_max)}. Here's the job description: ${j.description.slice(0, 500)}`) }}
                      >Ask Sarah</button>
                      <a
                        href={j.redirect_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize:12, fontWeight:600, color:'#fff', background:'#10b981', border:'none', borderRadius:7, padding:'4px 10px', cursor:'pointer', textDecoration:'none' }}
                      >Apply →</a>
                    </div>
                  </div>

                  {expanded === j.id && (
                    <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #f3f4f6', fontSize:13, color:'#374151', lineHeight:1.65 }}>
                      <div style={{ marginBottom:4, fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em' }}>{j.category}</div>
                      {j.description.length > 400 ? j.description.slice(0, 400) + '…' : j.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 10 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'12px 0 24px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', fontSize:13, cursor:'pointer', color: page === 1 ? '#d1d5db' : '#111', fontWeight:500 }}>← Prev</button>
              <span style={{ fontSize:13, color:'#6b7280' }}>Page {page} of {Math.ceil(total / 10)}</span>
              <button disabled={page >= Math.ceil(total / 10)} onClick={() => setPage(p => p + 1)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', fontSize:13, cursor:'pointer', color: page >= Math.ceil(total / 10) ? '#d1d5db' : '#111', fontWeight:500 }}>Next →</button>
            </div>
          )}
        </div>

        {/* Sarah chat */}
        <div style={{ width:320, borderLeft:'1px solid #e5e7eb', background:'#fff', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ position:'relative' }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>✦</div>
              <div style={{ position:'absolute', bottom:1, right:1, width:8, height:8, borderRadius:'50%', background:'#10b981', border:'2px solid #fff' }} />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:13 }}>Sarah</div>
              <div style={{ fontSize:11, color:'#10b981' }}>AI Career Agent · Online</div>
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'12px 12px 0' }}>
            {messages.map((m, i) => (
              <div key={i} className="gg-in" style={{ marginBottom:10, display:'flex', flexDirection:'column', alignItems: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth:'88%', padding:'8px 12px',
                  borderRadius: m.from === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px',
                  background: m.from === 'user' ? '#10b981' : '#f3f4f6',
                  color: m.from === 'user' ? '#fff' : '#111',
                  fontSize:13, lineHeight:1.5,
                }}>{m.text}</div>
                <span style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{m.ts}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding:'10px 10px 12px', borderTop:'1px solid #f3f4f6' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'5px 6px 5px 10px' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send(chatInput)}
                placeholder="Ask Sarah…"
                style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'#111', minWidth:0 }}
              />
              <button
                title="Voice mode"
                onClick={startVoice}
                style={{ width:28, height:28, borderRadius:7, background:'transparent', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:14, flexShrink:0 }}
              >🎙️</button>
              <button
                onClick={() => send(chatInput)}
                style={{ width:28, height:28, borderRadius:7, background:'#10b981', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:14, flexShrink:0, color:'#fff', fontWeight:700 }}
              >↑</button>
            </div>
            <p style={{ fontSize:10, color:'#9ca3af', textAlign:'center', marginTop:5 }}>Prep · negotiate · apply</p>
          </div>
        </div>
      </div>

      {/* Profile slide-in panel */}
      {profileOpen && (
        <>
          <div onClick={() => setProfileOpen(false)} style={{ position:'fixed', inset:0, zIndex:200 }} />
          <div style={{
            position:'fixed', top:56, right:0, bottom:0, width:320, background:'#fff',
            borderLeft:'1px solid #e5e7eb', zIndex:201, overflowY:'auto',
            boxShadow:'-4px 0 24px rgba(0,0,0,0.08)',
            animation:'slideIn .22s ease-out',
          }}>
            <style>{`@keyframes slideIn { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }`}</style>

            {/* Header */}
            <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, fontSize:15 }}>Your Profile</div>
              <button onClick={() => setProfileOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#9ca3af', lineHeight:1 }}>×</button>
            </div>

            {!profile ? (
              <div style={{ padding:24, color:'#9ca3af', fontSize:13, textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📄</div>
                Profile not loaded yet. Upload a CV to get started.
              </div>
            ) : (
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:20 }}>

                {/* Identity */}
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:52, height:52, borderRadius:'50%', background:'#10b981', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, flexShrink:0 }}>
                    {profile.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:16, color:'#111' }}>{profile.name || '—'}</div>
                    <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{profile.currentRole || '—'}</div>
                  </div>
                </div>

                {/* Contact */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em' }}>Contact</div>
                  {profile.location && <Row icon="📍" value={profile.location} />}
                  {profile.phone    && <Row icon="📞" value={profile.phone} />}
                  {profile.email    && <Row icon="✉️"  value={profile.email} />}
                  {!profile.location && !profile.phone && !profile.email && <span style={{ fontSize:13, color:'#9ca3af' }}>No contact details extracted</span>}
                </div>

                {/* Summary */}
                {profile.summary && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Summary</div>
                    <p style={{ fontSize:13, color:'#374151', lineHeight:1.6, margin:0 }}>{profile.summary}</p>
                  </div>
                )}

                {/* Skills */}
                {profile.skills?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Skills</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {profile.skills.map(s => (
                        <span key={s} style={{ fontSize:12, fontWeight:600, background:'#f0fdf4', color:'#059669', border:'1px solid #a7f3d0', borderRadius:100, padding:'3px 10px' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {profile.certifications?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Certifications</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {profile.certifications.map(c => (
                        <span key={c} style={{ fontSize:12, fontWeight:600, background:'#fefce8', color:'#92400e', border:'1px solid #fde68a', borderRadius:100, padding:'3px 10px' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {profile.experience?.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Experience</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      {profile.experience.map((e, i) => (
                        <div key={i} style={{ borderLeft:'2px solid #e5e7eb', paddingLeft:12 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:'#111' }}>{e.role}</div>
                          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{e.company}</div>
                          {e.duration && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{e.duration}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </>
      )}

      {/* Voice overlay */}
      {voiceMode && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', backdropFilter:'blur(8px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ position:'relative', marginBottom:32 }}>
            {voicePhase === 'listening' && (
              <>
                <div style={{ position:'absolute', inset:-20, borderRadius:'50%', border:'2px solid rgba(16,185,129,.4)', animation:'pulse-ring 1.4s ease-out infinite' }} />
                <div style={{ position:'absolute', inset:-10, borderRadius:'50%', border:'2px solid rgba(16,185,129,.2)', animation:'pulse-ring 1.4s ease-out infinite .4s' }} />
              </>
            )}
            <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>✦</div>
          </div>

          <div style={{ fontSize:18, fontWeight:700, color:'#fff', marginBottom:16 }}>
            {voicePhase === 'listening' ? 'Sarah is listening…' : voicePhase === 'thinking' ? 'Sarah is thinking…' : 'Sarah is speaking…'}
          </div>

          {voicePhase === 'listening' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:36 }}>
                {[1,1.5,2,1.5,2.5,1.8,2,1.2,1.7,1].map((_, i) => (
                  <div key={i} style={{ width:4, borderRadius:2, background:'#10b981', animation:`wave .9s ease-in-out infinite`, animationDelay:`${i * 0.08}s`, height:8 }} />
                ))}
              </div>
              {transcript && (
                <div style={{ maxWidth:300, textAlign:'center', fontSize:14, color:'rgba(255,255,255,.85)', lineHeight:1.5, padding:'0 24px', fontStyle:'italic' }}>
                  "{transcript}"
                </div>
              )}
            </div>
          )}

          {voicePhase === 'speaking' && (
            <div style={{ maxWidth:320, textAlign:'center', fontSize:14, color:'rgba(255,255,255,.75)', lineHeight:1.6, marginBottom:20, padding:'0 24px' }}>
              {speakingReply}
            </div>
          )}

          <button
            onClick={voicePhase === 'listening' ? stopListening : () => setVoiceMode(false)}
            style={{ background:'rgba(255,255,255,.12)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', borderRadius:100, padding:'9px 28px', fontSize:13, fontWeight:600, cursor:'pointer' }}
          >
            {voicePhase === 'listening' ? 'Stop' : 'Dismiss'}
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ icon, value }: { icon: string; value: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151' }}>
      <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>
      <span style={{ wordBreak:'break-all' }}>{value}</span>
    </div>
  )
}
