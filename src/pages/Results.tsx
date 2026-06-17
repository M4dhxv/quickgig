import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const ROLES = [
  { title: 'Senior Warehouse Manager', company: 'Clipper Logistics', location: 'Leeds, LS1', salary: '£34,000 – £40,000', score: 96, badge: 'Top Match' },
  { title: 'Shift Supervisor – Fulfilment', company: 'Amazon', location: 'Manchester, M17', salary: '£29,500 – £33,000', score: 91, badge: null },
  { title: 'Logistics Coordinator', company: 'DHL Supply Chain', location: 'Birmingham, B6', salary: '£27,000 – £31,000', score: 88, badge: null },
  { title: 'Inventory Control Lead', company: 'Wincanton', location: 'Bristol, BS3', salary: '£26,000 – £30,000', score: 85, badge: null },
  { title: 'Operations Team Leader', company: 'XPO Logistics', location: 'Sheffield, S9', salary: '£28,000 – £34,000', score: 83, badge: null },
  { title: 'Warehouse Operations Manager', company: 'Royal Mail', location: 'London, E1', salary: '£35,000 – £42,000', score: 81, badge: null },
  { title: 'Supply Chain Analyst', company: 'Tesco', location: 'Welwyn Garden City', salary: '£30,000 – £36,000', score: 79, badge: null },
  { title: 'Distribution Centre Manager', company: 'Marks & Spencer', location: 'Castle Donington', salary: '£38,000 – £46,000', score: 77, badge: null },
]

const PLANS = [
  {
    id: 'basic',
    name: 'BASIC',
    price: '£4.99',
    period: 'one-off',
    color: '#fff',
    textColor: '#111',
    borderColor: '#e5e7eb',
    features: ['Top 10 matched roles', 'Match score per role', 'Apply directly'],
    cta: 'Get Basic',
    ctaBg: '#111',
    ctaColor: '#fff',
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '£9.99',
    period: 'per month',
    color: '#10b981',
    textColor: '#fff',
    borderColor: '#10b981',
    features: ['Unlimited matched roles', 'Sarah chat — prep for every interview', 'Salary insights & negotiation tips', 'New matches as they\'re posted', '1-click apply'],
    cta: 'Unlock Pro',
    ctaBg: '#fff',
    ctaColor: '#10b981',
    popular: true,
  },
]

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? '#10b981' : score >= 80 ? '#f59e0b' : '#6b7280'
  return (
    <div style={{
      padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700,
      background: color + '18', color, border: `1px solid ${color}40`,
    }}>{score}%</div>
  )
}

export default function Results() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { jobCount?: number; sessionId?: string; fileName?: string } | null
  const jobCount = state?.jobCount ?? ROLES.length
  const sessionId = state?.sessionId
  const fileName  = state?.fileName
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', paddingBottom: 80 }}>
      <style>{`
        .blur-row { filter: blur(5px); user-select: none; pointer-events: none; }
        .plan-card:hover { transform: translateY(-2px); }
        .plan-card { transition: transform 0.2s; }
      `}</style>

      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚡</div>
          giggrab
        </div>
        <button style={{ background: 'none', border: 'none', fontSize: 14, color: '#6b7280', cursor: 'pointer' }} onClick={() => navigate('/')}>
          ← New search
        </button>
      </nav>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '52px 24px 0' }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 100,
            padding: '5px 14px', fontSize: 11, fontWeight: 700, color: '#059669',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            ✦ Sarah found your matches
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>
            <span style={{ color: '#10b981' }}>{jobCount.toLocaleString()} roles</span> matched your profile
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.6 }}>
            Unlock your results to see every match, chat with Sarah<br />about each role, and start applying.
          </p>
        </div>

        <div className="fade-up d1" style={{ marginBottom: 8, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <div className="blur-row">
              {ROLES.slice(0, 3).map(r => <RoleCard key={r.title} role={r} locked />)}
            </div>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', border: '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>🔒</div>
              <p style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Unlock to see your matches</p>
            </div>
          </div>
        </div>

        <div className="fade-up d2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '36px 0 0' }}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className="plan-card"
              style={{
                background: plan.color, border: `2px solid ${selected === plan.id ? plan.borderColor : plan.borderColor}`,
                borderRadius: 16, padding: 28, cursor: 'pointer', position: 'relative',
                boxShadow: plan.popular ? '0 8px 24px rgba(16,185,129,0.18)' : '0 2px 8px rgba(0,0,0,0.06)',
              }}
              onClick={() => setSelected(plan.id)}
            >
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em', padding: '3px 12px', borderRadius: 100, textTransform: 'uppercase',
                }}>Most Popular</div>
              )}
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: plan.popular ? 'rgba(255,255,255,0.7)' : '#9ca3af', marginBottom: 8, textTransform: 'uppercase' }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: plan.textColor }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.65)' : '#9ca3af' }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', marginBottom: 20, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.88)' : '#374151', lineHeight: 1.4 }}>
                    <span style={{ color: plan.popular ? '#fff' : '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                style={{
                  width: '100%', background: plan.ctaBg, color: plan.ctaColor,
                  border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 14,
                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onClick={() => navigate('/dashboard', { state: { fileName, sessionId } })}
              >
                {plan.cta} {plan.popular ? '→' : ''}
              </button>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
          Cancel anytime · Secure payment via Stripe
        </p>
      </div>
    </div>
  )
}

function RoleCard({ role, locked }: { role: typeof ROLES[0]; locked: boolean }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px',
      marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{role.title}</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{role.company} · {role.location}</div>
        {!locked && <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600, marginTop: 4 }}>{role.salary}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <ScoreBadge score={role.score} />
        {role.badge && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 100, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {role.badge}
          </div>
        )}
      </div>
    </div>
  )
}
