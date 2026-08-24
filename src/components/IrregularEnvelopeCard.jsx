import { useState } from 'react'
import { useAppStore } from '../store/useAppStore.js'
import {
  fmt,
  creditedForEnvelope,
  monthlyAmountForMonth,
  irregularContributions,
  settlementsForCategory,
  settlementsForCategoryRange,
} from '../lib/calc.js'

export default function IrregularEnvelopeCard({ env, vKey }) {
  const transactions = useAppStore((s) => s.transactions)
  const envelopeRateChanges = useAppStore((s) => s.envelopeRateChanges)
  const envelopeBonusCredits = useAppStore((s) => s.envelopeBonusCredits)
  const upsertEnvelopeRate = useAppStore((s) => s.upsertEnvelopeRate)
  const [expanded, setExpanded] = useState(false)

  // 누적 적립액 = start_month부터 조회월까지, 각 달 시점에 유효했던 충전액을 합산 (rate 변경 이력 반영)
  const credited = creditedForEnvelope(envelopeRateChanges, envelopeBonusCredits, env, env.startMonth, vKey)
  const thisMonthRate = monthlyAmountForMonth(envelopeRateChanges, env, vKey)
  // 잔액 = 이월분 포함 누적 적립액 - 해당 Envelope에 귀속된 실제 지출액 (다른 카테고리 보정에 쓰이지 않음)
  const contributions = irregularContributions(transactions, env.id, env.startMonth, vKey)
  const spentAll = contributions.reduce((s, r) => s + r.amount, 0)
  const settledAll = settlementsForCategoryRange(transactions, env.id, env.startMonth, vKey)
  const thisMonthContributions = contributions.filter((r) => r.month === vKey)
  const spentThisMonth = thisMonthContributions.reduce((s, r) => s + r.amount, 0)
  const settledThisMonth = settlementsForCategory(transactions, env.id, vKey)
  // 잔액 = 누적 적립액 - (실사용 - 정산액). 정산은 "이 Envelope에서 나갔다가 돌아온 돈"이라 잔액을 그만큼 되돌려준다.
  const balance = credited - (spentAll - settledAll)

  // 서브카테고리 내역은 누적 전체가 아니라 "이번 달" 사용분만 보여준다 (누적 잔액 숫자만 전체 기간 반영)
  const subTotals = {}
  thisMonthContributions.forEach((r) => {
    subTotals[r.subcat] = (subTotals[r.subcat] || 0) + r.amount
  })
  const subEntries = Object.entries(subTotals).sort((a, b) => b[1] - a[1])

  async function handleEditRate(e) {
    e.stopPropagation()
    const input = prompt(`${vKey}부터 적용할 ${env.name} 월 충전액 (기본 ${fmt(env.monthlyAmount)}원)`, thisMonthRate)
    if (input === null) return
    const amount = Math.max(0, parseInt(input, 10) || 0)
    await upsertEnvelopeRate(env.id, vKey, amount)
  }

  return (
    <div className={`envelope irregular${expanded ? ' expanded' : ''}`} onClick={() => setExpanded((v) => !v)}>
      <div className="env-top">
        <div className="env-name">
          <span className="env-icon" style={{ background: env.color }} />
          {env.name}
          <span className="env-caret">▾</span>
        </div>
      </div>
      <div className="irr-balance-row">
        <span className="irr-balance">{fmt(balance)}원</span>
        <span className="irr-label">누적 잔액</span>
      </div>
      <div className="irr-foot">
        <span>
          월 충전 {fmt(thisMonthRate)}원{' '}
          <button
            className="mr-budget-edit"
            title="이번 달부터 충전액 수정"
            style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.55, fontSize: 12 }}
            onClick={handleEditRate}
          >
            ✎
          </button>
        </span>
        <span>이번 달 사용 {fmt(settledThisMonth > 0 ? spentThisMonth - settledThisMonth : spentThisMonth)}원</span>
      </div>
      {settledThisMonth > 0 && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
          실사용 {fmt(spentThisMonth)}원 − 정산 {fmt(settledThisMonth)}원
        </div>
      )}
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
            <span>이번 달 사용 내역 없음</span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  )
}
