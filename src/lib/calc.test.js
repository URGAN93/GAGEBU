import { describe, it, expect } from 'vitest'
import {
  elapsedMonths,
  addMonths,
  installmentBaseAmount,
  expandMonthTx,
  activeFixedExpenses,
  fixedInstallmentIndex,
  getBudgetForCategory,
  monthlyAmountForMonth,
  irregularContributions,
} from './calc.js'

describe('elapsedMonths', () => {
  it('starts at 1 for the origin month', () => {
    expect(elapsedMonths('2026-08', '2026-08')).toBe(1)
  })
  it('counts up month by month', () => {
    expect(elapsedMonths('2026-08', '2026-10')).toBe(3)
  })
  it('is 0 (not negative) before the origin month', () => {
    expect(elapsedMonths('2026-08', '2026-07')).toBe(0)
  })
  it('handles a year rollover', () => {
    expect(elapsedMonths('2026-11', '2027-02')).toBe(4)
  })
})

describe('addMonths', () => {
  it('rolls over into the next year', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
  })
  it('rolls back into the previous year', () => {
    expect(addMonths('2026-02', -3)).toBe('2025-11')
  })
})

describe('installmentBaseAmount', () => {
  it('absorbs the rounding remainder into the last installment', () => {
    const t = { amount: 100000, installmentCount: 3 }
    // 100000/3 = 33333.33... → round 33333, last installment takes the remainder
    expect(installmentBaseAmount(t, 1)).toBe(33333)
    expect(installmentBaseAmount(t, 2)).toBe(33333)
    expect(installmentBaseAmount(t, 3)).toBe(100000 - 33333 * 2)
    const sum = installmentBaseAmount(t, 1) + installmentBaseAmount(t, 2) + installmentBaseAmount(t, 3)
    expect(sum).toBe(t.amount)
  })
})

describe('expandMonthTx — 오늘 고친 버그(할부 만료 후에도 남아있던 것)의 회귀 테스트', () => {
  const tx = {
    id: 't1',
    type: 'irregular',
    amount: 197000,
    date: '2026-08-13',
    installmentCount: 3,
  }

  it('appears in the origin month with the first installment amount', () => {
    const result = expandMonthTx([tx], '2026-08')
    expect(result).toHaveLength(1)
    expect(result[0].installmentIndex).toBe(1)
    expect(result[0].date).toBe('2026-08-13')
  })

  it('appears in the last installment month (idx === installmentCount)', () => {
    const result = expandMonthTx([tx], '2026-10')
    expect(result).toHaveLength(1)
    expect(result[0].installmentIndex).toBe(3)
  })

  it('does NOT appear in the month after the installment ends (idx > installmentCount)', () => {
    const result = expandMonthTx([tx], '2026-11')
    expect(result).toHaveLength(0)
  })

  it('does NOT appear before the origin month (idx < 1)', () => {
    const result = expandMonthTx([tx], '2026-07')
    expect(result).toHaveLength(0)
  })

  it('re-projects the virtual date onto the target month, clamped to that month’s last day', () => {
    // 1월 31일 시작 3개월 할부 → 2월엔 30일이 없으니(2026은 평년) 28일로 클램프
    const jan31 = { id: 't2', type: 'living', amount: 90000, date: '2026-01-31', installmentCount: 3 }
    const result = expandMonthTx([jan31], '2026-02')
    expect(result[0].date).toBe('2026-02-28')
  })

  it('leaves a non-installment transaction only in its own month', () => {
    const single = { id: 't3', type: 'living', amount: 5000, date: '2026-08-05', installmentCount: null }
    expect(expandMonthTx([single], '2026-08')).toHaveLength(1)
    expect(expandMonthTx([single], '2026-09')).toHaveLength(0)
  })
})

describe('activeFixedExpenses / fixedInstallmentIndex', () => {
  it('excludes a fixed expense once its endMonth is reached', () => {
    const f = { id: 'f1', name: '구독', amount: 10000, endMonth: '2026-12' }
    expect(activeFixedExpenses([f], '2026-11')).toHaveLength(1)
    expect(activeFixedExpenses([f], '2026-12')).toHaveLength(0)
  })

  it('respects installment boundaries the same way expandMonthTx does', () => {
    const f = { id: 'f2', name: '가전 할부', amount: 20000, installmentCount: 6, installmentStartMonth: '2026-06' }
    expect(fixedInstallmentIndex(f, '2026-06')).toBe(1)
    expect(fixedInstallmentIndex(f, '2026-11')).toBe(6)
    expect(activeFixedExpenses([f], '2026-11')).toHaveLength(1)
    expect(activeFixedExpenses([f], '2026-12')).toHaveLength(0)
  })
})

describe('getBudgetForCategory', () => {
  const cat = { id: 'food', limit: 600000 }
  it('falls back to the category default when there is no override', () => {
    expect(getBudgetForCategory([], cat, '2026-08')).toBe(600000)
  })
  it('uses the month-specific override when present', () => {
    const budgets = [{ categoryId: 'food', yearMonth: '2026-08', amount: 700000 }]
    expect(getBudgetForCategory(budgets, cat, '2026-08')).toBe(700000)
    expect(getBudgetForCategory(budgets, cat, '2026-09')).toBe(600000)
  })
})

describe('monthlyAmountForMonth', () => {
  const env = { id: 'allowance', monthlyAmount: 500000 }
  it('uses the base rate before any effective-month change', () => {
    expect(monthlyAmountForMonth([], env, '2026-08')).toBe(500000)
  })
  it('applies the latest change effective at or before the target month, and does not affect earlier months', () => {
    const changes = [
      { envelopeId: 'allowance', effectiveMonth: '2026-09', amount: 600000 },
      { envelopeId: 'allowance', effectiveMonth: '2026-11', amount: 550000 },
    ]
    expect(monthlyAmountForMonth(changes, env, '2026-08')).toBe(500000)
    expect(monthlyAmountForMonth(changes, env, '2026-09')).toBe(600000)
    expect(monthlyAmountForMonth(changes, env, '2026-10')).toBe(600000)
    expect(monthlyAmountForMonth(changes, env, '2026-11')).toBe(550000)
  })
})

describe('irregularContributions', () => {
  it('buckets an installment transaction into each covered month within the range', () => {
    const tx = [{ id: 't1', type: 'irregular', categoryId: 'allowance', amount: 90000, date: '2026-08-13', installmentCount: 3, subcat: '선물' }]
    const records = irregularContributions(tx, 'allowance', '2026-01', '2026-12')
    expect(records.map((r) => r.month)).toEqual(['2026-08', '2026-09', '2026-10'])
  })
  it('ignores transactions outside the requested range', () => {
    const tx = [{ id: 't1', type: 'irregular', categoryId: 'allowance', amount: 5000, date: '2026-01-05', subcat: '기타' }]
    expect(irregularContributions(tx, 'allowance', '2026-08', '2026-12')).toHaveLength(0)
  })
})
