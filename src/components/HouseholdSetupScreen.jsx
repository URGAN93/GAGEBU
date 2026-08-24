import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'

export default function HouseholdSetupScreen() {
  const createHousehold = useAppStore((s) => s.createHousehold)
  const joinHousehold = useAppStore((s) => s.joinHousehold)
  const [name, setName] = useState('우리집 가계부')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  async function handleCreate() {
    setError('')
    const result = await createHousehold(name)
    if (!result.ok) setError(result.message)
  }

  async function handleJoin() {
    setError('')
    const result = await joinHousehold(code)
    if (!result.ok) setError(result.message)
  }

  return (
    <div className="auth-screen" id="householdSetupScreen">
      <div className="auth-box">
        <div className="auth-title">가계부 설정</div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', opacity: 0.8, margin: '-6px 0 14px 0' }}>
          아직 소속된 가계부가 없어요. 새로 만들거나, 배우자가 만든 가계부에 초대 코드로 참여하세요.
        </p>
        <div className="field">
          <label>새 가계부 만들기</label>
          <input type="text" placeholder="예) 우리집 가계부" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="sheet-submit" onClick={handleCreate}>
          가계부 만들기
        </button>
        <div style={{ textAlign: 'center', margin: '16px 0', fontSize: 12, color: 'var(--ink-soft)', opacity: 0.6 }}>또는</div>
        <div className="field">
          <label>초대 코드로 참여하기</label>
          <input type="text" placeholder="배우자에게 받은 코드" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="add-row-btn" onClick={handleJoin}>
          참여하기
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
