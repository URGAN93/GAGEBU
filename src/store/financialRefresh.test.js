import { beforeEach, describe, expect, it, vi } from 'vitest'
const { loadFinancialState } = vi.hoisted(() => ({ loadFinancialState: vi.fn() }))
vi.mock('../data/financialState.js', () => ({ loadFinancialState, loadHouseholdAllocations: vi.fn() }))
import { useAppStore } from './useAppStore.js'

beforeEach(() => {
  loadFinancialState.mockReset()
  useAppStore.setState({ authStatus: 'ready', household: { id: 'home' }, settingsSheetOpen: false, txSheetOpen: false,
    financialRefreshId: 0, householdAllocations: [], fixedExpenses: [], allocationsError: null })
})

describe('다른 기기의 공동 예산 갱신', () => {
  it('월 충전액과 고정지출을 함께 갱신한다', async () => {
    const loaded = { householdAllocations: [{ id: 'wife', monthlyAmount: 500000 }], fixedExpenses: [{ id: 'rent', amount: 400000 }], allocationsError: null }
    loadFinancialState.mockResolvedValue(loaded)
    await useAppStore.getState().refreshFinancialState()
    expect(useAppStore.getState()).toMatchObject(loaded)
    expect(loadFinancialState).toHaveBeenCalledWith({ id: 'home' })
  })

  it('설정 편집 중에는 미저장 항목을 덮어쓰지 않는다', async () => {
    useAppStore.setState({ settingsSheetOpen: true })
    await useAppStore.getState().refreshFinancialState()
    expect(loadFinancialState).not.toHaveBeenCalled()
  })

  it('느리게 도착한 이전 응답은 새 응답을 덮어쓰지 않는다', async () => {
    let completeFirst
    loadFinancialState.mockImplementationOnce(() => new Promise((resolve) => { completeFirst = resolve }))
      .mockResolvedValueOnce({ householdAllocations: [{ id: 'new' }], allocationsError: null })
    const first = useAppStore.getState().refreshFinancialState()
    await useAppStore.getState().refreshFinancialState()
    completeFirst({ householdAllocations: [{ id: 'old' }], allocationsError: null })
    await first
    expect(useAppStore.getState().householdAllocations).toEqual([{ id: 'new' }])
  })

  it('조회 중 저장한 값은 오래된 응답으로 되돌리지 않는다', async () => {
    let complete
    loadFinancialState.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
    const request = useAppStore.getState().refreshFinancialState()
    useAppStore.setState({ fixedExpenses: [{ id: 'rent', amount: 900000 }] })
    complete({ fixedExpenses: [{ id: 'rent', amount: 400000 }], allocationsError: null })
    await request
    expect(useAppStore.getState().fixedExpenses[0].amount).toBe(900000)
  })

  it('로그아웃 후 도착한 응답은 반영하지 않는다', async () => {
    let complete
    loadFinancialState.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
    const request = useAppStore.getState().refreshFinancialState()
    useAppStore.setState({ authStatus: 'signed-out' })
    complete({ householdAllocations: [{ id: 'private' }] })
    await request
    expect(useAppStore.getState().householdAllocations).toEqual([])
  })

  it('조회 실패는 총액 오류로 표시하고 다시 시도할 수 있다', async () => {
    loadFinancialState.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ householdAllocations: [], allocationsError: null })
    await useAppStore.getState().refreshFinancialState()
    expect(useAppStore.getState().allocationsError).toBeTruthy()
    await useAppStore.getState().refreshFinancialState()
    expect(useAppStore.getState().allocationsError).toBeNull()
  })
})
