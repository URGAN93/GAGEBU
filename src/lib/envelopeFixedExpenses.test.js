import { describe, expect, it } from 'vitest'
import { envelopeFixedExpenses, monthlyBudgetSummary, creditedForEnvelope } from './calc.js'

const allocations = [
  { id: 'my-allowance', name: '용돈', scope: 'personal', userId: 'me', monthlyAmount: 300000, startMonth: '2026-09', rateChanges: [{ envelopeId: 'my-allowance', effectiveMonth: '2026-10', amount: 350000 }] },
  { id: 'my-events', name: '경조사', scope: 'personal', userId: 'me', monthlyAmount: 200000, startMonth: '2026-09' },
  { id: 'wife-allowance', name: '용돈', scope: 'personal', userId: 'wife', monthlyAmount: 500000, startMonth: '2026-09' },
  { id: 'wife-events', name: '경조사', scope: 'personal', userId: 'wife', monthlyAmount: 200000, startMonth: '2026-09' },
]
const shared = { household: { id: 'home' }, householdAllocations: allocations }
const total = (rows) => rows.reduce((s, r) => s + r.amount, 0)

describe('두 계정 누적 카테고리의 공동 고정지출', () => {
  it('두 계정 모두 같은 월 충전 합계를 보며 적용 월부터 인상된다', () => {
    for (const myUserId of ['me', 'wife']) {
      const input = { ...shared, myUserId, irregularEnvelopes: allocations.filter((e) => e.userId === myUserId) }
      expect(total(envelopeFixedExpenses(input, '2026-08'))).toBe(0)
      expect(total(envelopeFixedExpenses(input, '2026-09'))).toBe(1200000)
      expect(total(envelopeFixedExpenses(input, '2026-10'))).toBe(1250000)
      expect(envelopeFixedExpenses(input, '2026-09').filter((e) => e.name.startsWith('나'))).toHaveLength(2)
    }
  })

  it('월 충전액 인하 및 0원도 반영하고 공유 항목은 한번만 합산한다', () => {
    const rows = [...allocations, { id: 'shared', scope: 'household', name: '여행', monthlyAmount: 100000 }]
    rows[0] = { ...rows[0], rateChanges: [
      { envelopeId: 'my-allowance', effectiveMonth: '2026-10', amount: 100000 },
      { envelopeId: 'my-allowance', effectiveMonth: '2026-11', amount: 0 },
    ] }
    expect(total(envelopeFixedExpenses({ ...shared, householdAllocations: rows }, '2026-10'))).toBe(1100000)
    expect(total(envelopeFixedExpenses({ ...shared, householdAllocations: rows }, '2026-11'))).toBe(1000000)
  })

  it('추가 적립은 개인 잔액만 늘리고 개인 사용/정산은 가계 지출에 중복 반영하지 않는다', () => {
    const env = allocations[0]
    const bonus = [{ envelopeId: env.id, month: '2026-09', amount: 100000 }]
    expect(creditedForEnvelope(env.rateChanges, bonus, env, '2026-09', '2026-09')).toBe(400000)
    const envelopeFixed = envelopeFixedExpenses({ ...shared, envelopeBonusCredits: bonus }, '2026-09')
    const summary = monthlyBudgetSummary({
      livingCategories: [{ id: 'food', limit: 600000 }], livingBudgetChanges: [],
      irregularEnvelopes: [env], fixedExpenses: [{ id: 'rent', amount: 400000 }], fixedRateChanges: [], envelopeFixed,
      transactions: [
        { type: 'living', categoryId: 'food', amount: 100000, date: '2026-09-01' },
        { type: 'irregular', categoryId: env.id, amount: 80000, date: '2026-09-01' },
        { type: 'settlement', categoryId: env.id, amount: 20000, date: '2026-09-02' },
      ],
    }, '2026-09')
    expect(summary).toMatchObject({ totalBudget: 600000, totalSpent: 100000, totalSettled: 0, fixedTotal: 1600000, monthlyTotal: 1700000, expectedTotal: 2200000 })
  })
})
