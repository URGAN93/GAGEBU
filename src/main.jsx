import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { useAppStore } from './store/useAppStore.js'

// 개발 중 콘솔에서 store 상태를 직접 찍어보기 위한 임시 노출 (프로덕션 빌드에는 포함 안 함)
if (import.meta.env.DEV) window.useAppStore = useAppStore

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
