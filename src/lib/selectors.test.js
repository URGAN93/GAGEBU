import { describe, expect, it } from 'vitest'
import { findEnvelopeName } from './selectors.js'

const categories = {
  incomeCategories: [{ id: 'income_regular_me', name: '내 정기수입' }],
  livingCategories: [],
  irregularEnvelopes: [],
}

describe('findEnvelopeName', () => {
  it('내 수입 카테고리도 공통 이름으로 표시한다', () => {
    expect(findEnvelopeName('income', 'income_regular_me', categories)).toBe('정기수입')
  })

  it('배우자의 기본 수입 카테고리는 계정별 suffix와 관계없이 표시한다', () => {
    expect(findEnvelopeName('income', 'income_regular_wife-user-id', categories)).toBe('정기수입')
    expect(findEnvelopeName('income', 'income_extra_wife-user-id', categories)).toBe('추가수입')
  })

  it('suffix가 없는 이전 기본 카테고리도 표시한다', () => {
    expect(findEnvelopeName('income', 'income_regular', categories)).toBe('정기수입')
    expect(findEnvelopeName('income', 'income_extra', categories)).toBe('추가수입')
  })

  it('알 수 없는 수입 카테고리만 삭제된 것으로 표시한다', () => {
    expect(findEnvelopeName('income', 'removed-category', categories)).toBe('(삭제된 카테고리)')
  })
})
