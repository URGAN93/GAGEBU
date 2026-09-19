import { describe, expect, it, vi } from 'vitest'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabaseClient.js', () => ({ sb: { rpc } }))
import { loadHouseholdAllocations } from './financialState.js'

describe('공동 충전액 조회', () => {
  it('현재 가구를 지정하고 서버가 반환한 두 계정 설정을 사용한다', async () => {
    const data = [{ id: 'me', monthlyAmount: 300000 }, { id: 'wife', monthlyAmount: 500000 }]
    rpc.mockResolvedValueOnce({ data, error: null })
    expect(await loadHouseholdAllocations({ id: 'our-home' })).toEqual({ householdAllocations: data, allocationsError: null })
    expect(rpc).toHaveBeenLastCalledWith('household_envelope_allocations', { p_household_id: 'our-home' })
  })
  it('서버 함수 미적용/권한 오류를 0원 합계로 취급하지 않는다', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
    const result = await loadHouseholdAllocations({ id: 'our-home' })
    expect(result.allocationsError).toBeTruthy()
    expect(result.householdAllocations).toEqual([])
  })
})
