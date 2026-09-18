import { describe, expect, it } from 'vitest'
import { monthlyBudgetSummary, budgetAmountForMonth } from './calc.js'
import { livingCatToRow, rowToLivingCat } from '../data/converters.js'

const state = {
  livingCategories: [{ id: 'food', limit: 1000000 }, { id: 'medical', limit: 0, budgetEnabled: false }],
  irregularEnvelopes: [], livingBudgetChanges: [], envelopeRateChanges: [], fixedExpenses: [], fixedRateChanges: [],
  transactions: [
    { id: 'food1', type: 'living', categoryId: 'food', amount: 600000, date: '2026-09-10' },
    { id: 'medical1', type: 'living', categoryId: 'medical', amount: 200000, date: '2026-09-10' },
    { id: 'refund1', type: 'settlement', categoryId: 'medical', amount: 120000, date: '2026-09-15' },
  ],
}

describe('예산 없는 생활 지출', () => {
  it('비정기 정산은 생활 예산 잔액을 늘리지 않고 전체 실지출에 반영한다', () => {
    const result = monthlyBudgetSummary(state, '2026-09')
    expect(result).toMatchObject({ totalBudget: 1000000, totalSpent: 600000, totalPct: 60, totalSettled: 0,
      unbudgetedRaw: 200000, unbudgetedSettled: 120000, unbudgetedSpent: 80000, monthlyTotal: 680000 })
    expect(result.totalBudget - result.totalSpent).toBe(400000)
  })

  it('다음 달에 들어온 보험금은 그 달 실부담을 줄이고 예산 사용액은 그대로 둔다', () => {
    const result = monthlyBudgetSummary({ ...state, transactions: [...state.transactions,
      { type: 'settlement', categoryId: 'medical', amount: 30000, date: '2026-10-02' }] }, '2026-10')
    expect(result).toMatchObject({ totalSpent: 0, unbudgetedSpent: -30000, monthlyTotal: -30000, totalPct: 0 })
  })

  it('할부는 해당 월 회차만 포함하고 고정지출 및 누적 충전액 계산을 유지한다', () => {
    const result = monthlyBudgetSummary({ ...state,
      transactions: [{ type: 'living', categoryId: 'medical', amount: 300000, date: '2026-08-10', installmentCount: 3 }],
      irregularEnvelopes: [{ id: 'allowance', monthlyAmount: 50000 }],
      fixedExpenses: [{ id: 'rent', amount: 400000 }, { id: 'future', amount: 900000, startMonth: '2026-10' }],
    }, '2026-09')
    expect(result).toMatchObject({ totalBudget: 1050000, totalSpent: 0, unbudgetedSpent: 100000, fixedTotal: 400000, monthlyTotal: 500000 })
  })

  it('예산 0원과 예산 없음을 구분하고 이전 예산 변경 이력도 제외한다', () => {
    const changes = [{ categoryId: 'medical', effectiveMonth: '2026-01', amount: 50000 }]
    expect(budgetAmountForMonth(changes, state.livingCategories[1], '2026-09')).toBe(0)
    expect(rowToLivingCat({ id: 'zero', limit_amount: 0 }).budgetEnabled).toBe(true)
    const row = livingCatToRow(state.livingCategories[1], 0, { id: 'our-home' })
    expect(row).toMatchObject({ budget_enabled: false, household_id: 'our-home' })
    expect(rowToLivingCat(row).budgetEnabled).toBe(false)
  })
})
