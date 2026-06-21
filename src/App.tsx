import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { authReady } from './lib/supabase'

const Landing   = lazy(() => import('./pages/Landing'))
const Analyse   = lazy(() => import('./pages/Analyse'))
const Verify    = lazy(() => import('./pages/Verify'))
const Results   = lazy(() => import('./pages/Results'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const JobDetail = lazy(() => import('./pages/JobDetail'))

export default function App() {
  // Don't render routes (which immediately query Supabase) until we have an auth session.
  const [ready, setReady] = useState(false)
  useEffect(() => { authReady.then(() => setReady(true)) }, [])
  if (!ready) return <div style={{ minHeight: '100vh', background: '#F5F6FA' }} />

  return (
    <BrowserRouter>
      <Suspense fallback={<div />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/analyse" element={<Analyse />} />
          <Route path="/verify"  element={<Verify />} />
          <Route path="/results" element={<Results />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs/:id"  element={<JobDetail />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
