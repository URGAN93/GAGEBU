import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, getBudgetForCategory } from '../lib/calc.js'
import { statusColor } from '../lib/theme.js'
import { settlementsForCategory } from '../lib/calc.js'

export default function LivingEnvelopeCard({ cat, catTx, vKey }) {
  const monthlyBudgets = useAppStore((s) => s.monthlyBudgets)
  const transactions = useAppStore((s) => s.transactions)
  const upsertMonthlyBudget = useAppStore((s) => s.upsertMonthlyBudget)
  const [expanded, setExpanded] = useState(false)

  const spent = catTx.reduce((s, t) => s + t.amount, 0)
  // 정산: 원거래 금액(spent)은 절대 안 바꾸고, "실질 지출 = 실사용 - 정산액"만 예산 계산에 반영한다
  const settled = settlementsForCategory(transactions, cat.id, vKey)
  const effectiveSpent = spent - settled
  const budget = getBudgetForCategory(monthlyBudgets, cat, vKey)
  const isOverride = budget !== cat.limit
  const pct = budget ? (effectiveSpent / budget) * 100 : 0
  const barPct = Math.min(100, Math.max(0, pct))
  const color = statusColor(pct)
  const remainCat = budget - effectiveSpent

  const subTotals = {}
  catTx.forEach((t) => {
    const key = t.subcat && t.subcat.trim() ? t.subcat.trim() : '기타'
    subTotals[key] = (subTotals[key] || 0) + t.amount
  })
  const subEntries = Object.entries(subTotals).sort((a, b) => b[1] - a[1])

  async function handleEditBudget(e) {
    e.stopPropagation()
    const input = prompt(`${vKey} ${cat.name} 예산 (기본 ${fmt(cat.limit)}원)`, budget)
    if (input === null) return
    const amount = Math.max(0, parseInt(input, 10) || 0)
    await upsertMonthlyBudget(cat.id, vKey, amount)
  }

  return (
    <div className={`envelope${expanded ? ' expanded' : ''}`} onClick={() => setExpanded((v) => !v)}>
      <div className="env-top">
        <div className="env-name">
          <span className="env-icon" style={{ background: cat.color }} />
          {cat.name}
          <span className="env-caret">▾</span>
        </div>
        <div className="env-pct" style={{ color, background: color + '1A' }}>
          {Math.round(pct)}%
        </div>
      </div>
      <div className="env-numbers">
        <span className="env-spent">{fmt(effectiveSpent)}원</span>
        <span className="env-limit">
          / {fmt(budget)}원{isOverride ? <small style={{ opacity: 0.6 }}> (기본 {fmt(cat.limit)})</small> : null}{' '}
          <button
            className="mr-budget-edit"
            title="이번 달 예산 수정"
            style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.55, fontSize: 12 }}
            onClick={handleEditBudget}
          >
            ✎
          </button>
        </span>
      </div>
      {settled > 0 && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
          실사용 {fmt(spent)}원 − 정산 {fmt(settled)}원 = 실질 {fmt(effectiveSpent)}원
        </div>
      )}
      <div className="env-bar">
        <div className="env-bar-fill" style={{ width: barPct + '%', background: color }} />
      </div>
      <div className="env-remain">
        {remainCat >= 0 ? (
          <>
            이번 달 <b>{fmt(remainCat)}원</b> 더 쓸 수 있어요
          </>
        ) : (
          <>
            <b style={{ color }}>{fmt(Math.abs(remainCat))}원</b> 초과했어요
          </>
        )}
      </div>
      <div className="env-sub">
        {subEntries.length ? (
          subEntries.map(([name, amt]) => (
            <div className="env-sub-row" key={name}>
              <span>{name}</span>
              <span>{fmt(amt)}원</span>
            </div>
          ))
        ) : (
          <div className="env-sub-row">
            <span>세부 내역 없음</span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  )
}
