import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore.js'
import { sb } from './data/supabaseClient.js'
import AuthScreen from './components/AuthScreen.jsx'
import HouseholdSetupScreen from './components/HouseholdSetupScreen.jsx'
import Header from './components/Header.jsx'
import CalendarScreen from './screens/CalendarScreen.jsx'

function App() {
  const authStatus = useAppStore((s) => s.authStatus)
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)
  const signOut = useAppStore((s) => s.signOut)
  const checkSession = useAppStore((s) => s.checkSession)
  const bootstrap = useAppStore((s) => s.bootstrap)
  const household = useAppStore((s) => s.household)

  useEffect(() => {
    checkSession()
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') bootstrap()
      if (event === 'SIGNED_OUT') location.reload()
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(clearToast, 3000)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  return (
    <>
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--paper)', padding: '10px 16px', borderRadius: 10, fontSize: 13, zIndex: 999 }}>
          {toast}
        </div>
      )}
      {authStatus === 'loading' && null}
      {authStatus === 'signed-out' && <AuthScreen />}
      {authStatus === 'needs-household' && <HouseholdSetupScreen />}
      {authStatus === 'ready' && (
        <div className="shell">
          <div className="app">
            <Header />
            <div className="app-cols" data-active="calendar">
              <CalendarScreen />
            </div>
            <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--ink-soft)' }}>
              Phase 3 진행 중 — 예산/분석 탭은 아직 없음. {household ? `가구: ${household.name}` : '(가구 없음, v2 계정)'}{' '}
              <button className="add-row-btn" style={{ display: 'inline', width: 'auto', padding: '4px 10px' }} onClick={signOut}>
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
