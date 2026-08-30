import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, monthKey, expandMonthTx, budgetAmountForMonth, monthlyAmountForMonth, activeFixedExpenses } from '../lib/calc.js'

export default function Passbook() {
  const viewDate = useAppStore((s) => s.viewDate)
  const transactions = useAppStore((s) => s.transactions)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const livingBudgetChanges = useAppStore((s) => s.livingBudgetChanges)
  const envelopeRateChanges = useAppStore((s) => s.envelopeRateChanges)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)

  const vKey = monthKey(viewDate)

  const { totalSpent, totalBudget, fixedTotal, totalSettled, rawSpent, totalPct } = useMemo(() => {
    const monthTx = expandMonthTx(transactions, vKey)
    const livingTx = monthTx.filter((t) => t.type === 'living')
    const irregularTxThisMonth = monthTx.filter((t) => t.type === 'irregular')
    const totalBudget =
      livingCategories.reduce((s, c) => s + budgetAmountForMonth(livingBudgetChanges, c, vKey), 0) +
      irregularEnvelopes.reduce((s, e) => s + monthlyAmountForMonth(envelopeRateChanges, e, vKey), 0)
    const totalSettled = monthTx.filter((t) => t.type === 'settlement').reduce((s, t) => s + t.amount, 0)
    const rawSpent = livingTx.reduce((s, t) => s + t.amount, 0) + irregularTxThisMonth.reduce((s, t) => s + t.amount, 0)
    const totalSpent = rawSpent - totalSettled
    const totalPct = totalBudget ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
    const fixedTotal = activeFixedExpenses(fixedExpenses, vKey).reduce((s, f) => s + f.amount, 0)
    return { totalSpent, totalBudget, fixedTotal, totalSettled, rawSpent, totalPct }
  }, [transactions, livingCategories, irregularEnvelopes, livingBudgetChanges, envelopeRateChanges, fixedExpenses, vKey])

  const remain = totalBudget - totalSpent

  return (
    <div className="passbook">
      <div className="eyebrow">이번 달 생활 예산</div>
      <div className="total-row">
        <span className="total-amt">{fmt(totalSpent)}</span>
        <span className="total-of">
          원 / <span>{fmt(totalBudget)}</span>원 <span className="total-combined">({fmt(totalBudget + fixedTotal)})</span>
        </span>
      </div>
      {totalSettled > 0 && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
          실사용 {fmt(rawSpent)}원 − 정산 {fmt(totalSettled)}원 = 실질 {fmt(totalSpent)}원
        </div>
      )}
      <div className="total-bar">
        <div className="total-bar-fill" style={{ width: totalPct + '%' }} />
      </div>
      <div className="total-foot">
        <span>{Math.round(totalBudget ? (totalSpent / totalBudget) * 100 : 0)}% 사용</span>
        <span>
          {remain >= 0 ? '잔여 ' : '초과 '}
          {fmt(Math.abs(remain))}원
        </span>
      </div>
    </div>
  )
}
