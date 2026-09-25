import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore.js'
import { sb } from './data/supabaseClient.js'
import AuthScreen from './components/AuthScreen.jsx'
import HouseholdSetupScreen from './components/HouseholdSetupScreen.jsx'
import Header from './components/Header.jsx'
import NavBar from './components/NavBar.jsx'
import CalendarScreen from './screens/CalendarScreen.jsx'
import BudgetScreen from './screens/BudgetScreen.jsx'
import AnalysisScreen from './screens/AnalysisScreen.jsx'
import AssetScreen from './screens/AssetScreen.jsx'
import TxModal from './components/TxModal.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'

function App() {
  const authStatus = useAppStore((s) => s.authStatus)
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)
  const checkSession = useAppStore((s) => s.checkSession)
  const bootstrap = useAppStore((s) => s.bootstrap)
  const activeCol = useAppStore((s) => s.activeCol)
  const startupError = useAppStore((s) => s.startupError)
  const loadCardImportPreview = useAppStore((s) => s.loadCardImportPreview)
  const cardImportPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'card-inbox'

  useEffect(() => {
    if (authStatus !== 'ready' || cardImportPreview) return
    const refresh = () => {
      if (document.visibilityState === 'visible') useAppStore.getState().refreshFinancialState()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = setInterval(refresh, 30000)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(timer)
    }
  }, [authStatus, cardImportPreview])

  useEffect(() => {
    if (cardImportPreview) {
      loadCardImportPreview()
      return undefined
    }
    checkSession()
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') bootstrap()
      if (event === 'SIGNED_OUT') location.reload()
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardImportPreview, checkSession, bootstrap, loadCardImportPreview])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(clearToast, 1800)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  return (
    <>
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
      {authStatus === 'loading' && <div role="status" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>
        <p>{startupError || '가계부를 불러오고 있어요…'}</p>
        {startupError && <button onClick={bootstrap}>다시 불러오기</button>}
      </div>}
      {authStatus === 'signed-out' && <AuthScreen />}
      {authStatus === 'needs-household' && <HouseholdSetupScreen />}
      {authStatus === 'ready' && (
        <div className="shell">
          <NavBar />
          <div className="app">
            <Header />
            <div className="app-cols" data-active={activeCol}>
              <CalendarScreen />
              <BudgetScreen />
              <AnalysisScreen />
              <AssetScreen />
            </div>
          </div>
          <TxModal />
          <SettingsSheet />
        </div>
      )}
    </>
  )
}

export default App
