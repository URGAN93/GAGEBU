import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'

export default function AuthScreen() {
  const signIn = useAppStore((s) => s.signIn)
  const signUp = useAppStore((s) => s.signUp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSignIn() {
    setError('')
    const result = await signIn(email, password)
    if (!result.ok) setError(result.message)
  }

  async function handleSignUp() {
    setError('')
    const result = await signUp(email, password)
    setError(result.message)
  }

  return (
    <div className="auth-screen" id="authScreen">
      <div className="auth-box">
        <div className="auth-title">가계부</div>
        <div className="field">
          <label>이메일</label>
          <input
            type="email"
            placeholder="you@example.com"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input
            type="password"
            placeholder="비밀번호"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="sheet-submit" onClick={handleSignIn}>
          로그인
        </button>
        <button className="add-row-btn" style={{ marginTop: 8 }} onClick={handleSignUp}>
          계정이 없다면 회원가입
        </button>
        {error && (
          <div style={{ display: 'block', marginTop: 10, fontSize: 12.5, color: 'var(--over)', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
