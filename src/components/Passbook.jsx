import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { fmt, monthKey, monthlyBudgetSummary } from '../lib/calc.js'
import { useEnvelopeFixedExpenses } from '../hooks/useEnvelopeFixedExpenses.js'

export default function Passbook() {
  const viewDate = useAppStore((s) => s.viewDate)
  const transactions = useAppStore((s) => s.transactions)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const livingBudgetChanges = useAppStore((s) => s.livingBudgetChanges)
  const envelopeRateChanges = useAppStore((s) => s.envelopeRateChanges)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)
  const fixedRateChanges = useAppStore((s) => s.fixedRateChanges)

  const vKey = monthKey(viewDate)
  const envelopeFixed = useEnvelopeFixedExpenses(vKey)
  const allocationsError = useAppStore((s) => s.allocationsError)
  const refreshFinancialState = useAppStore((s) => s.refreshFinancialState)

  const { totalSpent, totalBudget, fixedTotal, totalSettled, rawSpent, totalPct, unbudgetedRaw, unbudgetedSettled, unbudgetedSpent, monthlyTotal, expectedTotal } = useMemo(
    () => monthlyBudgetSummary({ transactions, livingCategories, irregularEnvelopes, livingBudgetChanges, envelopeRateChanges, fixedExpenses, fixedRateChanges, envelopeFixed }, vKey),
    [transactions, livingCategories, irregularEnvelopes, livingBudgetChanges, envelopeRateChanges, fixedExpenses, fixedRateChanges, envelopeFixed, vKey],
  )

  const remain = totalBudget - totalSpent

  return (
    <div className="monthly-overview">
      {allocationsError ? <p role="alert">{allocationsError} <button onClick={refreshFinancialState}>다시 불러오기</button></p> : <section className="monthly-summary" aria-label="이번 달 가계 지출">
        <h2>이번 달 가계 지출</h2>
        <div className="monthly-summary-amount">{fmt(monthlyTotal)}<span>원</span></div>
        <p className="monthly-summary-plan">
          <span>예상 지출 <strong>{fmt(expectedTotal)}원</strong></span>
        </p>
        <dl className="monthly-summary-breakdown">
          <div className={remain < 0 ? 'summary-over-budget' : undefined}>
            <dt>생활</dt><dd>{fmt(totalSpent)}<span>원</span></dd>
            {remain < 0 && <dd className="summary-overage">{fmt(-remain)}원 초과</dd>}
          </div>
          <div><dt>비정기</dt><dd>{fmt(unbudgetedSpent)}<span>원</span></dd></div>
          <div><dt>고정</dt><dd>{fmt(fixedTotal)}<span>원</span></dd></div>
        </dl>
        {unbudgetedSettled !== 0 && <p className="monthly-summary-note">비정기 지출 {fmt(unbudgetedRaw)}원 − 정산 {fmt(unbudgetedSettled)}원</p>}
        <p className="monthly-summary-note">고정에는 부부의 누적 카테고리 월 충전액이 포함돼요. 추가 적립과 충전금 사용은 중복 합산하지 않아요.</p>
      </section>}
      <section className={`monthly-budget${remain < 0 ? ' is-over-budget' : ''}`} aria-label="생활 예산">
        <h2>생활 예산</h2>
        <div className="monthly-budget-amount"><strong>{fmt(totalSpent)}</strong><span> / {fmt(totalBudget)}원</span></div>
        {totalSettled !== 0 && <p className="monthly-summary-note">생활 지출 {fmt(rawSpent)}원 − 정산 {fmt(totalSettled)}원</p>}
        <div className="monthly-budget-bar" role="progressbar" aria-label="생활 예산 사용률" aria-valuenow={totalPct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${totalPct}%`, background: remain < 0 ? 'var(--over)' : 'var(--gold)' }} />
        </div>
        <div className={`monthly-budget-foot${remain < 0 ? ' over-budget' : ''}`}>
          <span>{totalBudget > 0 ? `${Math.round(totalSpent / totalBudget * 100)}% 사용` : remain < 0 ? '예산 초과' : '0% 사용'}</span>
          <span>{remain >= 0 ? '잔여 ' : '초과 '}{fmt(Math.abs(remain))}원</span>
        </div>
      </section>
    </div>
  )
}
