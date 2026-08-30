import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { expandMonthTx, monthKey, activeFixedExpenses, fmt } from '../lib/calc.js'
import Passbook from '../components/Passbook.jsx'
import SectionToggle from '../components/SectionToggle.jsx'
import LivingEnvelopeCard from '../components/LivingEnvelopeCard.jsx'
import IrregularEnvelopeCard from '../components/IrregularEnvelopeCard.jsx'
import FixedExpenseCard from '../components/FixedExpenseCard.jsx'

export default function BudgetScreen() {
  const viewDate = useAppStore((s) => s.viewDate)
  const transactions = useAppStore((s) => s.transactions)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)

  const vKey = monthKey(viewDate)
  const livingTx = useMemo(() => expandMonthTx(transactions, vKey).filter((t) => t.type === 'living'), [transactions, vKey])
  // "활성"은 지금 보고 있는 달(vKey) 기준 — 오늘 날짜 기준으로 하면 Passbook 합계(vKey 기준)랑
  // 어긋나고, 카드 안 할부 회차 표시(역시 vKey 기준)와도 안 맞아버린다.
  const activeFixedIds = useMemo(() => new Set(activeFixedExpenses(fixedExpenses, vKey).map((f) => f.id)), [fixedExpenses, vKey])
  const fixedTotal = useMemo(
    () => fixedExpenses.filter((f) => activeFixedIds.has(f.id)).reduce((s, f) => s + f.amount, 0),
    [fixedExpenses, activeFixedIds],
  )
  const sortedFixed = useMemo(() => {
    return [...fixedExpenses].sort((a, b) => {
      const aActive = activeFixedIds.has(a.id)
      const bActive = activeFixedIds.has(b.id)
      return aActive === bActive ? 0 : aActive ? -1 : 1
    })
  }, [fixedExpenses, activeFixedIds])

  return (
    <div className="col-budget">
      <Passbook />

      <SectionToggle title="생활 카테고리">
        <div className="envelopes">
          {livingCategories.map((cat) => (
            <LivingEnvelopeCard key={cat.id} cat={cat} catTx={livingTx.filter((t) => t.categoryId === cat.id)} vKey={vKey} />
          ))}
        </div>
      </SectionToggle>

      <SectionToggle title="누적 카테고리">
        <div className="envelopes">
          {irregularEnvelopes.map((env) => (
            <IrregularEnvelopeCard key={env.id} env={env} vKey={vKey} />
          ))}
        </div>
      </SectionToggle>

      <SectionToggle title="고정지출" defaultCollapsed>
        {sortedFixed.length ? (
          <>
            <div className="envelopes">
              {sortedFixed.map((f) => (
                <FixedExpenseCard key={f.id} f={f} vKey={vKey} active={activeFixedIds.has(f.id)} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 4px 0 4px', fontSize: 12.5, color: 'var(--ink-soft)', opacity: 0.7 }}>
              <span>이번 달 {activeFixedIds.size}건</span>
              <span style={{ fontWeight: 700, opacity: 1 }}>합계 {fmt(fixedTotal)}원</span>
            </div>
          </>
        ) : (
          <div className="tx-empty">등록된 고정지출이 없어요.</div>
        )}
      </SectionToggle>
    </div>
  )
}
