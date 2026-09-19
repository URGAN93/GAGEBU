import { beforeEach, describe, expect, it, vi } from 'vitest'
const { migrate, resolveHousehold, loadState } = vi.hoisted(() => ({ migrate: vi.fn(), resolveHousehold: vi.fn(), loadState: vi.fn() }))
vi.mock('../data/loadState.js', () => ({ migratePersonalAllowance: migrate, resolveHousehold, loadState, SupabaseUnreachableError: class extends Error {} }))
import { useAppStore } from './useAppStore.js'

beforeEach(() => {
  vi.resetAllMocks()
  useAppStore.setState({ authStatus: 'loading', startupInProgress: false, startupError: null })
  resolveHousehold.mockResolvedValue({ household: { id: 'home' }, myUserId: 'me', members: [], v3Available: true })
  loadState.mockResolvedValue({ livingCategories: [], irregularEnvelopes: [] })
})

describe('시작 중복 방지와 재시도', () => {
  it('세션 확인과 로그인 이벤트가 겹쳐도 초기 조회를 한번만 실행한다', async () => {
    let complete
    migrate.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const first = useAppStore.getState().bootstrap()
    await useAppStore.getState().bootstrap()
    expect(migrate).toHaveBeenCalledTimes(1)
    expect(resolveHousehold).toHaveBeenCalledTimes(1)
    complete({ ok: true })
    await first
    expect(loadState).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().authStatus).toBe('ready')
    expect(useAppStore.getState().startupInProgress).toBe(false)
  })

  it('실패한 시작은 오류를 표시하고 재시도할 수 있다', async () => {
    migrate.mockResolvedValue({ ok: true })
    loadState.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ livingCategories: [], irregularEnvelopes: [] })
    await useAppStore.getState().bootstrap()
    expect(useAppStore.getState().startupError).toBeTruthy()
    expect(useAppStore.getState().startupInProgress).toBe(false)
    await useAppStore.getState().bootstrap()
    expect(useAppStore.getState().authStatus).toBe('ready')
    expect(useAppStore.getState().startupError).toBeNull()
  })
})
