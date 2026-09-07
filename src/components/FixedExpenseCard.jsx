import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, fixedInstallmentIndex, fixedAmountForMonth } from '../lib/calc.js'

export default function FixedExpenseCard({ f, vKey, active }) {
  const fixedRateChanges = useAppStore((s) => s.fixedRateChanges)
  const upsertFixedRate = useAppStore((s) => s.upsertFixedRate)
  const [expanded, setExpanded] = useState(false)

  const idx = fixedInstallmentIndex(f, vKey)
  const amount = fixedAmountForMonth(fixedRateChanges, f, vKey)
  const isOverride = amount !== f.amount

  async function handleEditAmount(e) {
    e.stopPropagation()
    const input = prompt(`${vKey}부터 적용할 ${f.name} 금액 (기본 ${fmt(f.amount)}원)`, amount)
    if (input === null) return
    const newAmount = Math.max(0, parseInt(input, 10) || 0)
    await upsertFixedRate(f.id, vKey, newAmount)
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
          {fmt(amount)}원{active ? '' : ' · 비활성'}
        </span>
      </div>
      <div className="env-sub">
        <div className="env-sub-row" onClick={(e) => e.stopPropagation()}>
          <span>금액{isOverride ? <small style={{ opacity: 0.6 }}> (기본 {fmt(f.amount)})</small> : null}</span>
          <span>
            {fmt(amount)}원{' '}
            <button
              title="이번 달부터 금액 수정"
              style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.55, fontSize: 12 }}
              onClick={handleEditAmount}
            >
              ✎
            </button>
          </span>
        </div>
        <div className="env-sub-row">
          <span>결제수단</span>
          <span>{f.payMethod || '설정 안 함'}</span>
        </div>
        <div className="env-sub-row">
          <span>할부</span>
          <span>{f.installmentCount ? `${idx}/${f.installmentCount}회차` : '계속 반복'}</span>
        </div>
        <div className="env-sub-row">
          <span>{f.endMonth ? `${f.endMonth}부터 종료됨` : '계속 진행 중'}</span>
        </div>
        <div className="mr-hint" style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>
          이름 · 결제수단 · 할부 · 마감은 설정 화면에서 수정하세요
        </div>
      </div>
    </div>
  )
}
