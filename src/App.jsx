import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore.js'
import { sb } from './data/supabaseClient.js'
import AuthScreen from './components/AuthScreen.jsx'
import HouseholdSetupScreen from './components/HouseholdSetupScreen.jsx'

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
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
          <h1>가계부 (React 마이그레이션 진행 중)</h1>
          <p>Phase 2 완료: 로그인/가구 설정까지 연결됨. {household ? `가구: ${household.name}` : '(가구 없음 상태로 진행 중인 v2 계정)'}</p>
          <button className="add-row-btn" onClick={signOut}>
            로그아웃
          </button>
        </div>
      )}
    </>
  )
}

export default App
