import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, monthKey, isFixedActiveNow, fixedInstallmentIndex, nowMonthKey, addMonths } from '../lib/calc.js'

export default function FixedExpenseCard({ f, vKey }) {
  const payMethods = useAppStore((s) => s.payMethods)
  const viewDate = useAppStore((s) => s.viewDate)
  const updateFixedExpense = useAppStore((s) => s.updateFixedExpense)
  const toggleFixedEnd = useAppStore((s) => s.toggleFixedEnd)
  const [expanded, setExpanded] = useState(false)

  const active = isFixedActiveNow(f)
  const idx = fixedInstallmentIndex(f, vKey)

  async function handleEditAmount(e) {
    e.stopPropagation()
    const input = prompt(`${f.name} 금액`, f.amount)
    if (input === null) return
    const amount = Math.max(0, parseInt(input, 10) || 0)
    await updateFixedExpense(f.id, { amount })
  }

  async function handlePayMethodChange(e) {
    await updateFixedExpense(f.id, { payMethod: e.target.value || null })
  }

  async function handleEditInstallment(e) {
    e.stopPropagation()
    const countInput = prompt('총 할부개월 (계속 반복이면 빈칸으로 확인)', f.installmentCount ?? '')
    if (countInput === null) return
    const count = parseInt(countInput, 10)
    if (!(count > 1)) {
      await updateFixedExpense(f.id, { installmentCount: null, installmentStartMonth: null })
      return
    }
    const idxInput = prompt('현재 몇 회차인가요? (예: 14)', '1')
    if (idxInput === null) return
    const curIdx = Math.max(1, parseInt(idxInput, 10) || 1)
    await updateFixedExpense(f.id, { installmentCount: count, installmentStartMonth: addMonths(nowMonthKey(), -(curIdx - 1)) })
  }

  async function handleToggleEnd(e) {
    e.stopPropagation()
    const closing = !f.endMonth
    if (closing) {
      const newEndMonth = monthKey(viewDate)
      if (!confirm(`"${f.name}"을(를) ${newEndMonth}부터(이번 달부터) 고정지출 목록에서 안 보이게 할까요? 이전 기록은 그대로 남아있어요.`)) return
    }
    await toggleFixedEnd(f.id)
  }

  return (
    <div className={`envelope${expanded ? ' expanded' : ''}`} style={!active ? { opacity: 0.55 } : undefined} onClick={() => setExpanded((v) => !v)}>
      <div className="env-top">
        <div className="env-name">
          {f.name}
          {idx ? (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'rgba(185,138,46,0.15)',
                color: 'var(--gold)',
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {idx}/{f.installmentCount}
            </span>
          ) : null}
          <span className="env-caret">▾</span>
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 13, color: 'var(--ink-soft)' }}>
          {fmt(f.amount)}원{active ? '' : ' · 비활성'}
        </span>
      </div>
      <div className="env-sub">
        <div className="env-sub-row">
          <span>금액</span>
          <span>
            {fmt(f.amount)}원{' '}
            <button
              style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.55, fontSize: 12 }}
              onClick={handleEditAmount}
            >
              ✎
            </button>
          </span>
        </div>
        <div className="env-sub-row" onClick={(e) => e.stopPropagation()}>
          <span>결제수단</span>
          <select value={f.payMethod ?? ''} onChange={handlePayMethodChange} style={{ border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, background: '#fff', color: 'var(--ink-soft)' }}>
            <option value="">선택 안 함</option>
            {payMethods.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="env-sub-row">
          <span>할부{idx ? ` (${idx}/${f.installmentCount}회차)` : ''}</span>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.55, fontSize: 12 }} onClick={handleEditInstallment}>
            ✎
          </button>
        </div>
        <div className="env-sub-row">
          <span>{f.endMonth ? `${f.endMonth}부터 종료됨` : '계속 진행 중'}</span>
          <button
            style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.7, fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}
            onClick={handleToggleEnd}
          >
            {f.endMonth ? '마감 취소' : '마감'}
          </button>
        </div>
      </div>
    </div>
  )
}
