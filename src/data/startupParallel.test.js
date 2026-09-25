import { beforeEach, describe, expect, it, vi } from 'vitest'
const { from, allocations } = vi.hoisted(() => ({ from: vi.fn(), allocations: vi.fn() }))
vi.mock('./supabaseClient.js', () => ({ sb: { from }, PALETTE: [] }))
vi.mock('./financialState.js', () => ({ loadHouseholdAllocations: allocations }))
import { loadState } from './loadState.js'

beforeEach(() => { from.mockReset(); allocations.mockReset() })

describe('첫 화면 조회 병렬화', () => {
  it('어떤 조회가 끝나기 전에도 16개 테이블과 공동 충전액 조회를 모두 시작한다', async () => {
    const pending = new Map()
    from.mockImplementation((table) => {
      const response = new Promise((resolve) => pending.set(table, resolve))
      const query = { select: () => query, eq: () => query, order: () => query, limit: () => query, then: response.then.bind(response) }
      return query
    })
    allocations.mockResolvedValue({ householdAllocations: [{ id: 'wife', monthlyAmount: 500000 }], allocationsError: null })
    const request = loadState({ id: 'home' }, 'me', [])
    expect(pending.size).toBe(16)
    expect(allocations).toHaveBeenCalledTimes(1)
    for (const [table, resolve] of pending) {
      resolve({ data: [{ id: table, name: table, monthly_amount: 300000, default_amount: 600000 }], error: null })
    }
    const result = await request
    expect(result.irregularEnvelopes[0].monthlyAmount).toBe(300000)
    expect(result.householdAllocations[0].monthlyAmount).toBe(500000)
    expect(result.livingCategories[0].limit).toBe(600000)
    expect(from).toHaveBeenCalledTimes(16)
  })

  it('선택 테이블 하나가 실패해도 다른 조회 결과는 유지한다', async () => {
    from.mockImplementation((table) => {
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        then: (resolve, reject) => (table === 'notification_settings'
          ? Promise.reject(new Error('offline'))
          : Promise.resolve({ data: [{ id: table, name: table }], error: null })).then(resolve, reject),
      }
      return query
    })
    allocations.mockResolvedValue({ householdAllocations: [], allocationsError: null })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const result = await loadState({ id: 'home' }, 'me', [])
      expect(result.fixedExpenses[0].id).toBe('fixed_expenses')
      expect(result.notificationSettings.dailyReminderHour).toBe(21)
    } finally { warning.mockRestore() }
  })
})
