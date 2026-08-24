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
import TxModal from './components/TxModal.jsx'

function App() {
  const authStatus = useAppStore((s) => s.authStatus)
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)
  const checkSession = useAppStore((s) => s.checkSession)
  const bootstrap = useAppStore((s) => s.bootstrap)
  const activeCol = useAppStore((s) => s.activeCol)

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
    const timer = setTimeout(clearToast, 1800)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  return (
    <>
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
      {authStatus === 'loading' && null}
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
            </div>
          </div>
          <TxModal />
        </div>
      )}
    </>
  )
}

export default App
