import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import { expandMonthTx, monthKey, activeFixedExpenses, fixedAmountForMonth, fmt } from '../lib/calc.js'
import Passbook from '../components/Passbook.jsx'
import SectionToggle from '../components/SectionToggle.jsx'
import LivingEnvelopeCard from '../components/LivingEnvelopeCard.jsx'
import IrregularEnvelopeCard from '../components/IrregularEnvelopeCard.jsx'
import FixedExpenseCard from '../components/FixedExpenseCard.jsx'
import FixedTxRow from '../components/FixedTxRow.jsx'
import { useEnvelopeFixedExpenses } from '../hooks/useEnvelopeFixedExpenses.js'

export default function BudgetScreen() {
  const viewDate = useAppStore((s) => s.viewDate)
  const transactions = useAppStore((s) => s.transactions)
  const livingCategories = useAppStore((s) => s.livingCategories)
  const irregularEnvelopes = useAppStore((s) => s.irregularEnvelopes)
  const fixedExpenses = useAppStore((s) => s.fixedExpenses)
  const fixedRateChanges = useAppStore((s) => s.fixedRateChanges)

  const vKey = monthKey(viewDate)
  const envelopeFixed = useEnvelopeFixedExpenses(vKey)
  const allocationsError = useAppStore((s) => s.allocationsError)
  const livingTx = useMemo(() => expandMonthTx(transactions, vKey).filter((t) => t.type === 'living'), [transactions, vKey])
  // "활성"은 지금 보고 있는 달(vKey) 기준 — 오늘 날짜 기준으로 하면 Passbook 합계(vKey 기준)랑
  // 어긋나고, 카드 안 할부 회차 표시(역시 vKey 기준)와도 안 맞아버린다.
  const activeFixedIds = useMemo(() => new Set(activeFixedExpenses(fixedExpenses, vKey).map((f) => f.id)), [fixedExpenses, vKey])
  const fixedTotal = useMemo(
    () => fixedExpenses.filter((f) => activeFixedIds.has(f.id)).reduce((s, f) => s + fixedAmountForMonth(fixedRateChanges, f, vKey), 0),
    [fixedExpenses, activeFixedIds, fixedRateChanges, vKey],
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
        {sortedFixed.length || envelopeFixed.length ? (
          <>
            <div className="envelopes">
              {sortedFixed.map((f) => (
                <FixedExpenseCard key={f.id} f={f} vKey={vKey} active={activeFixedIds.has(f.id)} />
              ))}
            </div>
            {envelopeFixed.map((f) => <FixedTxRow key={f.id} f={f} vKey={vKey} />)}
            <p className="monthly-summary-note">누적 카테고리의 월 충전액과 자동으로 연결돼요. 금액은 해당 누적 카테고리에서 수정해주세요.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 4px 0 4px', fontSize: 12.5, color: 'var(--ink-soft)', opacity: 0.7 }}>
              <span>이번 달 {activeFixedIds.size + envelopeFixed.length}건</span>
              <span style={{ fontWeight: 700, opacity: 1 }}>{allocationsError ? '공동 합계 확인 필요' : `합계 ${fmt(fixedTotal + envelopeFixed.reduce((s, f) => s + f.amount, 0))}원`}</span>
            </div>
          </>
        ) : (
          <div className="tx-empty">등록된 고정지출이 없어요.</div>
        )}
      </SectionToggle>
    </div>
  )
}
