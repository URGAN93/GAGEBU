import { describe, expect, it } from 'vitest'
import {
  calculateIncomeAllowance,
  encodeIncomeAllowanceNote,
  findIncomeAllowanceCredit,
  incomeCategoryKind,
  normalizeIncomeCategoryId,
  parseIncomeAllowanceNote,
} from './income.js'

describe('공통 수입 카테고리', () => {
  it('계정별 suffix가 붙은 기존 id를 공통 id로 정규화한다', () => {
    expect(normalizeIncomeCategoryId('income_regular_user-a')).toBe('income_regular')
    expect(normalizeIncomeCategoryId('income_extra_user-b')).toBe('income_extra')
    expect(incomeCategoryKind({ id: 'legacy', name: '추가수입' })).toBe('extra')
  })
})

describe('추가수입 개인용돈 연결', () => {
  it('원과 퍼센트 방식을 계산하고 수입액을 넘지 않는다', () => {
    expect(calculateIncomeAllowance(300000, 'percent', 10)).toBe(30000)
    expect(calculateIncomeAllowance(300000, 'amount', 50000)).toBe(50000)
    expect(calculateIncomeAllowance(300000, 'amount', 500000)).toBe(300000)
  })

  it('연결 메타데이터를 저장하고 다시 읽는다', () => {
    const note = encodeIncomeAllowanceNote({ transactionId: 'tx1', mode: 'percent', value: 12.5, label: '상여' })
    expect(parseIncomeAllowanceNote(note)).toMatchObject({ transactionId: 'tx1', mode: 'percent', value: 12.5 })
  })

  it('기존 팝업 방식 적립도 정확히 일치하면 수입과 연결한다', () => {
    const transaction = { id: 'tx1', amount: 300000, merchant: '추석 상여', date: '2026-09-23' }
    const linked = findIncomeAllowanceCredit(transaction, [
      { id: 'legacy', month: '2026-09', amount: 30000, note: '추석 상여 10%' },
    ])
    expect(linked).toMatchObject({ mode: 'percent', value: 10, credit: { id: 'legacy' } })
  })
})
