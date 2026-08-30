import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { expandMonthTx, monthKey, isFixedActiveNow } from '../lib/calc.js'
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
  const sortedFixed = useMemo(() => {
    return [...fixedExpenses].sort((a, b) => {
      const aActive = isFixedActiveNow(a)
      const bActive = isFixedActiveNow(b)
      return aActive === bActive ? 0 : aActive ? -1 : 1
    })
  }, [fixedExpenses])

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
          <div className="envelopes">
            {sortedFixed.map((f) => (
              <FixedExpenseCard key={f.id} f={f} vKey={vKey} />
            ))}
          </div>
        ) : (
          <div className="tx-empty">등록된 고정지출이 없어요.</div>
        )}
      </SectionToggle>
    </div>
  )
}
